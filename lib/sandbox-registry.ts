import { Buffer } from "node:buffer";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { sandboxRegistryCredentials, sandboxIssuanceIdempotency } from "../db/schema";
import { authenticateSandboxApiRequest, SandboxInputError } from "./sandbox";
import { canonicalizeCredential, getOrganizationForUser, TecAuthorizationError, TecConflictError, TecInputError } from "./tec";
import { issuanceKey, sha256Hex } from "./issuance-safety";
export function canonicalizeSandboxCredential(input: unknown) {
  const { normalizedCredential } = canonicalizeCredential(input);
  return { normalizedCredential, canonicalPayload: JSON.stringify({ type: "SandboxTestEvidenceCredential", schemaVersion: "tecrid.sandbox/1", environment: "sandbox", credential: normalizedCredential }) };
}
export async function sandboxRegistryPrincipal(request: Request) {
  let authenticated;
  try { authenticated = await authenticateSandboxApiRequest(request); } catch(error) { if (error instanceof SandboxInputError) throw new TecAuthorizationError("The sandbox key is invalid or revoked."); throw error; }
  if (!authenticated) throw new TecAuthorizationError("Use a tec_sandbox_ key for the sandbox registry.");
  const membership = await getOrganizationForUser(authenticated.key.userId);
  if (!membership || membership.organization.organizationType !== "laboratory") throw new TecAuthorizationError("A laboratory workspace is required for sandbox issuance.");
  return { organization: membership.organization, userId: authenticated.key.userId };
}
export async function listSandboxCredentials(organizationId: string) {
  return (await getDb().select().from(sandboxRegistryCredentials).where(eq(sandboxRegistryCredentials.organizationId,organizationId)).orderBy(desc(sandboxRegistryCredentials.createdAt)).limit(100)).map(row=>JSON.parse(row.documentJson));
}
export async function getSandboxCredential(organizationId: string, identifier: string) {
  const [record] = await getDb().select().from(sandboxRegistryCredentials).where(and(eq(sandboxRegistryCredentials.organizationId,organizationId),eq(sandboxRegistryCredentials.identifier,identifier))).limit(1);
  return record ? JSON.parse(record.documentJson) : null;
}
export async function issueSandboxCredential(principal: Awaited<ReturnType<typeof sandboxRegistryPrincipal>>, input: Record<string, unknown>, key: unknown) {
  const { canonicalPayload, normalizedCredential } = canonicalizeSandboxCredential(input);
  if (input.publish !== true) throw new TecInputError("Sandbox issuance requires publish=true; it never publishes to the production registry.");
  const sourceHash = normalizedCredential.sourceDocument?.sha256;
  if (!sourceHash) throw new TecInputError("Sandbox issuance requires a signed source-document SHA-256 hash.");
  if (normalizedCredential.productSku && !normalizedCredential.lotNumber && !normalizedCredential.sourceDocument?.intakeId) throw new TecInputError("A sandbox SKU requires a signed lot or sample reference.");
  const proof = input.proof as { algorithm?: string; keyId?: string; signature?: string; publicKeyJwk?: JsonWebKey } | undefined;
  const jwk = proof?.publicKeyJwk;
  if (!proof || proof.algorithm !== "Ed25519" || !proof.keyId || !proof.signature || !jwk || jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.x || jwk.d) throw new TecInputError("Supply a public Ed25519 test key and proof. Private keys are forbidden.");
  const compatible = { ...jwk, ...(jwk.alg === "Ed25519" ? {alg:"EdDSA"} : {}) };
  try {
    const key = await crypto.subtle.importKey("jwk",compatible,{name:"Ed25519"},false,["verify"]);
    if (!await crypto.subtle.verify("Ed25519",key,Buffer.from(proof.signature,"base64url"),new TextEncoder().encode(canonicalPayload))) throw Error();
  } catch { throw new TecAuthorizationError("Sandbox issuer signature verification failed."); }
  const organizationId = principal.organization.id;
  const id = await sha256Hex(`${organizationId}\0${issuanceKey(key)}`);
  const requestHash = await sha256Hex(JSON.stringify({canonicalPayload,proof}));
  const db = getDb();
  async function replay() {
    const [saved] = await db.select().from(sandboxIssuanceIdempotency).where(eq(sandboxIssuanceIdempotency.id,id)).limit(1);
    if (saved) { if (saved.requestHash !== requestHash) throw new TecConflictError("The sandbox idempotency key was used with different content."); return { credential: await getSandboxCredential(organizationId,saved.credentialIdentifier),idempotent:true }; }
    const [sameSource] = await db.select().from(sandboxRegistryCredentials).where(and(eq(sandboxRegistryCredentials.organizationId,organizationId),eq(sandboxRegistryCredentials.sourceDocumentHash,sourceHash!))).limit(1);
    if (!sameSource) return null;
    if (sameSource.requestHash !== requestHash) throw new TecConflictError("This sandbox laboratory already issued different content for that source-document hash.");
    await db.insert(sandboxIssuanceIdempotency).values({id,organizationId,requestHash,credentialIdentifier:sameSource.identifier}).onConflictDoNothing();
    const [alias] = await db.select().from(sandboxIssuanceIdempotency).where(eq(sandboxIssuanceIdempotency.id,id)).limit(1);
    if (alias.requestHash !== requestHash) throw new TecConflictError("The sandbox idempotency key was used with different content.");
    return { credential:JSON.parse(sameSource.documentJson),idempotent:true };
  }
  const existing = await replay(); if (existing) return existing;
  const identifier = `SBX·${principal.organization.issuerCode}-${crypto.randomUUID().replaceAll("-","").slice(0,16).toUpperCase()}`;
  const createdAt = new Date().toISOString();
  const signed = { tecrid:identifier,environment:"sandbox",productionAuthority:false,status:"sandbox_issued",version:1,issuedAt:createdAt,issuer:{code:principal.organization.issuerCode,identityVerified:false,testKey:true},credential:normalizedCredential,proof:{keyId:proof.keyId,algorithm:proof.algorithm,signature:proof.signature,publicKeyJwk:jwk},signedPayload:canonicalPayload };
  const document = { ...signed,fingerprintAlgorithm:"SHA-256",fingerprint:await sha256Hex(JSON.stringify(signed)) };
  try { await db.batch([
    db.insert(sandboxRegistryCredentials).values({identifier,organizationId,createdByUserId:principal.userId,sourceDocumentHash:sourceHash,requestHash,documentJson:JSON.stringify(document),createdAt}),
    db.insert(sandboxIssuanceIdempotency).values({id,organizationId,requestHash,credentialIdentifier:identifier}),
  ]); } catch(error) { const existing = await replay(); if (existing) return existing; throw error; }
  return {credential:document,idempotent:false};
}
