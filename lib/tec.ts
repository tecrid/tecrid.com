import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../db";
import {
  apiKeys,
  auditEvents,
  billingEvents,
  credentialResults,
  credentialVersions,
  credentials,
  issuerApplications,
  organizationMembers,
  organizations,
} from "../db/schema";
import type { ChatGPTUser } from "../app/chatgpt-auth";

const ORGANIZATION_TYPES = new Set([
  "laboratory",
  "brand",
  "retailer",
  "consultant",
  "research",
  "other",
]);

export type CredentialResultInput = {
  analyte: string;
  symbol?: string;
  resultText: string;
  numericValue?: number | null;
  unit: string;
  loqText?: string;
  method?: string;
};

export type CredentialProofInput = {
  keyId: string;
  algorithm: "Ed25519";
  signature: string;
};

export type SourceDocumentInput = {
  sha256: string;
  filename: string;
  reportNumber?: string;
  orderNumber?: string;
  intakeId?: string;
  issuanceBasis?: string;
};

export type CredentialInput = {
  sampleName: string;
  lotNumber?: string;
  matrix?: string;
  method?: string;
  submittingParty?: string;
  collectedAt?: string;
  receivedAt?: string;
  testedAt?: string;
  releasedAt?: string;
  publish?: boolean;
  proof?: CredentialProofInput;
  sourceDocument?: SourceDocumentInput;
  results: CredentialResultInput[];
};

type CredentialCreationOptions = {
  legacyReportId?: string | null;
  issuanceBasis?: string | null;
};

export type CredentialRevisionInput = Partial<CredentialInput> & {
  action?: "correct" | "revoke";
  reason?: string;
};

export class TecInputError extends Error {
  status = 400;
}

export class TecAuthorizationError extends Error {
  status = 403;
}

export function isIcsAdmin(user: ChatGPTUser) {
  const configured = String(
    (env as unknown as Record<string, unknown>).ICS_ADMIN_EMAILS ?? "",
  )
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return configured.includes(user.email.toLowerCase());
}

function now() {
  return new Date().toISOString();
}

function randomCharacters(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function normalizeText(value: unknown, maximum = 180) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 52);
}

function issuerCodeFor(name: string) {
  const stem = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .padEnd(3, "X");
  return `${stem}${randomCharacters(3)}`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function normalizeProof(value: unknown): CredentialProofInput | undefined {
  if (!value || typeof value !== "object") return undefined;
  const proof = value as Partial<CredentialProofInput>;
  const keyId = normalizeText(proof.keyId, 180);
  const signature = normalizeText(proof.signature, 500);
  if (!keyId || !signature || proof.algorithm !== "Ed25519") return undefined;
  return { keyId, algorithm: "Ed25519", signature };
}

function issuerPayload(input: CredentialInput) {
  return {
    type: "TestEvidenceCredential",
    sampleName: input.sampleName,
    lotNumber: input.lotNumber ?? null,
    matrix: input.matrix ?? null,
    method: input.method ?? null,
    submittingParty: input.submittingParty ?? null,
    collectedAt: input.collectedAt ?? null,
    receivedAt: input.receivedAt ?? null,
    testedAt: input.testedAt ?? null,
    releasedAt: input.releasedAt ?? null,
    sourceDocument: input.sourceDocument
      ? {
          sha256: input.sourceDocument.sha256,
          filename: input.sourceDocument.filename,
          reportNumber: input.sourceDocument.reportNumber ?? null,
          orderNumber: input.sourceDocument.orderNumber ?? null,
          intakeId: input.sourceDocument.intakeId ?? null,
          issuanceBasis: input.sourceDocument.issuanceBasis ?? null,
        }
      : null,
    results: input.results.map((row) => ({
      analyte: row.analyte,
      symbol: row.symbol ?? null,
      resultText: row.resultText,
      numericValue: row.numericValue ?? null,
      unit: row.unit,
      loqText: row.loqText ?? null,
      method: row.method ?? input.method ?? null,
    })),
  };
}

function revisionPayload(
  identifier: string,
  version: number,
  previousFingerprint: string,
  action: "correct" | "revoke",
  reason: string,
  input: CredentialInput,
) {
  return {
    type: "TestEvidenceCredentialRevision",
    tecrid: identifier,
    version,
    previousFingerprint,
    action,
    reason,
    credential: issuerPayload(input),
  };
}

async function verifyIssuerProof(
  organization: typeof organizations.$inferSelect,
  payload: string,
  proof: CredentialProofInput | undefined,
) {
  if (!proof) {
    throw new TecAuthorizationError(
      "Public issuance requires an Ed25519 issuer signature over the canonical payload.",
    );
  }
  if (
    organization.issuerKeyAlgorithm !== "Ed25519" ||
    !organization.issuerPublicKeyJwk ||
    !organization.issuerKeyId ||
    !organization.issuerKeyVerifiedAt
  ) {
    throw new TecAuthorizationError(
      "The laboratory does not have an ICS-reviewed signing key on record.",
    );
  }
  if (proof.keyId !== organization.issuerKeyId || proof.algorithm !== "Ed25519") {
    throw new TecAuthorizationError("The proof does not match the issuer key on record.");
  }

  let publicKey: CryptoKey;
  let signature: Uint8Array;
  try {
    const jwk = JSON.parse(organization.issuerPublicKeyJwk) as JsonWebKey;
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.x) throw new Error();
    publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    signature = decodeBase64Url(proof.signature);
  } catch {
    throw new TecAuthorizationError("The issuer proof or registered public key is invalid.");
  }

  const valid = await crypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    signature,
    new TextEncoder().encode(payload),
  );
  if (!valid) {
    throw new TecAuthorizationError(
      "Issuer signature verification failed. The record was not published.",
    );
  }
  return {
    issuerSignature: proof.signature,
    issuerKeyId: proof.keyId,
    issuerPublicKeyJwk: organization.issuerPublicKeyJwk,
    issuerKeyVerifiedAt: organization.issuerKeyVerifiedAt,
    signatureAlgorithm: proof.algorithm,
    signedPayload: payload,
    signedPayloadHash: await sha256(payload),
  };
}

async function verifyStoredProof(proof: {
  issuerSignature: string | null;
  issuerKeyId: string | null;
  issuerPublicKeyJwk: string | null;
  issuerKeyVerifiedAt: string | null;
  signatureAlgorithm: string | null;
  signedPayload: string | null;
  signedPayloadHash: string | null;
}) {
  if (
    !proof.issuerSignature ||
    !proof.issuerKeyId ||
    !proof.issuerPublicKeyJwk ||
    !proof.issuerKeyVerifiedAt ||
    proof.signatureAlgorithm !== "Ed25519" ||
    !proof.signedPayload ||
    !proof.signedPayloadHash
  ) return false;
  try {
    if (await sha256(proof.signedPayload) !== proof.signedPayloadHash) return false;
    const jwk = JSON.parse(proof.issuerPublicKeyJwk) as JsonWebKey;
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.x || jwk.d) return false;
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      decodeBase64Url(proof.issuerSignature),
      new TextEncoder().encode(proof.signedPayload),
    );
  } catch {
    return false;
  }
}

function identifierCandidates(identifierValue: string) {
  const compact = identifierValue.trim().toUpperCase();
  const normalized = compact
    .replace(/^TECRID[:-]/, "TECRID·")
    .replace(/^TEC[:-]/, "TEC·");
  if (normalized.startsWith("TECRID·")) {
    return [normalized, normalized.replace(/^TECRID·/, "TEC·")];
  }
  if (normalized.startsWith("TEC·")) {
    return [normalized, normalized.replace(/^TEC·/, "TECRID·")];
  }
  return [`TECRID·${normalized}`, `TEC·${normalized}`];
}

export async function getOrganizationForUser(userId: string) {
  const db = getDb();
  const [membership] = await db
    .select({ organization: organizations, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .where(eq(organizationMembers.userId, userId))
    .limit(1);

  return membership ?? null;
}

export async function onboardOrganization(
  user: ChatGPTUser,
  input: { name?: unknown; organizationType?: unknown; website?: unknown },
) {
  const existing = await getOrganizationForUser(user.userId);
  if (existing) return existing;

  const name = normalizeText(input.name);
  const organizationType = normalizeText(input.organizationType, 32).toLowerCase();
  const website = normalizeText(input.website, 300) || null;

  if (name.length < 2) throw new TecInputError("Organization name is required.");
  if (!ORGANIZATION_TYPES.has(organizationType)) {
    throw new TecInputError("Choose a valid organization type.");
  }
  if (website) {
    try {
      const parsed = new URL(website);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      throw new TecInputError("Website must be a complete http or https URL.");
    }
  }

  const db = getDb();
  const organizationId = `org_${crypto.randomUUID().replaceAll("-", "")}`;
  const createdAt = now();
  const issuerCode = issuerCodeFor(name);
  const slug = `${slugify(name) || "organization"}-${randomCharacters(4).toLowerCase()}`;

  await db.insert(organizations).values({
    id: organizationId,
    name,
    slug,
    organizationType,
    website,
    ownerUserId: user.userId,
    ownerEmail: user.email.toLowerCase(),
    issuerCode,
    issuerStatus: organizationType === "laboratory" ? "pending" : "not_applicable",
    plan: "free",
    createdAt,
    updatedAt: createdAt,
  });
  await db.insert(organizationMembers).values({
    organizationId,
    userId: user.userId,
    email: user.email.toLowerCase(),
    role: "owner",
    createdAt,
  });
  await db.insert(auditEvents).values({
    id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
    organizationId,
    actorUserId: user.userId,
    eventType: "organization.created",
    entityType: "organization",
    entityId: organizationId,
    payload: JSON.stringify({ organizationType, issuerCode }),
    createdAt,
  });

  const [paidEvent] = await db
    .select()
    .from(billingEvents)
    .where(
      and(
        eq(billingEvents.customerEmail, user.email.toLowerCase()),
        eq(billingEvents.status, "pending"),
      ),
    )
    .orderBy(desc(billingEvents.createdAt))
    .limit(1);
  if (paidEvent) {
    await db
      .update(organizations)
      .set({
        plan: "founding",
        stripeCustomerId: paidEvent.customerId,
        stripeSubscriptionId: paidEvent.subscriptionId,
        updatedAt: now(),
      })
      .where(eq(organizations.id, organizationId));
    await db
      .update(billingEvents)
      .set({ status: "linked", organizationId, processedAt: now() })
      .where(eq(billingEvents.id, paidEvent.id));
  }

  return getOrganizationForUser(user.userId);
}

export async function getDashboardData(userId: string) {
  const membership = await getOrganizationForUser(userId);
  if (!membership) return null;

  const db = getDb();
  const records = await db
    .select()
    .from(credentials)
    .where(eq(credentials.organizationId, membership.organization.id))
    .orderBy(desc(credentials.createdAt))
    .limit(20);
  const keys = await db
    .select({
      id: apiKeys.id,
      label: apiKeys.label,
      keyPrefix: apiKeys.keyPrefix,
      lastFour: apiKeys.lastFour,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.organizationId, membership.organization.id))
    .orderBy(desc(apiKeys.createdAt));
  const [issuerApplication] = await db
    .select()
    .from(issuerApplications)
    .where(eq(issuerApplications.organizationId, membership.organization.id))
    .orderBy(desc(issuerApplications.submittedAt))
    .limit(1);

  return { ...membership, records, keys, issuerApplication: issuerApplication ?? null };
}

export async function submitIssuerApplication(
  user: ChatGPTUser,
  value: Record<string, unknown>,
) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership || membership.organization.organizationType !== "laboratory") {
    throw new TecAuthorizationError(
      "Only a laboratory organization can apply for TEC issuance authority.",
    );
  }

  const legalName = normalizeText(value.legalName, 180);
  const laboratoryAddress = normalizeText(value.laboratoryAddress, 300);
  const accreditationBody = normalizeText(value.accreditationBody, 180) || null;
  const accreditationNumber = normalizeText(value.accreditationNumber, 120) || null;
  const accreditationUrl = normalizeText(value.accreditationUrl, 300) || null;
  const scopeSummary = normalizeText(value.scopeSummary, 1800);
  const methodFamilies = normalizeText(value.methodFamilies, 1000);
  const contactName = normalizeText(value.contactName, 180);
  const contactEmail = normalizeText(value.contactEmail, 254).toLowerCase();
  const keyId = normalizeText(value.keyId, 180) || null;
  const publicKeyJwk = normalizeText(value.publicKeyJwk, 2000) || null;
  const attested = value.attested === true;

  if (
    !legalName ||
    !laboratoryAddress ||
    !scopeSummary ||
    !methodFamilies ||
    !contactName ||
    !contactEmail ||
    !attested
  ) {
    throw new TecInputError(
      "Legal identity, laboratory location, scope, methods, contact, and attestation are required.",
    );
  }
  if (!/^\S+@\S+\.\S+$/.test(contactEmail)) {
    throw new TecInputError("Enter a valid laboratory contact email.");
  }
  if (accreditationUrl) {
    try {
      const url = new URL(accreditationUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      throw new TecInputError("Accreditation URL must be a complete http or https URL.");
    }
  }

  let normalizedJwk: string | null = null;
  if (publicKeyJwk || keyId) {
    if (!publicKeyJwk || !keyId) {
      throw new TecInputError("Provide both an Ed25519 public JWK and its key ID.");
    }
    try {
      const jwk = JSON.parse(publicKeyJwk) as JsonWebKey;
      if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.x || jwk.d) {
        throw new Error();
      }
      normalizedJwk = JSON.stringify({
        kty: "OKP",
        crv: "Ed25519",
        x: jwk.x,
        use: "sig",
      });
    } catch {
      throw new TecInputError(
        "The signing key must be a public Ed25519 JWK and must not contain private key material.",
      );
    }
  }

  const db = getDb();
  const submittedAt = now();
  const id = `issuer_app_${crypto.randomUUID().replaceAll("-", "")}`;
  const applicationInsert = db.insert(issuerApplications).values({
    id,
    organizationId: membership.organization.id,
    legalName,
    laboratoryAddress,
    accreditationBody,
    accreditationNumber,
    accreditationUrl,
    scopeSummary,
    methodFamilies,
    contactName,
    contactEmail,
    publicKeyJwk: normalizedJwk,
    keyId,
    keyAlgorithm: normalizedJwk ? "Ed25519" : null,
    attested: true,
    status: "submitted",
    submittedAt,
  });
  const organizationUpdate = db
    .update(organizations)
    .set({ issuerStatus: "application_submitted", updatedAt: submittedAt })
    .where(eq(organizations.id, membership.organization.id));
  const auditInsert = db.insert(auditEvents).values({
    id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
    organizationId: membership.organization.id,
    actorUserId: user.userId,
    eventType: "issuer.application_submitted",
    entityType: "issuer_application",
    entityId: id,
    payload: JSON.stringify({
      accreditationBody,
      accreditationNumber,
      keyId,
      keySubmitted: Boolean(normalizedJwk),
    }),
    createdAt: submittedAt,
  });
  await db.batch([applicationInsert, organizationUpdate, auditInsert]);
  return { id, status: "submitted", submittedAt };
}

export async function listIssuerApplicationsForAdmin(user: ChatGPTUser) {
  if (!isIcsAdmin(user)) throw new TecAuthorizationError("ICS administrator access required.");
  const db = getDb();
  return db
    .select({
      application: issuerApplications,
      organizationName: organizations.name,
      organizationWebsite: organizations.website,
      issuerCode: organizations.issuerCode,
      issuerStatus: organizations.issuerStatus,
    })
    .from(issuerApplications)
    .innerJoin(
      organizations,
      eq(issuerApplications.organizationId, organizations.id),
    )
    .orderBy(desc(issuerApplications.submittedAt));
}

export async function reviewIssuerApplication(
  user: ChatGPTUser,
  applicationIdValue: string,
  value: Record<string, unknown>,
) {
  if (!isIcsAdmin(user)) throw new TecAuthorizationError("ICS administrator access required.");
  const applicationId = normalizeText(applicationIdValue, 120);
  const decision = normalizeText(value.decision, 32);
  const reviewNote = normalizeText(value.reviewNote, 1200);
  if (!applicationId || !["approve", "needs_information", "reject"].includes(decision)) {
    throw new TecInputError("Choose approve, needs_information, or reject.");
  }
  if (!reviewNote) throw new TecInputError("A review note is required.");

  const db = getDb();
  const [record] = await db
    .select({ application: issuerApplications, organization: organizations })
    .from(issuerApplications)
    .innerJoin(
      organizations,
      eq(issuerApplications.organizationId, organizations.id),
    )
    .where(eq(issuerApplications.id, applicationId))
    .limit(1);
  if (!record) throw new TecInputError("Issuer application not found.");
  if (decision === "approve" && (!record.application.publicKeyJwk || !record.application.keyId)) {
    throw new TecInputError(
      "Approval requires an Ed25519 public key and key ID in the application.",
    );
  }

  const reviewedAt = now();
  const applicationStatus =
    decision === "approve"
      ? "approved"
      : decision === "needs_information"
        ? "needs_information"
        : "rejected";
  const issuerStatus =
    decision === "approve"
      ? "verified"
      : decision === "needs_information"
        ? "needs_information"
        : "rejected";
  const applicationUpdate = db
    .update(issuerApplications)
    .set({
      status: applicationStatus,
      reviewedAt,
      reviewNote,
    })
    .where(eq(issuerApplications.id, applicationId));
  const organizationUpdate = db
    .update(organizations)
    .set({
      issuerStatus,
      issuerPublicKeyJwk:
        decision === "approve" ? record.application.publicKeyJwk : record.organization.issuerPublicKeyJwk,
      issuerKeyId:
        decision === "approve" ? record.application.keyId : record.organization.issuerKeyId,
      issuerKeyAlgorithm:
        decision === "approve" ? "Ed25519" : record.organization.issuerKeyAlgorithm,
      issuerKeyVerifiedAt:
        decision === "approve" ? reviewedAt : record.organization.issuerKeyVerifiedAt,
      updatedAt: reviewedAt,
    })
    .where(eq(organizations.id, record.organization.id));
  const auditInsert = db.insert(auditEvents).values({
    id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
    organizationId: record.organization.id,
    actorUserId: user.userId,
    eventType: `issuer.application_${applicationStatus}`,
    entityType: "issuer_application",
    entityId: applicationId,
    payload: JSON.stringify({
      decision,
      reviewNote,
      issuerCode: record.organization.issuerCode,
      keyId: record.application.keyId,
    }),
    createdAt: reviewedAt,
  });
  await db.batch([applicationUpdate, organizationUpdate, auditInsert]);
  return {
    id: applicationId,
    status: applicationStatus,
    issuerStatus,
    reviewedAt,
  };
}

export async function createApiKey(user: ChatGPTUser, labelValue: unknown) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) throw new TecAuthorizationError("Complete organization setup first.");

  const label = normalizeText(labelValue, 60) || "Default key";
  const secret = randomCharacters(42).toLowerCase();
  const plainTextKey = `tec_live_${secret}`;
  const keyHash = await sha256(plainTextKey);
  const createdAt = now();
  const id = `key_${crypto.randomUUID().replaceAll("-", "")}`;

  const db = getDb();
  await db.insert(apiKeys).values({
    id,
    organizationId: membership.organization.id,
    label,
    keyPrefix: plainTextKey.slice(0, 13),
    keyHash,
    lastFour: plainTextKey.slice(-4),
    createdByUserId: user.userId,
    createdAt,
  });
  await db.insert(auditEvents).values({
    id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
    organizationId: membership.organization.id,
    actorUserId: user.userId,
    eventType: "api_key.created",
    entityType: "api_key",
    entityId: id,
    payload: JSON.stringify({ label, prefix: plainTextKey.slice(0, 13) }),
    createdAt,
  });

  return { id, plainTextKey, label, createdAt };
}

export async function revokeApiKey(user: ChatGPTUser, keyIdValue: unknown) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) throw new TecAuthorizationError("Complete organization setup first.");
  const keyId = normalizeText(keyIdValue, 80);
  if (!keyId) throw new TecInputError("API key id is required.");

  const db = getDb();
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.organizationId, membership.organization.id),
      ),
    )
    .limit(1);
  if (!key) throw new TecAuthorizationError("API key not found for this organization.");

  const revokedAt = now();
  await db.update(apiKeys).set({ revokedAt }).where(eq(apiKeys.id, keyId));
  await db.insert(auditEvents).values({
    id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
    organizationId: membership.organization.id,
    actorUserId: user.userId,
    eventType: "api_key.revoked",
    entityType: "api_key",
    entityId: keyId,
    createdAt: revokedAt,
  });
  return { id: keyId, revokedAt };
}

export async function authenticateApiRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(tec_live_[a-z0-9]+)$/i);
  if (!match) throw new TecAuthorizationError("A valid TEC API bearer key is required.");

  const keyHash = await sha256(match[1]);
  const db = getDb();
  const [record] = await db
    .select({ key: apiKeys, organization: organizations })
    .from(apiKeys)
    .innerJoin(organizations, eq(apiKeys.organizationId, organizations.id))
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!record) throw new TecAuthorizationError("The TEC API key is invalid or revoked.");

  await db
    .update(apiKeys)
    .set({ lastUsedAt: now() })
    .where(eq(apiKeys.id, record.key.id));
  return record;
}

function validateCredentialInput(value: unknown): CredentialInput {
  const input = (value ?? {}) as Partial<CredentialInput>;
  const sampleName = normalizeText(input.sampleName);
  if (!sampleName) throw new TecInputError("sampleName is required.");
  if (!Array.isArray(input.results) || input.results.length === 0) {
    throw new TecInputError("At least one analytical result is required.");
  }
  if (input.results.length > 100) {
    throw new TecInputError("A credential may contain at most 100 results.");
  }

  const results = input.results.map((row, index) => {
    const analyte = normalizeText(row?.analyte, 100);
    const resultText = normalizeText(row?.resultText, 80);
    const unit = normalizeText(row?.unit, 40);
    if (!analyte || !resultText || !unit) {
      throw new TecInputError(
        `Result ${index + 1} requires analyte, resultText, and unit.`,
      );
    }
    return {
      analyte,
      symbol: normalizeText(row.symbol, 12) || undefined,
      resultText,
      numericValue:
        typeof row.numericValue === "number" && Number.isFinite(row.numericValue)
          ? row.numericValue
          : null,
      unit,
      loqText: normalizeText(row.loqText, 80) || undefined,
      method: normalizeText(row.method, 120) || undefined,
    };
  });

  let sourceDocument: SourceDocumentInput | undefined;
  if (input.sourceDocument) {
    if (typeof input.sourceDocument !== "object") {
      throw new TecInputError("sourceDocument must be an object.");
    }
    const sha = normalizeText(input.sourceDocument.sha256, 64).toLowerCase();
    const filename = normalizeText(input.sourceDocument.filename, 240);
    if (!/^[a-f0-9]{64}$/.test(sha) || !filename) {
      throw new TecInputError(
        "sourceDocument requires a lowercase SHA-256 fingerprint and filename.",
      );
    }
    sourceDocument = {
      sha256: sha,
      filename,
      reportNumber: normalizeText(input.sourceDocument.reportNumber, 120) || undefined,
      orderNumber: normalizeText(input.sourceDocument.orderNumber, 120) || undefined,
      intakeId: normalizeText(input.sourceDocument.intakeId, 120) || undefined,
      issuanceBasis:
        normalizeText(input.sourceDocument.issuanceBasis, 80) || undefined,
    };
  }

  return {
    sampleName,
    lotNumber: normalizeText(input.lotNumber, 120) || undefined,
    matrix: normalizeText(input.matrix, 120) || undefined,
    method: normalizeText(input.method, 160) || undefined,
    submittingParty: normalizeText(input.submittingParty, 160) || undefined,
    collectedAt: normalizeText(input.collectedAt, 40) || undefined,
    receivedAt: normalizeText(input.receivedAt, 40) || undefined,
    testedAt: normalizeText(input.testedAt, 40) || undefined,
    releasedAt: normalizeText(input.releasedAt, 40) || undefined,
    publish: Boolean(input.publish),
    proof: normalizeProof(input.proof),
    sourceDocument,
    results,
  };
}

export function canonicalizeCredential(value: unknown) {
  const input = validateCredentialInput(value);
  return {
    canonicalPayload: JSON.stringify(issuerPayload(input)),
    normalizedCredential: issuerPayload(input),
  };
}

export async function createCredential(
  organization: typeof organizations.$inferSelect,
  actorUserId: string | null,
  value: unknown,
  options: CredentialCreationOptions = {},
) {
  const input = validateCredentialInput(value);
  const canPublish =
    organization.organizationType === "laboratory" &&
    organization.issuerStatus === "verified";
  if (input.publish && !canPublish) {
    throw new TecAuthorizationError(
      "Only an ICS-verified laboratory issuer can publish a public TEC. This record can be saved as a draft.",
    );
  }

  const year = String(new Date().getUTCFullYear()).slice(-2);
  const identifier = `TECRID·${organization.issuerCode}-${year}-${randomCharacters(8)}`;
  const issued = Boolean(input.publish && canPublish);
  const createdAt = now();
  const signedPayload = JSON.stringify(issuerPayload(input));
  const proofDetails = issued
    ? await verifyIssuerProof(organization, signedPayload, input.proof)
    : null;
  const canonical = JSON.stringify({
    tecrid: identifier,
    issuer: organization.id,
    version: 1,
    status: issued ? "issued" : "draft",
    credential: issuerPayload(input),
    proof: proofDetails,
  });
  const fingerprint = issued ? await sha256(canonical) : null;
  const db = getDb();

  const credentialInsert = db.insert(credentials).values({
    identifier,
    organizationId: organization.id,
    status: issued ? "issued" : "draft",
    sampleName: input.sampleName,
    lotNumber: input.lotNumber ?? null,
    matrix: input.matrix ?? null,
    method: input.method ?? null,
    submittingParty: input.submittingParty ?? null,
    collectedAt: input.collectedAt ?? null,
    receivedAt: input.receivedAt ?? null,
    testedAt: input.testedAt ?? null,
    releasedAt: input.releasedAt ?? null,
    issuedAt: issued ? createdAt : null,
    version: 1,
    fingerprint,
    issuerSignature: proofDetails?.issuerSignature ?? null,
    issuerKeyId: proofDetails?.issuerKeyId ?? null,
    issuerPublicKeyJwk: proofDetails?.issuerPublicKeyJwk ?? null,
    issuerKeyVerifiedAt: proofDetails?.issuerKeyVerifiedAt ?? null,
    signatureAlgorithm: proofDetails?.signatureAlgorithm ?? null,
    signedPayload: proofDetails?.signedPayload ?? null,
    signedPayloadHash: proofDetails?.signedPayloadHash ?? null,
    legacyReportId: options.legacyReportId ?? null,
    sourceDocumentHash: input.sourceDocument?.sha256 ?? null,
    sourceDocumentName: input.sourceDocument?.filename ?? null,
    issuanceBasis:
      options.issuanceBasis ?? input.sourceDocument?.issuanceBasis ?? null,
    laboratoryReportNumber: input.sourceDocument?.reportNumber ?? null,
    laboratoryOrderNumber: input.sourceDocument?.orderNumber ?? null,
    publicRecord: issued,
    createdByUserId: actorUserId,
    createdAt,
    updatedAt: createdAt,
  });
  const resultInserts = input.results.map((row, sequence) =>
    db.insert(credentialResults).values({
      credentialIdentifier: identifier,
      analyte: row.analyte,
      symbol: row.symbol ?? null,
      resultText: row.resultText,
      numericValue: row.numericValue ?? null,
      unit: row.unit,
      loqText: row.loqText ?? null,
      method: row.method ?? input.method ?? null,
      sequence,
    }),
  );
  const versionInserts = issued && fingerprint
    ? [db.insert(credentialVersions).values({
      credentialIdentifier: identifier,
      version: 1,
      status: "issued",
      canonicalPayload: canonical,
      fingerprint,
      issuerSignature: proofDetails?.issuerSignature ?? null,
      issuerKeyId: proofDetails?.issuerKeyId ?? null,
      issuerPublicKeyJwk: proofDetails?.issuerPublicKeyJwk ?? null,
      issuerKeyVerifiedAt: proofDetails?.issuerKeyVerifiedAt ?? null,
      signatureAlgorithm: proofDetails?.signatureAlgorithm ?? null,
      signedPayload: proofDetails?.signedPayload ?? null,
      signedPayloadHash: proofDetails?.signedPayloadHash ?? null,
      changeType: "issuance",
      changeReason: "Original issuance",
      createdByUserId: actorUserId,
      createdAt,
    })]
    : [];
  const auditInsert = db.insert(auditEvents).values({
    id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
    organizationId: organization.id,
    actorUserId,
    eventType: issued ? "credential.issued" : "credential.draft_created",
    entityType: "credential",
    entityId: identifier,
    payload: JSON.stringify({
      resultCount: input.results.length,
      fingerprint,
      issuerKeyId: proofDetails?.issuerKeyId ?? null,
      signatureVerified: Boolean(proofDetails),
    }),
    createdAt,
  });
  await db.batch([
    credentialInsert,
    ...resultInserts,
    ...versionInserts,
    auditInsert,
  ]);

  return {
    tecrid: identifier,
    identifier,
    status: issued ? "issued" : "draft",
    fingerprint,
    signatureVerified: Boolean(proofDetails),
  };
}

export async function getCredential(identifierValue: string, includeDraft = false) {
  const [primaryIdentifier, compatibilityIdentifier] =
    identifierCandidates(identifierValue);
  const db = getDb();
  const identifierCondition = or(
    eq(credentials.identifier, primaryIdentifier),
    eq(credentials.identifier, compatibilityIdentifier),
  );
  const condition = includeDraft
    ? identifierCondition
    : and(
        identifierCondition,
        eq(credentials.publicRecord, true),
      );
  const [record] = await db
    .select({ credential: credentials, issuer: organizations })
    .from(credentials)
    .innerJoin(organizations, eq(credentials.organizationId, organizations.id))
    .where(condition)
    .limit(1);
  if (!record) return null;
  const identifier = record.credential.identifier;

  const results = await db
    .select()
    .from(credentialResults)
    .where(eq(credentialResults.credentialIdentifier, identifier))
    .orderBy(asc(credentialResults.sequence));
  const storedVersions = await db
    .select({
      version: credentialVersions.version,
      status: credentialVersions.status,
      fingerprint: credentialVersions.fingerprint,
      canonicalPayload: credentialVersions.canonicalPayload,
      issuerSignature: credentialVersions.issuerSignature,
      issuerKeyId: credentialVersions.issuerKeyId,
      issuerPublicKeyJwk: credentialVersions.issuerPublicKeyJwk,
      issuerKeyVerifiedAt: credentialVersions.issuerKeyVerifiedAt,
      signatureAlgorithm: credentialVersions.signatureAlgorithm,
      signedPayload: credentialVersions.signedPayload,
      signedPayloadHash: credentialVersions.signedPayloadHash,
      changeType: credentialVersions.changeType,
      changeReason: credentialVersions.changeReason,
      createdAt: credentialVersions.createdAt,
    })
    .from(credentialVersions)
    .where(eq(credentialVersions.credentialIdentifier, identifier))
    .orderBy(desc(credentialVersions.version));
  const versions = storedVersions.length
    ? storedVersions
    : record.credential.fingerprint
      ? [
          {
            version: record.credential.version,
            status: record.credential.status,
            fingerprint: record.credential.fingerprint,
            canonicalPayload: null,
            issuerSignature: record.credential.issuerSignature,
            issuerKeyId: record.credential.issuerKeyId,
            issuerPublicKeyJwk: record.credential.issuerPublicKeyJwk,
            issuerKeyVerifiedAt: record.credential.issuerKeyVerifiedAt,
            signatureAlgorithm: record.credential.signatureAlgorithm,
            signedPayload: record.credential.signedPayload,
            signedPayloadHash: record.credential.signedPayloadHash,
            changeType: "legacy_issuance",
            changeReason: "Issued before the version register was introduced",
            createdAt: record.credential.issuedAt ?? record.credential.createdAt,
          },
        ]
      : [];
  const currentVersion = storedVersions[0] ?? null;
  const fingerprintValid = Boolean(
    currentVersion &&
      (await sha256(currentVersion.canonicalPayload)) === currentVersion.fingerprint &&
      currentVersion.fingerprint === record.credential.fingerprint,
  );
  const currentVersionConsistent = Boolean(
    currentVersion &&
      currentVersion.version === record.credential.version &&
      currentVersion.status === record.credential.status,
  );
  const issuerSignatureVerified = currentVersion
    ? await verifyStoredProof(currentVersion)
    : false;
  return {
    ...record,
    results,
    versions,
    integrity: {
      fingerprintRecorded: Boolean(record.credential.fingerprint),
      fingerprintValid,
      issuerSignatureVerified,
      versionHistoryRecorded: storedVersions.length > 0,
      currentVersionConsistent,
    },
  };
}

export function publicCredentialDocument(
  record: NonNullable<Awaited<ReturnType<typeof getCredential>>>,
) {
  const { credential, issuer, results, versions, integrity } = record;
  return {
    schemaVersion: "tec-registry/1.0-draft",
    type: "TestEvidenceCredential",
    tecrid: credential.identifier,
    status: credential.status,
    version: credential.version,
    issuedAt: credential.issuedAt,
    updatedAt: credential.updatedAt,
    issuer: {
      code: issuer.issuerCode,
      name: issuer.name,
      status: issuer.issuerStatus,
      registryPath: `/issuers/${encodeURIComponent(issuer.issuerCode)}`,
    },
    subject: {
      sampleName: credential.sampleName,
      lotNumber: credential.lotNumber,
      matrix: credential.matrix,
      method: credential.method,
      collectedAt: credential.collectedAt,
      receivedAt: credential.receivedAt,
      testedAt: credential.testedAt,
      releasedAt: credential.releasedAt,
      submittingParty: credential.submittingParty,
    },
    sourceDocument: credential.sourceDocumentHash
      ? {
          sha256: credential.sourceDocumentHash,
          filename: credential.sourceDocumentName,
          reportNumber: credential.laboratoryReportNumber,
          orderNumber: credential.laboratoryOrderNumber,
          issuanceBasis: credential.issuanceBasis,
          publicDocument: false,
        }
      : null,
    results: results.map((row) => ({
      analyte: row.analyte,
      symbol: row.symbol,
      resultText: row.resultText,
      numericValue: row.numericValue,
      unit: row.unit,
      loqText: row.loqText,
      method: row.method,
      sequence: row.sequence,
    })),
    integrity: {
      ...integrity,
      fingerprintAlgorithm: credential.fingerprint ? "SHA-256" : null,
      fingerprint: credential.fingerprint,
      issuerProof:
        integrity.issuerSignatureVerified
          ? {
              algorithm: credential.signatureAlgorithm,
              keyId: credential.issuerKeyId,
              keyReviewedAt: credential.issuerKeyVerifiedAt,
              publicKeyJwk: credential.issuerPublicKeyJwk
                ? JSON.parse(credential.issuerPublicKeyJwk)
                : null,
              signature: credential.issuerSignature,
              signedPayload: credential.signedPayload,
              signedPayloadHash: credential.signedPayloadHash,
            }
          : null,
    },
    versions,
    links: {
      human: `/records/${encodeURIComponent(credential.identifier)}`,
      json: `/api/v1/credentials/${encodeURIComponent(credential.identifier)}`,
      issuer: `/issuers/${encodeURIComponent(issuer.issuerCode)}`,
    },
    interpretationBoundary:
      "This record establishes issuer attribution, content integrity, and status. It does not by itself establish representative sampling, method suitability, regulatory compliance, or product safety.",
  };
}

export async function createCredentialForUser(user: ChatGPTUser, value: unknown) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) throw new TecAuthorizationError("Complete organization setup first.");
  return createCredential(membership.organization, user.userId, value);
}

async function prepareCredentialRevision(
  organization: typeof organizations.$inferSelect,
  identifierValue: string,
  value: unknown,
) {
  const current = await getCredential(identifierValue, true);
  if (!current || current.credential.organizationId !== organization.id) {
    throw new TecAuthorizationError("The TECRID does not belong to this organization.");
  }
  if (!current.credential.publicRecord || !current.credential.fingerprint) {
    throw new TecInputError("Only an issued public TECRID can be corrected or revoked.");
  }
  const revision = (value ?? {}) as CredentialRevisionInput;
  const action = revision.action === "revoke" ? "revoke" : "correct";
  const reason = normalizeText(revision.reason, 600);
  if (!reason) throw new TecInputError("Every correction or revocation requires a public reason.");

  const preservedSourceDocument = current.credential.sourceDocumentHash
    ? {
        sha256: current.credential.sourceDocumentHash,
        filename: current.credential.sourceDocumentName || "source-report.pdf",
        reportNumber: current.credential.laboratoryReportNumber ?? undefined,
        orderNumber: current.credential.laboratoryOrderNumber ?? undefined,
        intakeId: current.credential.legacyReportId ?? undefined,
        issuanceBasis: current.credential.issuanceBasis ?? undefined,
      }
    : undefined;

  const input =
    action === "revoke"
      ? ({
          sampleName: current.credential.sampleName,
          lotNumber: current.credential.lotNumber ?? undefined,
          matrix: current.credential.matrix ?? undefined,
          method: current.credential.method ?? undefined,
          submittingParty: current.credential.submittingParty ?? undefined,
          collectedAt: current.credential.collectedAt ?? undefined,
          receivedAt: current.credential.receivedAt ?? undefined,
          testedAt: current.credential.testedAt ?? undefined,
          releasedAt: current.credential.releasedAt ?? undefined,
          publish: true,
          proof: normalizeProof(revision.proof),
          sourceDocument: preservedSourceDocument,
          results: current.results.map((row) => ({
            analyte: row.analyte,
            symbol: row.symbol ?? undefined,
            resultText: row.resultText,
            numericValue: row.numericValue,
            unit: row.unit,
            loqText: row.loqText ?? undefined,
            method: row.method ?? undefined,
          })),
        } satisfies CredentialInput)
      : validateCredentialInput({
          ...revision,
          publish: true,
          sourceDocument: preservedSourceDocument ?? revision.sourceDocument,
        });
  const version = current.credential.version + 1;
  const canonicalPayload = JSON.stringify(
    revisionPayload(
      current.credential.identifier,
      version,
      current.credential.fingerprint,
      action,
      reason,
      input,
    ),
  );
  return { current, input, action, reason, version, canonicalPayload };
}

export async function canonicalizeCredentialRevision(
  organization: typeof organizations.$inferSelect,
  identifierValue: string,
  value: unknown,
) {
  const prepared = await prepareCredentialRevision(
    organization,
    identifierValue,
    value,
  );
  return {
    tecrid: prepared.current.credential.identifier,
    version: prepared.version,
    action: prepared.action,
    canonicalPayload: prepared.canonicalPayload,
    normalizedRevision: JSON.parse(prepared.canonicalPayload),
  };
}

export async function createCredentialRevision(
  organization: typeof organizations.$inferSelect,
  actorUserId: string | null,
  identifierValue: string,
  value: unknown,
) {
  if (
    organization.organizationType !== "laboratory" ||
    organization.issuerStatus !== "verified"
  ) {
    throw new TecAuthorizationError(
      "Only an ICS-verified laboratory issuer can revise a public TECRID.",
    );
  }
  const prepared = await prepareCredentialRevision(
    organization,
    identifierValue,
    value,
  );
  const proof = normalizeProof((value as CredentialRevisionInput | null)?.proof);
  const proofDetails = await verifyIssuerProof(
    organization,
    prepared.canonicalPayload,
    proof,
  );
  const status = prepared.action === "revoke" ? "revoked" : "issued";
  const createdAt = now();
  const registryPayload = JSON.stringify({
    revision: JSON.parse(prepared.canonicalPayload),
    status,
    proof: proofDetails,
  });
  const fingerprint = await sha256(registryPayload);
  const identifier = prepared.current.credential.identifier;
  const db = getDb();

  const versionInsert = db.insert(credentialVersions).values({
    credentialIdentifier: identifier,
    version: prepared.version,
    status,
    canonicalPayload: registryPayload,
    fingerprint,
    issuerSignature: proofDetails.issuerSignature,
    issuerKeyId: proofDetails.issuerKeyId,
    issuerPublicKeyJwk: proofDetails.issuerPublicKeyJwk,
    issuerKeyVerifiedAt: proofDetails.issuerKeyVerifiedAt,
    signatureAlgorithm: proofDetails.signatureAlgorithm,
    signedPayload: proofDetails.signedPayload,
    signedPayloadHash: proofDetails.signedPayloadHash,
    changeType: prepared.action === "revoke" ? "revocation" : "correction",
    changeReason: prepared.reason,
    createdByUserId: actorUserId,
    createdAt,
  });

  const credentialUpdate = db
    .update(credentials)
    .set({
      status,
      sampleName: prepared.input.sampleName,
      lotNumber: prepared.input.lotNumber ?? null,
      matrix: prepared.input.matrix ?? null,
      method: prepared.input.method ?? null,
      submittingParty: prepared.input.submittingParty ?? null,
      collectedAt: prepared.input.collectedAt ?? null,
      receivedAt: prepared.input.receivedAt ?? null,
      testedAt: prepared.input.testedAt ?? null,
      releasedAt: prepared.input.releasedAt ?? null,
      version: prepared.version,
      fingerprint,
      issuerSignature: proofDetails.issuerSignature,
      issuerKeyId: proofDetails.issuerKeyId,
      issuerPublicKeyJwk: proofDetails.issuerPublicKeyJwk,
      issuerKeyVerifiedAt: proofDetails.issuerKeyVerifiedAt,
      signatureAlgorithm: proofDetails.signatureAlgorithm,
      signedPayload: proofDetails.signedPayload,
      signedPayloadHash: proofDetails.signedPayloadHash,
      updatedAt: createdAt,
    })
    .where(eq(credentials.identifier, identifier));

  const resultStatements = prepared.action === "correct"
    ? [
        db.delete(credentialResults).where(
          eq(credentialResults.credentialIdentifier, identifier),
        ),
        db.insert(credentialResults).values(
          prepared.input.results.map((row, sequence) => ({
        credentialIdentifier: identifier,
        analyte: row.analyte,
        symbol: row.symbol ?? null,
        resultText: row.resultText,
        numericValue: row.numericValue ?? null,
        unit: row.unit,
        loqText: row.loqText ?? null,
        method: row.method ?? prepared.input.method ?? null,
        sequence,
          })),
        ),
      ]
    : [];
  const auditInsert = db.insert(auditEvents).values({
    id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
    organizationId: organization.id,
    actorUserId,
    eventType:
      prepared.action === "revoke" ? "credential.revoked" : "credential.corrected",
    entityType: "credential",
    entityId: identifier,
    payload: JSON.stringify({
      version: prepared.version,
      reason: prepared.reason,
      previousFingerprint: prepared.current.credential.fingerprint,
      fingerprint,
      issuerKeyId: proofDetails.issuerKeyId,
    }),
    createdAt,
  });
  await db.batch([
    versionInsert,
    credentialUpdate,
    ...resultStatements,
    auditInsert,
  ]);
  return {
    tecrid: identifier,
    identifier,
    version: prepared.version,
    status,
    fingerprint,
    signatureVerified: true,
  };
}

export async function listCredentialsForApi(organizationId: string) {
  const db = getDb();
  return db
    .select({
      identifier: credentials.identifier,
      status: credentials.status,
      sampleName: credentials.sampleName,
      lotNumber: credentials.lotNumber,
      issuedAt: credentials.issuedAt,
      version: credentials.version,
      publicRecord: credentials.publicRecord,
      createdAt: credentials.createdAt,
    })
    .from(credentials)
    .where(eq(credentials.organizationId, organizationId))
    .orderBy(desc(credentials.createdAt))
    .limit(100);
}

export async function getIssuer(issuerCodeValue: string) {
  const issuerCode = normalizeText(issuerCodeValue, 32).toUpperCase();
  if (!issuerCode) return null;
  const db = getDb();
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.issuerCode, issuerCode))
    .limit(1);
  if (!organization) return null;
  const [application] = await db
    .select({
      legalName: issuerApplications.legalName,
      accreditationBody: issuerApplications.accreditationBody,
      accreditationNumber: issuerApplications.accreditationNumber,
      accreditationUrl: issuerApplications.accreditationUrl,
      scopeSummary: issuerApplications.scopeSummary,
      methodFamilies: issuerApplications.methodFamilies,
      status: issuerApplications.status,
      submittedAt: issuerApplications.submittedAt,
      reviewedAt: issuerApplications.reviewedAt,
    })
    .from(issuerApplications)
    .where(eq(issuerApplications.organizationId, organization.id))
    .orderBy(desc(issuerApplications.submittedAt))
    .limit(1);
  return {
    issuerCode: organization.issuerCode,
    name: organization.name,
    legalName: application?.legalName ?? organization.name,
    website: organization.website,
    issuerStatus: organization.issuerStatus,
    accreditation:
      organization.issuerStatus === "verified"
        ? {
            body: application?.accreditationBody ?? null,
            number: application?.accreditationNumber ?? null,
            url: application?.accreditationUrl ?? null,
          }
        : null,
    verifiedScope:
      organization.issuerStatus === "verified"
        ? {
            summary: application?.scopeSummary ?? null,
            methodFamilies: application?.methodFamilies ?? null,
          }
        : null,
    signingKey:
      organization.issuerStatus === "verified" && organization.issuerKeyVerifiedAt
        ? {
            keyId: organization.issuerKeyId,
            algorithm: organization.issuerKeyAlgorithm,
            verifiedAt: organization.issuerKeyVerifiedAt,
            publicKeyJwk: organization.issuerPublicKeyJwk
              ? JSON.parse(organization.issuerPublicKeyJwk)
              : null,
          }
        : null,
  };
}

export async function listVerifiedIssuers() {
  const db = getDb();
  return db
    .select({
      issuerCode: organizations.issuerCode,
      name: organizations.name,
      website: organizations.website,
      issuerKeyId: organizations.issuerKeyId,
      issuerKeyAlgorithm: organizations.issuerKeyAlgorithm,
      issuerKeyVerifiedAt: organizations.issuerKeyVerifiedAt,
    })
    .from(organizations)
    .where(eq(organizations.issuerStatus, "verified"))
    .orderBy(asc(organizations.name));
}

export async function processStripeEvent(event: {
  id: string;
  type: string;
  created?: number;
  data?: { object?: Record<string, unknown> };
}) {
  const db = getDb();
  const object = event.data?.object ?? {};
  const existing = await db
    .select({ id: billingEvents.id })
    .from(billingEvents)
    .where(eq(billingEvents.id, event.id))
    .limit(1);
  if (existing.length) return { duplicate: true };

  if (event.type === "checkout.session.completed") {
    const customerDetails = (object.customer_details ?? {}) as Record<string, unknown>;
    const customerEmail = normalizeText(customerDetails.email, 254).toLowerCase() || null;
    const customerId = typeof object.customer === "string" ? object.customer : null;
    const subscriptionId = typeof object.subscription === "string" ? object.subscription : null;
    const paymentLinkId = typeof object.payment_link === "string" ? object.payment_link : null;
    const [organization] = customerEmail
      ? await db
          .select()
          .from(organizations)
          .where(eq(organizations.ownerEmail, customerEmail))
          .limit(1)
      : [];
    const processedAt = now();

    await db.insert(billingEvents).values({
      id: event.id,
      eventType: event.type,
      paymentLinkId,
      customerEmail,
      customerId,
      subscriptionId,
      amountTotal: typeof object.amount_total === "number" ? object.amount_total : null,
      currency: typeof object.currency === "string" ? object.currency : null,
      status: organization ? "linked" : "pending",
      organizationId: organization?.id ?? null,
      payload: JSON.stringify({ mode: object.mode, payment_status: object.payment_status }),
      createdAt: event.created ? new Date(event.created * 1000).toISOString() : processedAt,
      processedAt,
    });
    if (organization) {
      await db
        .update(organizations)
        .set({
          plan: "founding",
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          updatedAt: processedAt,
        })
        .where(eq(organizations.id, organization.id));
      await db.insert(auditEvents).values({
        id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
        organizationId: organization.id,
        eventType: "billing.founding_membership_started",
        entityType: "subscription",
        entityId: subscriptionId ?? event.id,
        createdAt: processedAt,
      });
    }
    return { processed: true, linked: Boolean(organization) };
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscriptionId = typeof object.id === "string" ? object.id : null;
    const subscriptionStatus = typeof object.status === "string" ? object.status : "unknown";
    const active = ["active", "trialing", "past_due"].includes(subscriptionStatus);
    const [organization] = subscriptionId
      ? await db
          .select()
          .from(organizations)
          .where(eq(organizations.stripeSubscriptionId, subscriptionId))
          .limit(1)
      : [];
    const processedAt = now();
    await db.insert(billingEvents).values({
      id: event.id,
      eventType: event.type,
      subscriptionId,
      status: organization ? "linked" : "unmatched",
      organizationId: organization?.id ?? null,
      payload: JSON.stringify({ subscription_status: subscriptionStatus }),
      createdAt: event.created ? new Date(event.created * 1000).toISOString() : processedAt,
      processedAt,
    });
    if (organization) {
      await db
        .update(organizations)
        .set({ plan: active ? "founding" : "free", updatedAt: processedAt })
        .where(eq(organizations.id, organization.id));
    }
    return { processed: true, linked: Boolean(organization) };
  }

  await db.insert(billingEvents).values({
    id: event.id,
    eventType: event.type,
    status: "ignored",
    payload: JSON.stringify({ object: object.object ?? null }),
    createdAt: event.created ? new Date(event.created * 1000).toISOString() : now(),
    processedAt: now(),
  });
  return { processed: false };
}
