import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import {
  apiKeys,
  auditEvents,
  billingEvents,
  credentialResults,
  credentials,
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

export type CredentialInput = {
  sampleName: string;
  lotNumber?: string;
  matrix?: string;
  method?: string;
  submittingParty?: string;
  collectedAt?: string;
  receivedAt?: string;
  testedAt?: string;
  publish?: boolean;
  results: CredentialResultInput[];
};

export class TecInputError extends Error {
  status = 400;
}

export class TecAuthorizationError extends Error {
  status = 403;
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

  return { ...membership, records, keys };
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

  return {
    sampleName,
    lotNumber: normalizeText(input.lotNumber, 120) || undefined,
    matrix: normalizeText(input.matrix, 120) || undefined,
    method: normalizeText(input.method, 160) || undefined,
    submittingParty: normalizeText(input.submittingParty, 160) || undefined,
    collectedAt: normalizeText(input.collectedAt, 40) || undefined,
    receivedAt: normalizeText(input.receivedAt, 40) || undefined,
    testedAt: normalizeText(input.testedAt, 40) || undefined,
    publish: Boolean(input.publish),
    results,
  };
}

export async function createCredential(
  organization: typeof organizations.$inferSelect,
  actorUserId: string | null,
  value: unknown,
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
  const identifier = `TEC·${organization.issuerCode}-${year}-${randomCharacters(8)}`;
  const issued = Boolean(input.publish && canPublish);
  const createdAt = now();
  const canonical = JSON.stringify({
    identifier,
    issuer: organization.id,
    version: 1,
    sampleName: input.sampleName,
    lotNumber: input.lotNumber ?? null,
    matrix: input.matrix ?? null,
    method: input.method ?? null,
    results: input.results,
  });
  const fingerprint = issued ? await sha256(canonical) : null;
  const db = getDb();

  await db.insert(credentials).values({
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
    issuedAt: issued ? createdAt : null,
    version: 1,
    fingerprint,
    publicRecord: issued,
    createdByUserId: actorUserId,
    createdAt,
    updatedAt: createdAt,
  });
  for (const [sequence, row] of input.results.entries()) {
    await db.insert(credentialResults).values({
      credentialIdentifier: identifier,
      analyte: row.analyte,
      symbol: row.symbol ?? null,
      resultText: row.resultText,
      numericValue: row.numericValue ?? null,
      unit: row.unit,
      loqText: row.loqText ?? null,
      method: row.method ?? input.method ?? null,
      sequence,
    });
  }
  await db.insert(auditEvents).values({
    id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
    organizationId: organization.id,
    actorUserId,
    eventType: issued ? "credential.issued" : "credential.draft_created",
    entityType: "credential",
    entityId: identifier,
    payload: JSON.stringify({ resultCount: input.results.length, fingerprint }),
    createdAt,
  });

  return { identifier, status: issued ? "issued" : "draft", fingerprint };
}

export async function getCredential(identifierValue: string, includeDraft = false) {
  const identifier = identifierValue
    .trim()
    .toUpperCase()
    .replace(/^TEC:/, "TEC·")
    .replace(/^TEC-/, "TEC·");
  const db = getDb();
  const condition = includeDraft
    ? eq(credentials.identifier, identifier)
    : and(
        eq(credentials.identifier, identifier),
        eq(credentials.publicRecord, true),
      );
  const [record] = await db
    .select({ credential: credentials, issuer: organizations })
    .from(credentials)
    .innerJoin(organizations, eq(credentials.organizationId, organizations.id))
    .where(condition)
    .limit(1);
  if (!record) return null;

  const results = await db
    .select()
    .from(credentialResults)
    .where(eq(credentialResults.credentialIdentifier, identifier))
    .orderBy(asc(credentialResults.sequence));
  return { ...record, results };
}

export async function createCredentialForUser(user: ChatGPTUser, value: unknown) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) throw new TecAuthorizationError("Complete organization setup first.");
  return createCredential(membership.organization, user.userId, value);
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
