import { and, desc, eq } from "drizzle-orm";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import {
  credentials,
  disputeCases,
  verificationChecks,
} from "../db/schema";
import {
  isSampleTecrid,
  SAMPLE_SOURCE_FINGERPRINT,
  sampleCredentialDocument,
} from "./sample-tecrid";
import {
  getCredential,
  getOrganizationForUser,
  publicCredentialDocument,
  TecAuthorizationError,
  TecInputError,
} from "./tec";

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

function clean(value: unknown, maximum = 240) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function normalizeIdentifier(value: unknown) {
  const raw = clean(value, 120).toUpperCase();
  const normalized = raw.replace(/^TECRID[:-]/, "TECRID·").replace(/^TEC[:-]/, "TECRID·");
  return normalized.startsWith("TECRID·") ? normalized : normalized ? `TECRID·${normalized}` : "";
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function resolveDocument(identifierValue: unknown) {
  const identifier = normalizeIdentifier(identifierValue);
  if (!identifier) return null;
  if (isSampleTecrid(identifier)) {
    return { document: sampleCredentialDocument(), record: null, sample: true };
  }
  const record = await getCredential(identifier);
  if (!record) return null;
  return { document: publicCredentialDocument(record), record, sample: false };
}

function verificationOutcome(resolution: Awaited<ReturnType<typeof resolveDocument>>) {
  if (!resolution) return "not_found";
  if (resolution.sample) return "sample_only";
  const { credential, issuer } = resolution.record!;
  if (credential.status === "revoked") return "revoked";
  if (credential.status !== "issued") return "not_currently_issued";
  if (issuer.issuerStatus !== "verified") return "issuer_not_verified";
  const integrity = resolution.record!.integrity;
  if (
    !integrity.fingerprintValid ||
    !integrity.issuerSignatureVerified ||
    !integrity.currentVersionConsistent ||
    !integrity.versionHistoryRecorded
  ) return "proof_incomplete";
  return "verified_match";
}

export async function createVerificationCheck(
  input: { identifier?: unknown; documentSha256?: unknown },
  requesterUserId: string | null = null,
) {
  const identifierInput = normalizeIdentifier(input.identifier);
  const hashInput = clean(input.documentSha256, 64).toLowerCase();
  if (Boolean(identifierInput) === Boolean(hashInput)) {
    throw new TecInputError("Provide either one TECRID or one PDF SHA-256 fingerprint.");
  }
  if (hashInput && !SHA256_PATTERN.test(hashInput)) {
    throw new TecInputError("The PDF fingerprint must be a 64-character SHA-256 digest.");
  }

  let resolution: Awaited<ReturnType<typeof resolveDocument>> = null;
  let identifier = identifierInput;
  if (identifierInput) {
    resolution = await resolveDocument(identifierInput);
  } else if (hashInput === SAMPLE_SOURCE_FINGERPRINT.toLowerCase()) {
    resolution = { document: sampleCredentialDocument(), record: null, sample: true };
    identifier = resolution.document.tecrid;
  } else {
    const db = getDb();
    const [match] = await db
      .select({ identifier: credentials.identifier })
      .from(credentials)
      .where(
        and(
          eq(credentials.sourceDocumentHash, hashInput),
          eq(credentials.publicRecord, true),
        ),
      )
      .limit(1);
    if (match) {
      identifier = match.identifier;
      resolution = await resolveDocument(match.identifier);
    }
  }

  const outcome = verificationOutcome(resolution);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const credentialIdentifier = resolution?.document.tecrid ?? (identifier || null);
  const recordFingerprint = resolution?.document.integrity.fingerprint ?? null;
  const receiptPayload = JSON.stringify({
    receiptId: id,
    checkedAt: createdAt,
    lookupType: identifierInput ? "tecrid" : "pdf_sha256",
    lookupValue: identifierInput || hashInput,
    outcome,
    credentialIdentifier,
    recordFingerprint,
  });
  const receiptFingerprint = await sha256(receiptPayload);
  const db = getDb();
  await db.insert(verificationChecks).values({
    id,
    lookupType: identifierInput ? "tecrid" : "pdf_sha256",
    lookupValue: identifierInput || hashInput,
    outcome,
    credentialIdentifier,
    issuerOrganizationId: resolution?.record?.issuer.id ?? null,
    recordFingerprint,
    receiptFingerprint,
    requesterUserId,
    createdAt,
  });
  return {
    receiptId: id,
    receiptFingerprint,
    checkedAt: createdAt,
    outcome,
    credentialIdentifier,
    record: resolution?.document ?? null,
    productionAuthority: Boolean(resolution && !resolution.sample),
  };
}

export async function getVerificationReceipt(receiptIdValue: unknown) {
  const receiptId = clean(receiptIdValue, 100);
  if (!receiptId) return null;
  const db = getDb();
  const [receipt] = await db
    .select()
    .from(verificationChecks)
    .where(eq(verificationChecks.id, receiptId))
    .limit(1);
  return receipt ?? null;
}

export async function listLabDefenseForUser(user: ChatGPTUser) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) throw new TecAuthorizationError("Complete organization setup first.");
  const db = getDb();
  const [checks, cases] = await Promise.all([
    db
      .select()
      .from(verificationChecks)
      .where(eq(verificationChecks.issuerOrganizationId, membership.organization.id))
      .orderBy(desc(verificationChecks.createdAt))
      .limit(100),
    db
      .select()
      .from(disputeCases)
      .where(eq(disputeCases.organizationId, membership.organization.id))
      .orderBy(desc(disputeCases.createdAt))
      .limit(100),
  ]);
  return { membership, checks, cases };
}

function normalizedText(value: unknown) {
  return clean(value, 300).toLowerCase().replace(/\s+/g, " ");
}

function resultToPpb(result: { resultText?: unknown; numericValue?: unknown; unit?: unknown }) {
  const value = typeof result.numericValue === "number"
    ? result.numericValue
    : Number(clean(result.resultText, 80).replace(/^<\s*/, ""));
  if (!Number.isFinite(value) || value < 0) return null;
  const unit = normalizedText(result.unit).replace("μ", "µ");
  const factors: Record<string, number> = {
    ppb: 1,
    "µg/kg": 1,
    "ug/kg": 1,
    ppm: 1000,
    "mg/kg": 1000,
    "µg/g": 1000,
    "ug/g": 1000,
  };
  return factors[unit] == null ? null : value * factors[unit];
}

function compareDocuments(
  left: NonNullable<Awaited<ReturnType<typeof resolveDocument>>>,
  right: NonNullable<Awaited<ReturnType<typeof resolveDocument>>>,
) {
  const leftDoc = left.document;
  const rightDoc = right.document;
  const context = [
    { field: "Sample name", left: leftDoc.subject.sampleName, right: rightDoc.subject.sampleName },
    { field: "Lot number", left: leftDoc.subject.lotNumber, right: rightDoc.subject.lotNumber },
    { field: "Matrix", left: leftDoc.subject.matrix, right: rightDoc.subject.matrix },
    { field: "Method", left: leftDoc.subject.method, right: rightDoc.subject.method },
    { field: "Testing date", left: leftDoc.subject.testedAt, right: rightDoc.subject.testedAt },
  ].map((item) => ({
    ...item,
    state: !item.left || !item.right
      ? "missing"
      : normalizedText(item.left) === normalizedText(item.right)
        ? "aligned"
        : "different",
  }));
  const rightByAnalyte = new Map(
    rightDoc.results.map((result) => [normalizedText(result.analyte), result]),
  );
  const analytes = leftDoc.results
    .map((leftResult) => {
      const rightResult = rightByAnalyte.get(normalizedText(leftResult.analyte));
      if (!rightResult) return null;
      const leftPpb = resultToPpb(leftResult);
      const rightPpb = resultToPpb(rightResult);
      return {
        analyte: leftResult.analyte,
        left: { resultText: leftResult.resultText, unit: leftResult.unit, loqText: leftResult.loqText, ppb: leftPpb },
        right: { resultText: rightResult.resultText, unit: rightResult.unit, loqText: rightResult.loqText, ppb: rightPpb },
        unitCompatibility: leftPpb != null && rightPpb != null ? "normalized_to_ppb" : "requires_review",
        foldDifference: leftPpb != null && rightPpb != null && Math.min(leftPpb, rightPpb) > 0
          ? Math.max(leftPpb, rightPpb) / Math.min(leftPpb, rightPpb)
          : null,
      };
    })
    .filter(Boolean);
  const hardMismatch = context.some((item) => ["Sample name", "Lot number"].includes(item.field) && item.state === "different");
  const technicalReview = context.some((item) => ["Matrix", "Method"].includes(item.field) && item.state !== "aligned") || analytes.some((item) => item?.unitCompatibility !== "normalized_to_ppb");
  const comparisonStatus = left.sample || right.sample
    ? "demonstration_only"
    : hardMismatch || !analytes.length
      ? "not_comparable"
      : technicalReview
        ? "requires_scientific_review"
        : "metadata_aligned";
  return {
    comparisonStatus,
    context,
    analytes,
    missingContext: [
      "Sampling plan and representativeness",
      "Wet-weight or dry-weight reporting basis",
      "Measurement uncertainty",
      "Digestion and preparation details",
      "Quality-control and reference-material records",
    ],
    boundary: "This comparison identifies compatibility and missing context. It does not determine which laboratory is correct or whether a product complies with a limit.",
  };
}

export async function createDisputeCase(
  user: ChatGPTUser,
  input: { title?: unknown; purpose?: unknown; leftIdentifier?: unknown; rightIdentifier?: unknown },
) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) throw new TecAuthorizationError("Complete organization setup first.");
  const title = clean(input.title, 180);
  const purpose = clean(input.purpose, 600);
  const leftIdentifier = normalizeIdentifier(input.leftIdentifier);
  const rightIdentifier = normalizeIdentifier(input.rightIdentifier);
  if (!title || !leftIdentifier || !rightIdentifier) {
    throw new TecInputError("A case title and two TECRIDs are required.");
  }
  if (leftIdentifier === rightIdentifier) {
    throw new TecInputError("Choose two different TECRIDs for comparison.");
  }
  const [left, right] = await Promise.all([
    resolveDocument(leftIdentifier),
    resolveDocument(rightIdentifier),
  ]);
  if (!left || !right) throw new TecInputError("Both TECRIDs must resolve to public records.");
  if (left.sample || right.sample) {
    throw new TecInputError("Resolver samples cannot become evidence cases. Use two production TECRIDs or open the fictional demonstration.");
  }
  const comparison = compareDocuments(left, right);
  const createdAt = new Date().toISOString();
  const manifest = {
    type: "TECRIDDisputeEvidenceManifest",
    createdAt,
    left: left.document,
    right: right.document,
    comparison,
  };
  const manifestJson = JSON.stringify(manifest);
  const evidenceFingerprint = await sha256(manifestJson);
  const id = crypto.randomUUID();
  const db = getDb();
  await db.insert(disputeCases).values({
    id,
    organizationId: membership.organization.id,
    createdByUserId: user.userId,
    title,
    purpose: purpose || null,
    leftCredentialIdentifier: left.document.tecrid,
    rightCredentialIdentifier: right.document.tecrid,
    comparisonStatus: comparison.comparisonStatus,
    comparisonJson: JSON.stringify(comparison),
    evidenceManifestJson: manifestJson,
    evidenceFingerprint,
    createdAt,
    updatedAt: createdAt,
  });
  return { id, comparisonStatus: comparison.comparisonStatus, evidenceFingerprint };
}

export async function getDisputeCaseForUser(user: ChatGPTUser, caseIdValue: unknown) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) throw new TecAuthorizationError("Complete organization setup first.");
  const caseId = clean(caseIdValue, 100);
  const db = getDb();
  const [record] = await db
    .select()
    .from(disputeCases)
    .where(and(eq(disputeCases.id, caseId), eq(disputeCases.organizationId, membership.organization.id)))
    .limit(1);
  return record ?? null;
}
