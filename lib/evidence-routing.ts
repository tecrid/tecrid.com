import { and, desc, eq, or } from "drizzle-orm";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import {
  auditEvents,
  evidenceAccessGrants,
  evidenceDeliveries,
  evidenceRequests,
  organizations,
  routingAuthorizations,
} from "../db/schema";
import {
  getCredential,
  getOrganizationForUser,
  publicCredentialDocument,
  TecAuthorizationError,
  TecInputError,
} from "./tec";

const ACCESS_LEVELS = new Set(["status_only", "selected_analytes", "full_record"]);
const DELIVERY_MODES = new Set(["one_time", "future_sku"]);
const CONTROLLER_TYPES = new Set(["brand", "supplier"]);
const RECIPIENT_TYPES = new Set(["certification_body", "retailer", "government"]);

function clean(value: unknown, maximum = 240) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function normalizeCode(value: unknown) {
  return clean(value, 24).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeSku(value: unknown) {
  return clean(value, 100).toUpperCase().replace(/\s+/g, "-");
}

function normalizeAnalytes(value: unknown) {
  const input = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return [...new Set(input.map((item) => clean(item, 100)).filter(Boolean))].slice(0, 50);
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
  if (!code) throw new TecInputError("An organization code is required.");
  const db = getDb();
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.issuerCode, code))
    .limit(1);
  if (!organization) throw new TecInputError("No TECRID organization matches that code.");
  return organization;
}

function validateScope(input: { accessLevel?: unknown; analytes?: unknown; deliveryMode?: unknown }) {
  const accessLevel = clean(input.accessLevel, 40) || "selected_analytes";
  const deliveryMode = clean(input.deliveryMode, 40) || "future_sku";
  if (!ACCESS_LEVELS.has(accessLevel) || !DELIVERY_MODES.has(deliveryMode)) {
    throw new TecInputError("Choose a valid access level and delivery mode.");
  }
  const analytes = normalizeAnalytes(input.analytes);
  if (accessLevel === "selected_analytes" && !analytes.length) {
    throw new TecInputError("Selected-analyte access requires at least one analyte.");
  }
  return { accessLevel, deliveryMode, analytes };
}

export async function createEvidenceRequest(user: ChatGPTUser, input: Record<string, unknown>) {
  const membership = await requireMembership(user);
  if (!RECIPIENT_TYPES.has(membership.organization.organizationType)) {
    throw new TecAuthorizationError(
      "Evidence streams may be requested by a certification body, retailer, or government workspace.",
    );
  }
  const controller = await organizationByCode(input.controllerOrganizationCode);
  if (controller.id === membership.organization.id) {
    throw new TecInputError("A recipient cannot request evidence from itself.");
  }
  if (!CONTROLLER_TYPES.has(controller.organizationType)) {
    throw new TecInputError("Evidence permission must be requested from a brand or ingredient supplier workspace.");
  }
  const programName = clean(input.programName, 180);
  const purpose = clean(input.purpose, 800);
  const productName = clean(input.productName, 180);
  const productSku = normalizeSku(input.productSku);
  if (!programName || !purpose || !productName || !productSku) {
    throw new TecInputError("Program, purpose, product, and SKU are required.");
  }
  const scope = validateScope(input);
  const id = crypto.randomUUID();
  const requestedAt = new Date().toISOString();
  const db = getDb();
  await db.insert(evidenceRequests).values({
    id,
    requesterOrganizationId: membership.organization.id,
    controllerOrganizationId: controller.id,
    programName,
    purpose,
    productName,
    productSku,
    accessLevel: scope.accessLevel,
    analyteScopeJson: scope.accessLevel === "selected_analytes" ? JSON.stringify(scope.analytes) : null,
    deliveryMode: scope.deliveryMode,
    requestedByUserId: user.userId,
    requestedAt,
  });
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    organizationId: membership.organization.id,
    actorUserId: user.userId,
    eventType: "evidence_access.requested",
    entityType: "evidence_request",
    entityId: id,
    payload: JSON.stringify({ controllerOrganizationId: controller.id, productSku, ...scope }),
    createdAt: requestedAt,
  });
  return { id, status: "pending", controller: controller.name, requestedAt };
}

function scopeRank(value: string) {
  return value === "status_only" ? 0 : value === "selected_analytes" ? 1 : 2;
}

export async function respondToEvidenceRequest(user: ChatGPTUser, requestIdValue: unknown, input: Record<string, unknown>) {
  const membership = await requireMembership(user);
  const requestId = clean(requestIdValue, 100);
  const decision = clean(input.decision, 20);
  if (!requestId || !["accept", "decline"].includes(decision)) {
    throw new TecInputError("Choose accept or decline.");
  }
  const db = getDb();
  const [request] = await db
    .select()
    .from(evidenceRequests)
    .where(and(eq(evidenceRequests.id, requestId), eq(evidenceRequests.controllerOrganizationId, membership.organization.id)))
    .limit(1);
  if (!request) throw new TecAuthorizationError("Evidence request not found for this controller.");
  if (request.status !== "pending") throw new TecInputError("This request has already been answered.");
  const respondedAt = new Date().toISOString();
  if (decision === "decline") {
    await db.batch([
      db.update(evidenceRequests).set({ status: "declined", respondedByUserId: user.userId, respondedAt }).where(eq(evidenceRequests.id, request.id)),
      db.insert(auditEvents).values({
        id: crypto.randomUUID(), organizationId: membership.organization.id, actorUserId: user.userId,
        eventType: "evidence_access.declined", entityType: "evidence_request", entityId: request.id,
        payload: JSON.stringify({ requesterOrganizationId: request.requesterOrganizationId, productSku: request.productSku }), createdAt: respondedAt,
      }),
    ]);
    return { id: request.id, status: "declined" };
  }
  const approved = validateScope({
    accessLevel: input.accessLevel ?? request.accessLevel,
    analytes: input.analytes ?? (request.analyteScopeJson ? JSON.parse(request.analyteScopeJson) : []),
    deliveryMode: input.deliveryMode ?? request.deliveryMode,
  });
  if (scopeRank(approved.accessLevel) > scopeRank(request.accessLevel)) {
    throw new TecInputError("A controller may narrow a request, but cannot approve broader access than the recipient requested.");
  }
  if (request.deliveryMode === "one_time" && approved.deliveryMode === "future_sku") {
    throw new TecInputError("A controller may narrow future delivery to one TECRID, but cannot widen a one-time request to future delivery.");
  }
  if (request.accessLevel === "selected_analytes" && approved.accessLevel === "selected_analytes") {
    const requested = new Set(normalizeAnalytes(JSON.parse(request.analyteScopeJson || "[]")).map((value) => value.toLowerCase()));
    if (approved.analytes.some((value) => !requested.has(value.toLowerCase()))) {
      throw new TecInputError("Approved analytes must be a subset of the requested analytes.");
    }
  }
  const grantId = crypto.randomUUID();
  await db.batch([
    db.update(evidenceRequests).set({ status: "accepted", respondedByUserId: user.userId, respondedAt }).where(eq(evidenceRequests.id, request.id)),
    db.insert(evidenceAccessGrants).values({
      id: grantId,
      requestId: request.id,
      controllerOrganizationId: request.controllerOrganizationId,
      recipientOrganizationId: request.requesterOrganizationId,
      productName: request.productName,
      productSku: request.productSku,
      accessLevel: approved.accessLevel,
      analyteScopeJson: approved.accessLevel === "selected_analytes" ? JSON.stringify(approved.analytes) : null,
      deliveryMode: approved.deliveryMode,
      createdByUserId: user.userId,
      createdAt: respondedAt,
    }),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(), organizationId: membership.organization.id, actorUserId: user.userId,
      eventType: "evidence_access.granted", entityType: "evidence_grant", entityId: grantId,
      payload: JSON.stringify({ requestId: request.id, recipientOrganizationId: request.requesterOrganizationId, productSku: request.productSku, ...approved }), createdAt: respondedAt,
    }),
  ]);
  return { id: request.id, status: "accepted", grantId, approved };
}

export async function revokeEvidenceGrant(user: ChatGPTUser, grantIdValue: unknown) {
  const membership = await requireMembership(user);
  const grantId = clean(grantIdValue, 100);
  const db = getDb();
  const [grant] = await db.select().from(evidenceAccessGrants).where(and(eq(evidenceAccessGrants.id, grantId), eq(evidenceAccessGrants.controllerOrganizationId, membership.organization.id))).limit(1);
  if (!grant || grant.status !== "active") throw new TecAuthorizationError("Active evidence grant not found for this controller.");
  const revokedAt = new Date().toISOString();
  await db.batch([
    db.update(evidenceAccessGrants).set({ status: "revoked", revokedByUserId: user.userId, revokedAt }).where(eq(evidenceAccessGrants.id, grant.id)),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(), organizationId: membership.organization.id, actorUserId: user.userId,
      eventType: "evidence_access.revoked", entityType: "evidence_grant", entityId: grant.id,
      payload: JSON.stringify({ recipientOrganizationId: grant.recipientOrganizationId, productSku: grant.productSku }), createdAt: revokedAt,
    }),
  ]);
  return { id: grant.id, status: "revoked", revokedAt };
}

export async function createRoutingAuthorization(user: ChatGPTUser, input: Record<string, unknown>) {
  const membership = await requireMembership(user);
  if (!CONTROLLER_TYPES.has(membership.organization.organizationType)) {
    throw new TecAuthorizationError("Only a brand or ingredient supplier can authorize laboratory routing.");
  }
  const laboratory = await organizationByCode(input.laboratoryOrganizationCode);
  if (laboratory.organizationType !== "laboratory" || laboratory.issuerStatus !== "verified") {
    throw new TecInputError("Routing tokens may be issued only to an ICS-verified laboratory workspace.");
  }
  const productName = clean(input.productName, 180);
  const productSku = normalizeSku(input.productSku);
  if (!productName || !productSku) throw new TecInputError("Product and SKU are required.");
  const db = getDb();
  const grants = await db.select({ id: evidenceAccessGrants.id, productName: evidenceAccessGrants.productName }).from(evidenceAccessGrants).where(and(eq(evidenceAccessGrants.controllerOrganizationId, membership.organization.id), eq(evidenceAccessGrants.productSku, productSku), eq(evidenceAccessGrants.status, "active"))).limit(1);
  if (!grants.length) throw new TecInputError("Approve at least one recipient grant for this SKU before authorizing laboratory routing.");
  if (grants[0].productName.toLowerCase() !== productName.toLowerCase()) {
    throw new TecInputError("The product name must match the active recipient grant for this SKU.");
  }
  const daysValue = Number(input.expiresInDays);
  const days = Number.isFinite(daysValue) ? Math.max(1, Math.min(365, Math.round(daysValue))) : 90;
  const plainTextToken = `tec_route_${randomToken(42)}`;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(routingAuthorizations).values({
      id,
      controllerOrganizationId: membership.organization.id,
      laboratoryOrganizationId: laboratory.id,
      productName,
      productSku,
      tokenHash: await sha256(plainTextToken),
      tokenPrefix: plainTextToken.slice(0, 16),
      tokenLastFour: plainTextToken.slice(-4),
      createdByUserId: user.userId,
      createdAt,
      expiresAt,
    }),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(), organizationId: membership.organization.id, actorUserId: user.userId,
      eventType: "evidence_routing.authorized", entityType: "routing_authorization", entityId: id,
      payload: JSON.stringify({ laboratoryOrganizationId: laboratory.id, productSku, expiresAt }), createdAt,
    }),
  ]);
  return { id, plainTextToken, productName, productSku, laboratory: laboratory.name, createdAt, expiresAt };
}

export async function revokeRoutingAuthorization(user: ChatGPTUser, authorizationIdValue: unknown) {
  const membership = await requireMembership(user);
  const id = clean(authorizationIdValue, 100);
  const db = getDb();
  const [record] = await db.select().from(routingAuthorizations).where(and(eq(routingAuthorizations.id, id), eq(routingAuthorizations.controllerOrganizationId, membership.organization.id))).limit(1);
  if (!record || record.status !== "active") throw new TecAuthorizationError("Active routing authorization not found.");
  const revokedAt = new Date().toISOString();
  await db.batch([
    db.update(routingAuthorizations).set({ status: "revoked", revokedAt, revokedByUserId: user.userId }).where(eq(routingAuthorizations.id, id)),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(), organizationId: membership.organization.id, actorUserId: user.userId,
      eventType: "evidence_routing.revoked", entityType: "routing_authorization", entityId: id,
      payload: JSON.stringify({ laboratoryOrganizationId: record.laboratoryOrganizationId, productSku: record.productSku }), createdAt: revokedAt,
    }),
  ]);
  return { id, status: "revoked", revokedAt };
}

export async function authorizeRoutingToken(tokenValue: unknown, laboratoryOrganizationId?: string) {
  const token = clean(tokenValue, 120);
  if (!/^tec_route_[A-Za-z0-9]+$/.test(token)) throw new TecAuthorizationError("A valid brand-controlled routing token is required.");
  const db = getDb();
  const [record] = await db
    .select({ authorization: routingAuthorizations, controller: organizations })
    .from(routingAuthorizations)
    .innerJoin(organizations, eq(routingAuthorizations.controllerOrganizationId, organizations.id))
    .where(and(eq(routingAuthorizations.tokenHash, await sha256(token)), eq(routingAuthorizations.status, "active")))
    .limit(1);
  if (!record || new Date(record.authorization.expiresAt).getTime() <= Date.now()) throw new TecAuthorizationError("The routing token is invalid, expired, or revoked.");
  if (laboratoryOrganizationId && record.authorization.laboratoryOrganizationId !== laboratoryOrganizationId) {
    throw new TecAuthorizationError("This routing token was issued to a different laboratory.");
  }
  const grants = await db.select().from(evidenceAccessGrants).where(and(eq(evidenceAccessGrants.controllerOrganizationId, record.authorization.controllerOrganizationId), eq(evidenceAccessGrants.productSku, record.authorization.productSku), eq(evidenceAccessGrants.status, "active")));
  if (!grants.length) throw new TecAuthorizationError("No active recipient grant remains for this routing token.");
  return { ...record, grants };
}

function withControlledPayloadsWithheld<T extends ReturnType<typeof publicCredentialDocument>>(document: T) {
  return {
    ...document,
    integrity: { ...document.integrity, issuerProof: document.integrity.issuerProof ? { ...document.integrity.issuerProof, signedPayload: null, payloadWithheld: true } : null },
    versions: document.versions.map((version) => ({ ...version, canonicalPayload: null, issuerSignature: null, signedPayload: null, payloadWithheld: true })),
  };
}

function documentForGrant(record: NonNullable<Awaited<ReturnType<typeof getCredential>>>, grant: typeof evidenceAccessGrants.$inferSelect) {
  const full = publicCredentialDocument(record, { includeControlledResults: true });
  const requestedAnalytes = normalizeAnalytes(grant.analyteScopeJson ? JSON.parse(grant.analyteScopeJson) : []);
  const analytes = new Set(requestedAnalytes.map((value) => value.toLowerCase()));
  if (grant.accessLevel === "full_record") return { ...full, resultsAccess: { state: "granted", grantRequired: true, accessLevel: "full_record" } };
  const results = grant.accessLevel === "selected_analytes"
    ? full.results.filter((result) => analytes.has(result.analyte.toLowerCase()))
    : [];
  const deliveredAnalytes = new Set(results.map((result) => result.analyte.toLowerCase()));
  const missingAnalytes = requestedAnalytes.filter((analyte) => !deliveredAnalytes.has(analyte.toLowerCase()));
  const redacted = withControlledPayloadsWithheld(full);
  return {
    ...redacted,
    results,
    resultsAccess: {
      state: "granted",
      grantRequired: true,
      accessLevel: grant.accessLevel,
      analytes: grant.accessLevel === "selected_analytes" ? requestedAnalytes : [],
      deliveredAnalytes: results.map((result) => result.analyte),
      missingAnalytes,
      coverageState: missingAnalytes.length ? "incomplete" : "complete",
      note: missingAnalytes.length
        ? "The issued credential did not contain every analyte in this grant. Missing analytes are explicit; the registry does not infer a passing result."
        : "This recipient view is a registry extraction from the full signed credential. The complete signed payload remains withheld unless full-record access is granted.",
    },
  };
}

export async function deliverCredentialWithAuthorization(
  authorizationRecord: Awaited<ReturnType<typeof authorizeRoutingToken>>,
  identifierValue: unknown,
) {
  const identifier = clean(identifierValue, 120);
  const record = await getCredential(identifier);
  if (!record || record.credential.status !== "issued") throw new TecInputError("Only a current issued TECRID can be routed.");
  if (record.issuer.id !== authorizationRecord.authorization.laboratoryOrganizationId) {
    throw new TecAuthorizationError("The TECRID was not issued by the laboratory named in this routing authorization.");
  }
  if (record.credential.productSku !== authorizationRecord.authorization.productSku) {
    throw new TecAuthorizationError("The TECRID's signed productSku does not match this routing authorization.");
  }
  if (!record.integrity.issuerSignatureVerified || !record.integrity.fingerprintValid || !record.integrity.currentVersionConsistent) {
    throw new TecAuthorizationError("The TECRID did not pass the signature, fingerprint, and current-version gate.");
  }
  const deliveredAt = new Date().toISOString();
  const db = getDb();
  const delivered: Array<{ recipientOrganizationId: string; grantId: string; accessLevel: string; snapshotFingerprint: string }> = [];
  for (const grant of authorizationRecord.grants) {
    const [existing] = await db.select({ id: evidenceDeliveries.id }).from(evidenceDeliveries).where(and(eq(evidenceDeliveries.grantId, grant.id), eq(evidenceDeliveries.credentialIdentifier, record.credential.identifier))).limit(1);
    if (existing) continue;
    const snapshotJson = JSON.stringify(documentForGrant(record, grant));
    const snapshotFingerprint = await sha256(snapshotJson);
    const deliveryId = crypto.randomUUID();
    await db.insert(evidenceDeliveries).values({
      id: deliveryId,
      grantId: grant.id,
      routingAuthorizationId: authorizationRecord.authorization.id,
      controllerOrganizationId: grant.controllerOrganizationId,
      recipientOrganizationId: grant.recipientOrganizationId,
      credentialIdentifier: record.credential.identifier,
      credentialVersion: record.credential.version,
      accessLevel: grant.accessLevel,
      snapshotJson,
      snapshotFingerprint,
      deliveredAt,
    });
    await db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      organizationId: grant.controllerOrganizationId,
      actorUserId: null,
      eventType: "evidence_routing.delivered",
      entityType: "evidence_delivery",
      entityId: deliveryId,
      payload: JSON.stringify({
        recipientOrganizationId: grant.recipientOrganizationId,
        credentialIdentifier: record.credential.identifier,
        credentialVersion: record.credential.version,
        snapshotFingerprint,
      }),
      createdAt: deliveredAt,
    });
    if (grant.deliveryMode === "one_time") {
      await db.update(evidenceAccessGrants).set({ status: "fulfilled" }).where(eq(evidenceAccessGrants.id, grant.id));
    }
    delivered.push({ recipientOrganizationId: grant.recipientOrganizationId, grantId: grant.id, accessLevel: grant.accessLevel, snapshotFingerprint });
  }
  await db.update(routingAuthorizations).set({ lastUsedAt: deliveredAt }).where(eq(routingAuthorizations.id, authorizationRecord.authorization.id));
  return { tecrid: record.credential.identifier, productSku: authorizationRecord.authorization.productSku, deliveredAt, deliveries: delivered };
}

export async function routeExistingCredential(request: Request, input: Record<string, unknown>) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(tec_route_[A-Za-z0-9]+)$/)?.[1];
  const direct = request.headers.get("x-tecrid-routing-token");
  const authorization = await authorizeRoutingToken(bearer || direct || input.routingToken);
  return deliverCredentialWithAuthorization(authorization, input.tecrid ?? input.identifier);
}

export async function listEvidenceDeliveriesForOrganization(organizationId: string) {
  const db = getDb();
  const deliveries = await db
    .select()
    .from(evidenceDeliveries)
    .where(or(
      eq(evidenceDeliveries.controllerOrganizationId, organizationId),
      eq(evidenceDeliveries.recipientOrganizationId, organizationId),
    ))
    .orderBy(desc(evidenceDeliveries.deliveredAt))
    .limit(100);
  return deliveries.map((delivery) => ({
    id: delivery.id,
    grantId: delivery.grantId,
    controllerOrganizationId: delivery.controllerOrganizationId,
    recipientOrganizationId: delivery.recipientOrganizationId,
    credentialIdentifier: delivery.credentialIdentifier,
    credentialVersion: delivery.credentialVersion,
    accessLevel: delivery.accessLevel,
    snapshotFingerprint: delivery.snapshotFingerprint,
    deliveredAt: delivery.deliveredAt,
    snapshot: JSON.parse(delivery.snapshotJson),
  }));
}

export async function listEvidenceRoutingForUser(user: ChatGPTUser) {
  const membership = await requireMembership(user);
  const organizationId = membership.organization.id;
  const db = getDb();
  const [requests, grants, deliveries, authorizations, directory] = await Promise.all([
    db.select().from(evidenceRequests).where(or(eq(evidenceRequests.requesterOrganizationId, organizationId), eq(evidenceRequests.controllerOrganizationId, organizationId))).orderBy(desc(evidenceRequests.requestedAt)).limit(100),
    db.select().from(evidenceAccessGrants).where(or(eq(evidenceAccessGrants.controllerOrganizationId, organizationId), eq(evidenceAccessGrants.recipientOrganizationId, organizationId))).orderBy(desc(evidenceAccessGrants.createdAt)).limit(100),
    db.select().from(evidenceDeliveries).where(or(eq(evidenceDeliveries.controllerOrganizationId, organizationId), eq(evidenceDeliveries.recipientOrganizationId, organizationId))).orderBy(desc(evidenceDeliveries.deliveredAt)).limit(100),
    db.select().from(routingAuthorizations).where(eq(routingAuthorizations.controllerOrganizationId, organizationId)).orderBy(desc(routingAuthorizations.createdAt)).limit(100),
    db.select({ id: organizations.id, name: organizations.name, code: organizations.issuerCode, type: organizations.organizationType }).from(organizations),
  ]);
  const organizationMap = Object.fromEntries(directory.map((item) => [item.id, item]));
  return { membership, requests, grants, deliveries, authorizations, organizationMap };
}
