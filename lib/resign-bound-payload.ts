import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { credentialResults, credentials, credentialVersions, organizations } from "../db/schema";
import { boundSigningText, coversBoundSignature } from "./tec";

export type ResignReport = {
  dryRun: boolean;
  scanned: number;
  alreadyBound: number;
  needsResign: number;
  resigned: number;
  skippedMissingPdf: number;
  skippedDraft: number;
  failed: number;
};

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signatureVerifies(publicJwk: string, payload: string, signature: string) {
  try {
    const jwk = JSON.parse(publicJwk) as JsonWebKey;
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.x || jwk.d) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["verify"]);
    return crypto.subtle.verify({ name: "Ed25519" }, key, decodeBase64Url(signature), new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}

export async function resignBoundPayloads(options: {
  dryRun?: boolean;
  sign?: (keyId: string, payload: string) => Promise<string>;
} = {}): Promise<ResignReport> {
  const dryRun = options.dryRun !== false;
  const db = getDb();
  const rows = await db.select().from(credentials);
  const report: ResignReport = {
    dryRun,
    scanned: rows.length,
    alreadyBound: 0,
    needsResign: 0,
    resigned: 0,
    skippedMissingPdf: 0,
    skippedDraft: 0,
    failed: 0,
  };
  for (const credential of rows) {
    if (credential.status !== "issued" && credential.status !== "revoked") {
      report.skippedDraft += 1;
      continue;
    }
    if (!credential.sourceDocumentHash || !credential.issuerSignature || !credential.issuerKeyId) {
      report.skippedMissingPdf += 1;
      continue;
    }
    const [organization] = await db.select().from(organizations).where(eq(organizations.id, credential.organizationId)).limit(1);
    const versions = await db.select().from(credentialVersions).where(eq(credentialVersions.credentialIdentifier, credential.identifier)).orderBy(asc(credentialVersions.version));
    const current = versions.find((version) => version.version === credential.version) ?? versions.at(-1) ?? null;
    const previous = current ? versions.filter((version) => version.version < current.version).at(-1) : undefined;
    const results = await db.select().from(credentialResults).where(eq(credentialResults.credentialIdentifier, credential.identifier)).orderBy(asc(credentialResults.sequence));
    const expected = {
      identifier: credential.identifier,
      sourceDocumentHash: credential.sourceDocumentHash,
      lotNumber: credential.lotNumber,
    };
    const storedPayload = current?.signedPayload ?? credential.signedPayload;
    const storedSignature = current?.issuerSignature ?? credential.issuerSignature;
    const bound = Boolean(
      storedPayload &&
      storedSignature &&
      organization?.issuerPublicKeyJwk &&
      coversBoundSignature(storedPayload, expected) &&
      await signatureVerifies(organization.issuerPublicKeyJwk, storedPayload, storedSignature),
    );
    if (bound) {
      report.alreadyBound += 1;
      continue;
    }
    report.needsResign += 1;
    if (dryRun) continue;
    if (!options.sign || !organization?.issuerPublicKeyJwk || !organization.issuerKeyVerifiedAt) {
      report.failed += 1;
      continue;
    }
    const payload = boundSigningText({
      identifier: credential.identifier,
      version: current?.version ?? credential.version,
      changeType: current?.changeType ?? "issuance",
      changeReason: current?.changeReason ?? null,
      previousFingerprint: previous?.fingerprint ?? null,
      credential,
      results,
    });
    if (!payload) {
      report.failed += 1;
      continue;
    }
    let signature: string;
    try {
      signature = await options.sign(credential.issuerKeyId, payload);
    } catch {
      report.failed += 1;
      continue;
    }
    if (!await signatureVerifies(organization.issuerPublicKeyJwk, payload, signature)) {
      report.failed += 1;
      continue;
    }
    const signedPayloadHash = await sha256(payload);
    const nextVersion = (current?.version ?? credential.version) + 1;
    const createdAt = new Date().toISOString();
    const canonicalPayload = JSON.stringify({
      type: "BoundSignatureRepair",
      tecrid: credential.identifier,
      version: nextVersion,
      status: credential.status,
      signedPayload: payload,
    });
    const fingerprint = await sha256(canonicalPayload);
    await db.insert(credentialVersions).values({
      credentialIdentifier: credential.identifier,
      version: nextVersion,
      status: credential.status,
      canonicalPayload,
      fingerprint,
      issuerSignature: signature,
      issuerKeyId: credential.issuerKeyId,
      issuerPublicKeyJwk: organization.issuerPublicKeyJwk,
      issuerKeyVerifiedAt: organization.issuerKeyVerifiedAt,
      signatureAlgorithm: "Ed25519",
      signedPayload: payload,
      signedPayloadHash,
      changeType: "signature_binding",
      changeReason: "Re-signed so the laboratory signature covers the TECRID, PDF SHA-256, and lot.",
      createdAt,
    });
    await db.update(credentials).set({
      version: nextVersion,
      fingerprint,
      issuerSignature: signature,
      issuerPublicKeyJwk: organization.issuerPublicKeyJwk,
      issuerKeyVerifiedAt: organization.issuerKeyVerifiedAt,
      signatureAlgorithm: "Ed25519",
      signedPayload: payload,
      signedPayloadHash,
      updatedAt: createdAt,
    }).where(eq(credentials.identifier, credential.identifier));
    report.resigned += 1;
  }
  return report;
}
