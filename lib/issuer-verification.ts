import { and, desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../db";
import {
  auditEvents,
  issuerApplicationDocuments,
  issuerApplications,
  issuerKeyChallenges,
  issuerVerificationChecks,
} from "../db/schema";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import {
  getOrganizationForUser,
  isIcsAdmin,
  TecAuthorizationError,
  TecInputError,
} from "./tec";

const DOCUMENT_TYPES = new Set([
  "accreditation_certificate",
  "accreditation_scope",
  "legal_identity",
]);
const MANUAL_CHECK_TYPES = new Set(["identity", "accreditation", "scope"]);
const CHECK_STATUSES = new Set(["pending", "passed", "failed"]);
const MAX_EVIDENCE_BYTES = 15 * 1024 * 1024;

function now() {
  return new Date().toISOString();
}

function normalizeText(value: unknown, maximum = 180) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function documentsBucket() {
  const bucket = (env as unknown as { DOCUMENTS?: R2Bucket }).DOCUMENTS;
  if (!bucket) throw new Error("Private document storage is not available.");
  return bucket;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Bytes(value: ArrayBuffer) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", value)));
}

function cleanFilename(value: string) {
  return normalizeText(value.split(/[\\/]/).pop() || "evidence.pdf", 240)
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("") || "evidence.pdf";
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function latestApplicationForUser(user: ChatGPTUser) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership || membership.organization.organizationType !== "laboratory") {
    throw new TecAuthorizationError("A laboratory organization account is required.");
  }
  const [application] = await getDb()
    .select()
    .from(issuerApplications)
    .where(eq(issuerApplications.organizationId, membership.organization.id))
    .orderBy(desc(issuerApplications.submittedAt))
    .limit(1);
  if (!application) throw new TecInputError("Submit the laboratory issuer application first.");
  if (!["submitted", "needs_information"].includes(application.status)) {
    throw new TecInputError("This issuer application is no longer open for verification evidence.");
  }
  return { membership, application };
}

function audit(
  organizationId: string,
  actorUserId: string,
  eventType: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>,
) {
  return getDb().insert(auditEvents).values({
    id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
    organizationId,
    actorUserId,
    eventType,
    entityType,
    entityId,
    payload: JSON.stringify(payload),
    createdAt: now(),
  });
}

export async function uploadIssuerEvidence(user: ChatGPTUser, form: FormData) {
  const { membership, application } = await latestApplicationForUser(user);
  const documentType = normalizeText(form.get("documentType"), 64);
  if (!DOCUMENT_TYPES.has(documentType)) {
    throw new TecInputError("Choose legal identity, accreditation certificate, or accreditation scope.");
  }
  const document = form.get("document");
  if (!(document instanceof File)) throw new TecInputError("Choose a PDF evidence file.");
  if (document.size < 5 || document.size > MAX_EVIDENCE_BYTES) {
    throw new TecInputError("Evidence PDFs must be between 5 bytes and 15 MB.");
  }
  const filename = cleanFilename(document.name);
  if (!filename.toLowerCase().endsWith(".pdf")) {
    throw new TecInputError("Only PDF verification evidence is accepted.");
  }
  const bytes = await document.arrayBuffer();
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new TecInputError("The uploaded evidence is not a valid PDF.");
  }
  const sha256 = await sha256Bytes(bytes);
  const id = `issuer_doc_${crypto.randomUUID().replaceAll("-", "")}`;
  const objectKey = `issuer-evidence/${membership.organization.id}/${application.id}/${id}.pdf`;
  await documentsBucket().put(objectKey, bytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      applicationId: application.id,
      organizationId: membership.organization.id,
      documentType,
      sha256,
    },
  });
  try {
    await getDb().batch([
      getDb().insert(issuerApplicationDocuments).values({
        id,
        applicationId: application.id,
        organizationId: membership.organization.id,
        documentType,
        objectKey,
        filename,
        mimeType: "application/pdf",
        size: document.size,
        sha256,
        uploadedByUserId: user.userId,
        createdAt: now(),
      }),
      audit(
        membership.organization.id,
        user.userId,
        "issuer.evidence_uploaded",
        "issuer_application_document",
        id,
        { applicationId: application.id, documentType, sha256 },
      ),
    ]);
  } catch (error) {
    await documentsBucket().delete(objectKey);
    throw error;
  }
  return { id, documentType, filename, sha256, size: document.size };
}

export async function getIssuerEvidenceDocument(user: ChatGPTUser, documentIdValue: string) {
  const documentId = normalizeText(documentIdValue, 160);
  const [document] = await getDb()
    .select()
    .from(issuerApplicationDocuments)
    .where(eq(issuerApplicationDocuments.id, documentId))
    .limit(1);
  if (!document) return null;
  const membership = await getOrganizationForUser(user.userId);
  if (!isIcsAdmin(user) && membership?.organization.id !== document.organizationId) return null;
  const object = await documentsBucket().get(document.objectKey);
  if (!object) return null;
  return { document, object };
}

export async function createIssuerKeyChallenge(user: ChatGPTUser) {
  const { membership, application } = await latestApplicationForUser(user);
  if (!application.publicKeyJwk || !application.keyId) {
    throw new TecInputError("Submit an Ed25519 public key and key ID before proving key control.");
  }
  const createdAt = now();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const id = `issuer_challenge_${crypto.randomUUID().replaceAll("-", "")}`;
  const canonicalPayload = JSON.stringify({
    type: "TECRIDIssuerKeyConformanceChallenge",
    version: 1,
    challengeId: id,
    applicationId: application.id,
    organizationId: membership.organization.id,
    keyId: application.keyId,
    issuedAt: createdAt,
    expiresAt,
    requirements: ["Ed25519", "UTF-8", "base64url-signature"],
  });
  const db = getDb();
  await db.batch([
    db
      .update(issuerKeyChallenges)
      .set({ status: "expired" })
      .where(
        and(
          eq(issuerKeyChallenges.applicationId, application.id),
          eq(issuerKeyChallenges.status, "pending"),
        ),
      ),
    db.insert(issuerKeyChallenges).values({
      id,
      applicationId: application.id,
      organizationId: membership.organization.id,
      canonicalPayload,
      status: "pending",
      expiresAt,
      createdAt,
    }),
    audit(
      membership.organization.id,
      user.userId,
      "issuer.key_challenge_created",
      "issuer_key_challenge",
      id,
      { applicationId: application.id, keyId: application.keyId, expiresAt },
    ),
  ]);
  return { id, canonicalPayload, expiresAt };
}

export async function verifyIssuerKeyChallenge(
  user: ChatGPTUser,
  value: Record<string, unknown>,
) {
  const { membership, application } = await latestApplicationForUser(user);
  const challengeId = normalizeText(value.challengeId, 180);
  const signatureValue = normalizeText(value.signature, 500);
  if (!challengeId || !signatureValue) {
    throw new TecInputError("Challenge ID and base64url signature are required.");
  }
  const [challenge] = await getDb()
    .select()
    .from(issuerKeyChallenges)
    .where(
      and(
        eq(issuerKeyChallenges.id, challengeId),
        eq(issuerKeyChallenges.applicationId, application.id),
        eq(issuerKeyChallenges.organizationId, membership.organization.id),
      ),
    )
    .limit(1);
  if (!challenge || challenge.status !== "pending") {
    throw new TecInputError("This signing challenge is unavailable or has already been used.");
  }
  if (Date.parse(challenge.expiresAt) <= Date.now()) {
    await getDb()
      .update(issuerKeyChallenges)
      .set({ status: "expired" })
      .where(eq(issuerKeyChallenges.id, challenge.id));
    throw new TecInputError("This signing challenge expired. Create a new one.");
  }
  let publicKey: CryptoKey;
  let signature: Uint8Array;
  try {
    const jwk = JSON.parse(application.publicKeyJwk || "") as JsonWebKey;
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.x || jwk.d) throw new Error();
    publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["verify"]);
    signature = decodeBase64Url(signatureValue);
  } catch {
    throw new TecInputError("The submitted public key or signature is malformed.");
  }
  const valid = await crypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    signature,
    new TextEncoder().encode(challenge.canonicalPayload),
  );
  if (!valid) throw new TecAuthorizationError("The signing challenge did not verify against the submitted public key.");

  const verifiedAt = now();
  const db = getDb();
  const systemChecks = [
    {
      checkType: "key_control",
      evidenceNote: `Challenge ${challenge.id} verified against ${application.keyId}.`,
    },
    {
      checkType: "conformance",
      evidenceNote: "Laboratory produced a valid Ed25519 base64url signature over the exact TECRID canonical UTF-8 challenge payload.",
    },
  ];
  await db.batch([
    db
      .update(issuerKeyChallenges)
      .set({ status: "verified", verifiedAt })
      .where(eq(issuerKeyChallenges.id, challenge.id)),
    ...systemChecks.map((check) =>
      db
        .insert(issuerVerificationChecks)
        .values({
          id: `issuer_check_${crypto.randomUUID().replaceAll("-", "")}`,
          applicationId: application.id,
          organizationId: membership.organization.id,
          checkType: check.checkType,
          status: "passed",
          evidenceNote: check.evidenceNote,
          reviewedByUserId: "system:key-challenge",
          reviewedByEmail: "system@tecrid.com",
          reviewedAt: verifiedAt,
          createdAt: verifiedAt,
          updatedAt: verifiedAt,
        })
        .onConflictDoUpdate({
          target: [issuerVerificationChecks.applicationId, issuerVerificationChecks.checkType],
          set: {
            status: "passed",
            evidenceNote: check.evidenceNote,
            reviewedByUserId: "system:key-challenge",
            reviewedByEmail: "system@tecrid.com",
            reviewedAt: verifiedAt,
            updatedAt: verifiedAt,
          },
        }),
    ),
    audit(
      membership.organization.id,
      user.userId,
      "issuer.key_challenge_verified",
      "issuer_key_challenge",
      challenge.id,
      { applicationId: application.id, keyId: application.keyId },
    ),
  ]);
  return { challengeId: challenge.id, verifiedAt, checks: ["key_control", "conformance"] };
}

export async function reviewIssuerVerificationCheck(
  user: ChatGPTUser,
  applicationIdValue: string,
  value: Record<string, unknown>,
) {
  if (!isIcsAdmin(user)) throw new TecAuthorizationError("ICS administrator access required.");
  const applicationId = normalizeText(applicationIdValue, 160);
  const checkType = normalizeText(value.checkType, 64);
  const status = normalizeText(value.status, 32);
  const evidenceNote = normalizeText(value.evidenceNote, 1800);
  if (!MANUAL_CHECK_TYPES.has(checkType) || !CHECK_STATUSES.has(status)) {
    throw new TecInputError("Choose a supported verification check and status.");
  }
  if (!evidenceNote) throw new TecInputError("Record the evidence reviewed and decision basis.");
  const [application] = await getDb()
    .select()
    .from(issuerApplications)
    .where(eq(issuerApplications.id, applicationId))
    .limit(1);
  if (!application) throw new TecInputError("Issuer application not found.");
  if (application.status !== "submitted") {
    throw new TecInputError("Verification checks can be recorded only while the application is submitted for review.");
  }
  const reviewedAt = now();
  const db = getDb();
  await db.batch([
    db
      .insert(issuerVerificationChecks)
      .values({
        id: `issuer_check_${crypto.randomUUID().replaceAll("-", "")}`,
        applicationId,
        organizationId: application.organizationId,
        checkType,
        status,
        evidenceNote,
        reviewedByUserId: user.userId,
        reviewedByEmail: user.email,
        reviewedAt,
        createdAt: reviewedAt,
        updatedAt: reviewedAt,
      })
      .onConflictDoUpdate({
        target: [issuerVerificationChecks.applicationId, issuerVerificationChecks.checkType],
        set: {
          status,
          evidenceNote,
          reviewedByUserId: user.userId,
          reviewedByEmail: user.email,
          reviewedAt,
          updatedAt: reviewedAt,
        },
      }),
    audit(
      application.organizationId,
      user.userId,
      "issuer.verification_check_reviewed",
      "issuer_application",
      applicationId,
      { checkType, status, evidenceNote },
    ),
  ]);
  return { applicationId, checkType, status, evidenceNote, reviewedAt };
}
