import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const organizations = sqliteTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    organizationType: text("organization_type").notNull(),
    website: text("website"),
    ownerUserId: text("owner_user_id").notNull(),
    ownerEmail: text("owner_email").notNull(),
    issuerCode: text("issuer_code").notNull(),
    issuerStatus: text("issuer_status").notNull().default("pending"),
    issuerPublicKeyJwk: text("issuer_public_key_jwk"),
    issuerKeyId: text("issuer_key_id"),
    issuerKeyAlgorithm: text("issuer_key_algorithm"),
    issuerKeyVerifiedAt: text("issuer_key_verified_at"),
    plan: text("plan").notNull().default("free"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_organizations_slug").on(table.slug),
    uniqueIndex("idx_organizations_issuer_code").on(table.issuerCode),
    index("idx_organizations_owner_user_id").on(table.ownerUserId),
  ],
);

export const organizationMembers = sqliteTable(
  "organization_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_members_user_id").on(table.userId),
    index("idx_members_organization_id").on(table.organizationId),
  ],
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    lastFour: text("last_four").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("idx_api_keys_key_hash").on(table.keyHash),
    index("idx_api_keys_organization_id").on(table.organizationId),
  ],
);

export const credentials = sqliteTable(
  "credentials",
  {
    identifier: text("identifier").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("draft"),
    sampleName: text("sample_name").notNull(),
    lotNumber: text("lot_number"),
    matrix: text("matrix"),
    method: text("method"),
    submittingParty: text("submitting_party"),
    collectedAt: text("collected_at"),
    receivedAt: text("received_at"),
    testedAt: text("tested_at"),
    issuedAt: text("issued_at"),
    version: integer("version").notNull().default(1),
    fingerprint: text("fingerprint"),
    issuerSignature: text("issuer_signature"),
    issuerKeyId: text("issuer_key_id"),
    issuerPublicKeyJwk: text("issuer_public_key_jwk"),
    issuerKeyVerifiedAt: text("issuer_key_verified_at"),
    signatureAlgorithm: text("signature_algorithm"),
    signedPayload: text("signed_payload"),
    signedPayloadHash: text("signed_payload_hash"),
    publicRecord: integer("public_record", { mode: "boolean" })
      .notNull()
      .default(false),
    createdByUserId: text("created_by_user_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_credentials_organization_id").on(table.organizationId),
    index("idx_credentials_status").on(table.status),
    index("idx_credentials_public_record").on(table.publicRecord),
  ],
);

export const credentialVersions = sqliteTable(
  "credential_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    credentialIdentifier: text("credential_identifier")
      .notNull()
      .references(() => credentials.identifier, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    canonicalPayload: text("canonical_payload").notNull(),
    fingerprint: text("fingerprint").notNull(),
    issuerSignature: text("issuer_signature"),
    issuerKeyId: text("issuer_key_id"),
    issuerPublicKeyJwk: text("issuer_public_key_jwk"),
    issuerKeyVerifiedAt: text("issuer_key_verified_at"),
    signatureAlgorithm: text("signature_algorithm"),
    signedPayload: text("signed_payload"),
    signedPayloadHash: text("signed_payload_hash"),
    changeType: text("change_type").notNull().default("issuance"),
    changeReason: text("change_reason"),
    createdByUserId: text("created_by_user_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_credential_versions_identifier_version").on(
      table.credentialIdentifier,
      table.version,
    ),
    index("idx_credential_versions_identifier").on(
      table.credentialIdentifier,
    ),
  ],
);

export const credentialResults = sqliteTable(
  "credential_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    credentialIdentifier: text("credential_identifier")
      .notNull()
      .references(() => credentials.identifier, { onDelete: "cascade" }),
    analyte: text("analyte").notNull(),
    symbol: text("symbol"),
    resultText: text("result_text").notNull(),
    numericValue: real("numeric_value"),
    unit: text("unit").notNull(),
    loqText: text("loq_text"),
    method: text("method"),
    sequence: integer("sequence").notNull().default(0),
  },
  (table) => [
    index("idx_results_credential_identifier").on(
      table.credentialIdentifier,
    ),
  ],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id"),
    actorUserId: text("actor_user_id"),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    payload: text("payload"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_audit_events_organization_id").on(table.organizationId),
    index("idx_audit_events_entity").on(table.entityType, table.entityId),
  ],
);

export const issuerApplications = sqliteTable(
  "issuer_applications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalName: text("legal_name").notNull(),
    laboratoryAddress: text("laboratory_address").notNull(),
    accreditationBody: text("accreditation_body"),
    accreditationNumber: text("accreditation_number"),
    accreditationUrl: text("accreditation_url"),
    scopeSummary: text("scope_summary").notNull(),
    methodFamilies: text("method_families").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    publicKeyJwk: text("public_key_jwk"),
    keyId: text("key_id"),
    keyAlgorithm: text("key_algorithm"),
    attested: integer("attested", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("submitted"),
    submittedAt: text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    reviewedAt: text("reviewed_at"),
    reviewNote: text("review_note"),
  },
  (table) => [
    index("idx_issuer_applications_organization_id").on(
      table.organizationId,
    ),
    index("idx_issuer_applications_status").on(table.status),
  ],
);

export const billingEvents = sqliteTable(
  "billing_events",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    paymentLinkId: text("payment_link_id"),
    customerEmail: text("customer_email"),
    customerId: text("customer_id"),
    subscriptionId: text("subscription_id"),
    amountTotal: integer("amount_total"),
    currency: text("currency"),
    status: text("status").notNull().default("pending"),
    organizationId: text("organization_id"),
    payload: text("payload"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    processedAt: text("processed_at"),
  },
  (table) => [
    index("idx_billing_events_customer_email").on(table.customerEmail),
    index("idx_billing_events_subscription_id").on(table.subscriptionId),
    index("idx_billing_events_organization_id").on(table.organizationId),
  ],
);
