import { and, desc, eq, or } from "drizzle-orm";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import {
  auditEvents,
  controllerEvidenceReceipts,
  evidenceShareCodes,
  evidenceShareRedemptions,
  laboratoryInvitations,
  organizationNotifications,
  organizations,
  participantProfiles,
} from "../db/schema";
import {
  getOrganizationForUser,
  TecAuthorizationError,
  TecInputError,
} from "./tec";

const CONTROLLER_TYPES = new Set(["brand", "supplier"]);
const RECIPIENT_TYPES = new Set(["certification_body", "retailer", "government"]);
const SCOPE_MODES = new Set(["tecrid_set", "sku_set", "portfolio"]);
const ACCESS_LEVELS = new Set(["status_only", "selected_analytes", "full_record"]);

function clean(value: unknown, maximum = 240) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function normalizeCode(value: unknown) {
  return clean(value, 24).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeList(value: unknown, maximum = 100) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]/)
      : [];
  return [...new Set(values.map((item) => clean(item, maximum)).filter(Boolean))].slice(0, 100);
}

function normalizeSku(value: string) {
  return value.toUpperCase().replace(/\s+/g, "-");
}

function randomToken(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function requireMembership(user: ChatGPTUser) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) throw new TecAuthorizationError("Complete organization setup first.");
  return membership;
}

async function organizationByCode(codeValue: unknown) {
  const code = normalizeCode(codeValue);
  if (!code) throw new TecInputError("A recipient organization code is required.");
  const db = getDb();
  const [organization] = await db.select().from(organizations).where(eq(organizations.issuerCode, code)).limit(1);
  if (!organization) throw new TecInputError("No TECRID organization matches that code.");
  return organization;
}

function shareScope(input: Record<string, unknown>) {
  const scopeMode = clean(input.scopeMode, 40) || "sku_set";
  if (!SCOPE_MODES.has(scopeMode)) throw new TecInputError("Choose a valid share scope.");
  const rawValues = normalizeList(input.scopeValues, 120);
  const values = scopeMode === "sku_set"
    ? rawValues.map(normalizeSku)
    : scopeMode === "tecrid_set"
      ? rawValues.map((value) => value.toUpperCase())
      : [];
  if (scopeMode !== "portfolio" && !values.length) {
    throw new TecInputError("Add at least one SKU or TECRID to this share package.");
  }
  if (scopeMode === "portfolio" && clean(input.confirmPortfolio, 10) !== "yes") {
    throw new TecInputError("Confirm that this recipient should receive the full current portfolio.");
  }
  return { scopeMode, values };
}

function shareAccess(input: Record<string, unknown>) {
  const accessLevel = clean(input.accessLevel, 40) || "selected_analytes";
  if (!ACCESS_LEVELS.has(accessLevel)) throw new TecInputError("Choose a valid result access level.");
  const analytes = normalizeList(input.analytes, 100);
  if (accessLevel === "selected_analytes" && !analytes.length) {
    throw new TecInputError("Selected-analyte access requires at least one analyte.");
  }
  return { accessLevel, analytes };
}

export async function createEvidenceShareCode(user: ChatGPTUser, input: Record<string, unknown>) {
  const membership = await requireMembership(user);
  if (!CONTROLLER_TYPES.has(membership.organization.organizationType)) {
    throw new TecAuthorizationError("Only a brand or ingredient supplier can create evidence share codes.");
  }
  const recipient = await organizationByCode(input.recipientOrganizationCode);
  if (!RECIPIENT_TYPES.has(recipient.organizationType)) {
    throw new TecInputError("Share codes may be addressed to a certification body, retailer, or government workspace.");
  }
  if (recipient.id === membership.organization.id) throw new TecInputError("A controller cannot share evidence with itself.");
  const label = clean(input.label, 140);
  const purpose = clean(input.purpose, 500);
  if (!label || !purpose) throw new TecInputError("A package name and purpose are required.");
  const scope = shareScope(input);
  const access = shareAccess(input);
  const requestedDays = Number(input.expiresInDays);
  const maximumDays = scope.scopeMode === "portfolio" ? 30 : 90;
  const days = Number.isFinite(requestedDays)
    ? Math.max(1, Math.min(maximumDays, Math.round(requestedDays)))
    : Math.min(30, maximumDays);
  const plainTextCode = `tec_share_${randomToken(38)}`;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
  const id = crypto.randomUUID();
  const db = getDb();
  await db.batch([
    db.insert(evidenceShareCodes).values({
      id,
      controllerOrganizationId: membership.organization.id,
      recipientOrganizationId: recipient.id,
      label,
      purpose,
      scopeMode: scope.scopeMode,
      scopeJson: JSON.stringify(scope.values),
      accessLevel: access.accessLevel,
      analyteScopeJson: access.accessLevel === "selected_analytes" ? JSON.stringify(access.analytes) : null,
      tokenHash: await sha256(plainTextCode),
      tokenPrefix: plainTextCode.slice(0, 16),
      tokenLastFour: plainTextCode.slice(-4),
      createdByUserId: user.userId,
      createdAt,
      expiresAt,
    }),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      organizationId: membership.organization.id,
      actorUserId: user.userId,
      eventType: "evidence_share.created",
      entityType: "evidence_share_code",
      entityId: id,
      payload: JSON.stringify({ recipientOrganizationId: recipient.id, ...scope, ...access, expiresAt }),
      createdAt,
    }),
  ]);
  return {
    id,
    plainTextCode,
    recipient: recipient.name,
    recipientCode: recipient.issuerCode,
    ...scope,
    ...access,
    expiresAt,
  };
}

export async function revokeEvidenceShareCode(user: ChatGPTUser, idValue: unknown) {
  const membership = await requireMembership(user);
  const id = clean(idValue, 100);
  const db = getDb();
  const [record] = await db.select().from(evidenceShareCodes).where(and(
    eq(evidenceShareCodes.id, id),
    eq(evidenceShareCodes.controllerOrganizationId, membership.organization.id),
  )).limit(1);
  if (!record || record.status !== "active") throw new TecAuthorizationError("Active share code not found for this controller.");
  const revokedAt = new Date().toISOString();
  await db.batch([
    db.update(evidenceShareCodes).set({ status: "revoked", revokedAt, revokedByUserId: user.userId }).where(eq(evidenceShareCodes.id, record.id)),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(), organizationId: membership.organization.id, actorUserId: user.userId,
      eventType: "evidence_share.revoked", entityType: "evidence_share_code", entityId: record.id,
      payload: JSON.stringify({ recipientOrganizationId: record.recipientOrganizationId }), createdAt: revokedAt,
    }),
  ]);
  return { id: record.id, status: "revoked", revokedAt };
}

type ReceiptSnapshot = {
  tecrid?: string;
  identifier?: string;
  status?: string;
  version?: number;
  issuedAt?: string;
  record?: { identifier?: string; status?: string; version?: number; issuedAt?: string };
  issuer?: { name?: string; code?: string };
  subject?: { sampleName?: string; productSku?: string | null; lotNumber?: string | null; matrix?: string | null };
  sourceDocument?: Record<string, unknown> | null;
  results?: Array<Record<string, unknown> & { analyte?: string }>;
  integrity?: Record<string, unknown>;
};

function projectReceipt(snapshot: ReceiptSnapshot, accessLevel: string, analytes: string[]) {
  const allowed = new Set(analytes.map((item) => item.toLowerCase()));
  const results = accessLevel === "status_only"
    ? []
    : accessLevel === "selected_analytes"
      ? (snapshot.results ?? []).filter((row) => row.analyte && allowed.has(row.analyte.toLowerCase()))
      : (snapshot.results ?? []);
  const rawIntegrity = snapshot.integrity ?? {};
  const rawProof = rawIntegrity.issuerProof && typeof rawIntegrity.issuerProof === "object"
    ? rawIntegrity.issuerProof as Record<string, unknown>
    : null;
  const scopedIntegrity = accessLevel === "full_record"
    ? rawIntegrity
    : {
        fingerprintRecorded: rawIntegrity.fingerprintRecorded ?? null,
        fingerprintValid: rawIntegrity.fingerprintValid ?? null,
        issuerSignatureVerified: rawIntegrity.issuerSignatureVerified ?? null,
        versionHistoryRecorded: rawIntegrity.versionHistoryRecorded ?? null,
        currentVersionConsistent: rawIntegrity.currentVersionConsistent ?? null,
        fingerprintAlgorithm: rawIntegrity.fingerprintAlgorithm ?? null,
        fingerprint: rawIntegrity.fingerprint ?? null,
        issuerProof: rawProof ? {
          algorithm: rawProof.algorithm ?? null,
          keyId: rawProof.keyId ?? null,
          keyReviewedAt: rawProof.keyReviewedAt ?? null,
          publicKeyJwk: rawProof.publicKeyJwk ?? null,
          signature: rawProof.signature ?? null,
          signedPayload: null,
          signedPayloadHash: rawProof.signedPayloadHash ?? null,
          payloadWithheld: true,
        } : null,
      };
  return {
    tecrid: snapshot.record?.identifier ?? snapshot.tecrid ?? snapshot.identifier ?? null,
    version: snapshot.record?.version ?? snapshot.version ?? null,
    status: snapshot.record?.status ?? snapshot.status ?? "issued",
    issuedAt: snapshot.record?.issuedAt ?? snapshot.issuedAt ?? null,
    issuer: snapshot.issuer ?? null,
    subject: snapshot.subject ?? null,
    results,
    resultAccess: {
      level: accessLevel,
      requestedAnalytes: accessLevel === "selected_analytes" ? analytes : [],
      deliveredAnalytes: results.map((row) => row.analyte).filter(Boolean),
    },
    sourceDocument: accessLevel === "full_record" ? (snapshot.sourceDocument ?? null) : null,
    integrity: scopedIntegrity,
  };
}

export async function redeemEvidenceShareCode(input: Record<string, unknown>) {
  const token = clean(input.code, 120);
  if (!/^tec_share_[A-Za-z0-9]+$/.test(token)) throw new TecAuthorizationError("A valid TECRID share code is required.");
  const recipientCode = normalizeCode(input.recipientOrganizationCode);
  if (!recipientCode) throw new TecAuthorizationError("The receiving organization code is required.");
  const db = getDb();
  const [match] = await db
    .select({ share: evidenceShareCodes, controller: organizations })
    .from(evidenceShareCodes)
    .innerJoin(organizations, eq(evidenceShareCodes.controllerOrganizationId, organizations.id))
    .where(eq(evidenceShareCodes.tokenHash, await sha256(token)))
    .limit(1);
  if (!match) throw new TecAuthorizationError("This share code is invalid, expired, or revoked.");
  const [recipient] = await db.select().from(organizations).where(and(
    eq(organizations.id, match.share.recipientOrganizationId),
    eq(organizations.issuerCode, recipientCode),
  )).limit(1);
  if (!recipient) throw new TecAuthorizationError("This code was issued to a different receiving organization.");
  if (match.share.status === "redeemed") {
    const [existing] = await db.select().from(evidenceShareRedemptions).where(eq(evidenceShareRedemptions.shareCodeId, match.share.id)).limit(1);
    if (!existing) throw new TecAuthorizationError("This code has been redeemed but its receipt is unavailable.");
    return {
      ...(JSON.parse(existing.packageJson) as Record<string, unknown>),
      receipt: { id: existing.id, packageFingerprint: existing.packageFingerprint, recordCount: existing.recordCount, replayed: true },
    };
  }
  if (match.share.status !== "active" || new Date(match.share.expiresAt).getTime() <= Date.now()) {
    throw new TecAuthorizationError("This share code is invalid, expired, or revoked.");
  }
  const scopeValues = normalizeList(JSON.parse(match.share.scopeJson), 120);
  const analytes = normalizeList(match.share.analyteScopeJson ? JSON.parse(match.share.analyteScopeJson) : [], 100);
  const receipts = await db
    .select({ receipt: controllerEvidenceReceipts, laboratory: organizations })
    .from(controllerEvidenceReceipts)
    .innerJoin(organizations, eq(controllerEvidenceReceipts.laboratoryOrganizationId, organizations.id))
    .where(eq(controllerEvidenceReceipts.controllerOrganizationId, match.share.controllerOrganizationId))
    .orderBy(desc(controllerEvidenceReceipts.deliveredAt));
  const scoped = receipts.filter(({ receipt }) => {
    const snapshot = JSON.parse(receipt.snapshotJson) as ReceiptSnapshot;
    const identifier = (snapshot.record?.identifier ?? receipt.credentialIdentifier).toUpperCase();
    const sku = normalizeSku(snapshot.subject?.productSku ?? "");
    if (match.share.scopeMode === "portfolio") return true;
    if (match.share.scopeMode === "tecrid_set") return scopeValues.includes(identifier);
    return scopeValues.includes(sku);
  });
  if (!scoped.length) {
    throw new TecInputError("No current lab-issued TECRID receipts match this code's approved scope.");
  }
  const redeemedAt = new Date().toISOString();
  const evidence = scoped.map(({ receipt, laboratory }) => ({
    ...projectReceipt(JSON.parse(receipt.snapshotJson) as ReceiptSnapshot, match.share.accessLevel, analytes),
    laboratory: { name: laboratory.name, code: laboratory.issuerCode },
    controllerReceiptFingerprint: receipt.snapshotFingerprint,
    receivedByControllerAt: receipt.deliveredAt,
  }));
  const packageValue = {
    schemaVersion: "tecrid-share-package/1.0",
    grant: {
      id: match.share.id,
      label: match.share.label,
      purpose: match.share.purpose,
      controller: { name: match.controller.name, code: match.controller.issuerCode },
      recipient: { name: recipient.name, code: recipient.issuerCode },
      scopeMode: match.share.scopeMode,
      scopeValues,
      accessLevel: match.share.accessLevel,
      analytes,
      createdAt: match.share.createdAt,
      expiresAt: match.share.expiresAt,
      redeemedAt,
      onwardSharing: "prohibited",
      rawDocumentsIncluded: false,
    },
    evidence,
  };
  const packageJson = JSON.stringify(packageValue);
  const packageFingerprint = await sha256(packageJson);
  const redemptionId = crypto.randomUUID();
  await db.batch([
    db.insert(evidenceShareRedemptions).values({
      id: redemptionId,
      shareCodeId: match.share.id,
      controllerOrganizationId: match.share.controllerOrganizationId,
      recipientOrganizationId: recipient.id,
      packageJson,
      packageFingerprint,
      recordCount: evidence.length,
      redeemedAt,
    }),
    db.update(evidenceShareCodes).set({ status: "redeemed", redeemedAt }).where(and(
      eq(evidenceShareCodes.id, match.share.id),
      eq(evidenceShareCodes.status, "active"),
    )),
    db.insert(organizationNotifications).values({
      id: crypto.randomUUID(), organizationId: match.share.controllerOrganizationId,
      eventType: "evidence_share.redeemed", title: `${recipient.name} redeemed ${match.share.label}`,
      body: `${evidence.length} scoped TECRID record${evidence.length === 1 ? " was" : "s were"} delivered. Raw report files were not included.`,
      actionPath: "/dashboard/sharing", entityType: "evidence_share_redemption", entityId: redemptionId, createdAt: redeemedAt,
    }),
    db.insert(organizationNotifications).values({
      id: crypto.randomUUID(), organizationId: recipient.id,
      eventType: "evidence_share.received", title: `Evidence received from ${match.controller.name}`,
      body: `${evidence.length} scoped TECRID record${evidence.length === 1 ? " is" : "s are"} available with package fingerprint ${packageFingerprint.slice(0, 12)}.`,
      actionPath: "/dashboard/sharing", entityType: "evidence_share_redemption", entityId: redemptionId, createdAt: redeemedAt,
    }),
  ]);
  return { ...packageValue, receipt: { id: redemptionId, packageFingerprint, recordCount: evidence.length } };
}

export async function createLaboratoryInvitation(user: ChatGPTUser, input: Record<string, unknown>) {
  const membership = await requireMembership(user);
  if (!CONTROLLER_TYPES.has(membership.organization.organizationType)) {
    throw new TecAuthorizationError("Only a brand or ingredient supplier can invite its laboratory.");
  }
  const laboratoryName = clean(input.laboratoryName, 180);
  const laboratoryEmail = clean(input.laboratoryEmail, 180).toLowerCase();
  const skus = normalizeList(input.productSkus, 100).map(normalizeSku);
  if (!laboratoryName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(laboratoryEmail)) {
    throw new TecInputError("A laboratory name and valid email address are required.");
  }
  const message = clean(input.message, 1200) || `${membership.organization.name} would like laboratory-issued TECRIDs for ${skus.length ? skus.join(", ") : "its tested products"}.`;
  const createdAt = new Date().toISOString();
  const id = crypto.randomUUID();
  const subject = `${membership.organization.name} requests TECRID delivery`;
  const body = `${laboratoryName},\n\n${message}\n\nTECRID lets your laboratory reserve an identifier, print it on the final report, and deliver the signed structured findings directly to us. Laboratory enrollment and verification are free.\n\nJoin: https://tecrid.com/join\nIntegration guide: https://github.com/tecrid/tecrid-connect\nOur TECRID organization code: ${membership.organization.issuerCode}`;
  const mailto = `mailto:${encodeURIComponent(laboratoryEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const db = getDb();
  await db.insert(laboratoryInvitations).values({
    id,
    controllerOrganizationId: membership.organization.id,
    laboratoryName,
    laboratoryEmail,
    productSkusJson: JSON.stringify(skus),
    message,
    createdByUserId: user.userId,
    createdAt,
  });
  return { id, status: "drafted", laboratoryName, laboratoryEmail, skus, mailto, createdAt };
}

export async function listSharingForUser(user: ChatGPTUser) {
  const membership = await requireMembership(user);
  const organizationId = membership.organization.id;
  const db = getDb();
  const [codes, redemptions, invitations, directory, profile] = await Promise.all([
    db.select().from(evidenceShareCodes).where(or(
      eq(evidenceShareCodes.controllerOrganizationId, organizationId),
      eq(evidenceShareCodes.recipientOrganizationId, organizationId),
    )).orderBy(desc(evidenceShareCodes.createdAt)).limit(100),
    db.select().from(evidenceShareRedemptions).where(or(
      eq(evidenceShareRedemptions.controllerOrganizationId, organizationId),
      eq(evidenceShareRedemptions.recipientOrganizationId, organizationId),
    )).orderBy(desc(evidenceShareRedemptions.redeemedAt)).limit(100),
    db.select().from(laboratoryInvitations).where(eq(laboratoryInvitations.controllerOrganizationId, organizationId)).orderBy(desc(laboratoryInvitations.createdAt)).limit(50),
    db.select({ id: organizations.id, name: organizations.name, code: organizations.issuerCode, type: organizations.organizationType }).from(organizations),
    db.select().from(participantProfiles).where(eq(participantProfiles.organizationId, organizationId)).limit(1),
  ]);
  return {
    membership,
    codes,
    redemptions,
    invitations,
    organizationMap: Object.fromEntries(directory.map((item) => [item.id, item])),
    profile: profile[0] ?? null,
  };
}

export async function listPublicParticipants() {
  const db = getDb();
  return db
    .select({ profile: participantProfiles, organization: organizations })
    .from(participantProfiles)
    .innerJoin(organizations, eq(participantProfiles.organizationId, organizations.id))
    .where(eq(participantProfiles.isPublic, true))
    .orderBy(participantProfiles.displayName);
}

export async function getPublicParticipant(issuerCodeValue: string) {
  const issuerCode = normalizeCode(issuerCodeValue);
  if (!issuerCode) return null;
  const db = getDb();
  const [participant] = await db
    .select({ profile: participantProfiles, organization: organizations })
    .from(participantProfiles)
    .innerJoin(organizations, eq(participantProfiles.organizationId, organizations.id))
    .where(and(
      eq(participantProfiles.isPublic, true),
      eq(organizations.issuerCode, issuerCode),
    ))
    .limit(1);
  return participant ?? null;
}

export async function upsertParticipantProfile(user: ChatGPTUser, input: Record<string, unknown>) {
  const membership = await requireMembership(user);
  const displayName = clean(input.displayName, 160) || membership.organization.name;
  const website = clean(input.website, 240) || membership.organization.website;
  const summary = clean(input.summary, 600);
  const isPublic = input.isPublic === true || input.isPublic === "true" || input.isPublic === "on";
  if (isPublic && !summary) throw new TecInputError("Add a short public description before listing this organization.");
  const publicSlug = membership.organization.slug;
  const now = new Date().toISOString();
  const db = getDb();
  const [existing] = await db.select().from(participantProfiles).where(eq(participantProfiles.organizationId, membership.organization.id)).limit(1);
  if (existing) {
    await db.update(participantProfiles).set({
      displayName, website, summary, isPublic, publishedAt: isPublic ? (existing.publishedAt ?? now) : null,
      participationStatus: existing.participationStatus === "integration_pilot" ? existing.participationStatus : "active",
      updatedByUserId: user.userId, updatedAt: now,
    }).where(eq(participantProfiles.id, existing.id));
  } else {
    await db.insert(participantProfiles).values({
      id: crypto.randomUUID(), organizationId: membership.organization.id, publicSlug, displayName,
      website, summary, participationStatus: "active", isPublic, registryVerified: false,
      publishedAt: isPublic ? now : null, updatedByUserId: user.userId, createdAt: now, updatedAt: now,
    });
  }
  return { displayName, website, summary, isPublic, publicSlug, updatedAt: now };
}
