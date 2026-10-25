import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../db";
import { credentials, credentialVersions, issuanceIdempotency } from "../db/schema";
import { TecConflictError, TecInputError } from "./tec";
export async function sha256Hex(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,"0")).join(""); }
export function issuanceKey(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value)) throw new TecInputError("A 1 to 120 character Idempotency-Key using letters, numbers, periods, colons, underscores or hyphens is required for issuance.");
  return value;
}
export type IssuanceResponse = { tecrid: string; identifier: string; status: string; fingerprint: string | null; signatureVerified: boolean; visibility: string; productSku: string | null; idempotent: boolean };
export type IssuanceContext = { id: string; organizationId: string; requestHash: string; sourceHash: string; canonicalPayload: string; proof: { keyId: string; signature: string } | undefined; reservedIdentifier?: string | null };
export async function issuanceContext(organizationId: string, key: unknown, canonicalPayload: string, sourceHash: string, proof: IssuanceContext["proof"], reservedIdentifier?: string | null): Promise<IssuanceContext> {
  return { id: await sha256Hex(`${organizationId}\0${issuanceKey(key)}`), organizationId, requestHash: await sha256Hex(JSON.stringify({canonicalPayload,proof,reservedIdentifier:reservedIdentifier || null})), sourceHash, canonicalPayload, proof, reservedIdentifier };
}
export async function replayIssuance(context: IssuanceContext): Promise<IssuanceResponse | null> {
  const db = getDb();
  const [saved] = await db.select().from(issuanceIdempotency).where(eq(issuanceIdempotency.id,context.id)).limit(1);
  if (saved) {
    if (saved.organizationId !== context.organizationId || saved.requestHash !== context.requestHash) throw new TecConflictError("This idempotency key was already used with different issuance content.");
    return { ...JSON.parse(saved.responseJson), idempotent: true };
  }
  const [existing] = await db.select().from(credentials).where(and(eq(credentials.organizationId,context.organizationId),eq(credentials.sourceDocumentHash,context.sourceHash),ne(credentials.status,"draft"))).limit(1);
  if (!existing) return null;
  const [original] = await db.select().from(credentialVersions).where(and(eq(credentialVersions.credentialIdentifier,existing.identifier),eq(credentialVersions.version,1))).limit(1);
  if (!original || original.signedPayload !== context.canonicalPayload || original.issuerKeyId !== context.proof?.keyId || original.issuerSignature !== context.proof?.signature || (context.reservedIdentifier && existing.identifier !== context.reservedIdentifier)) throw new TecConflictError("This laboratory already issued a different credential for this source-document hash. Use its version workflow for corrections.");
  const response: IssuanceResponse = { tecrid:existing.identifier,identifier:existing.identifier,status:original.status,fingerprint:original.fingerprint,signatureVerified:true,visibility:existing.visibility,productSku:existing.productSku,idempotent:true };
  await db.insert(issuanceIdempotency).values({id:context.id,organizationId:context.organizationId,requestHash:context.requestHash,credentialIdentifier:existing.identifier,responseJson:JSON.stringify(response),createdAt:new Date().toISOString()}).onConflictDoNothing();
  // A concurrent request may have claimed this key with different content.
  const [alias] = await db.select().from(issuanceIdempotency).where(eq(issuanceIdempotency.id,context.id)).limit(1);
  if (alias.requestHash !== context.requestHash) throw new TecConflictError("This idempotency key was already used with different issuance content.");
  return response;
}
