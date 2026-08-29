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

export const sandboxSessions = sqliteTable(
  "sandbox_sessions",
  {
    userId: text("user_id").primaryKey(),
    stage: text("stage").notNull().default("submitted"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_sandbox_sessions_updated_at").on(table.updatedAt)],
);

export const sandboxApiKeys = sqliteTable(
  "sandbox_api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => sandboxSessions.userId, { onDelete: "cascade" }),
    label: text("label").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    lastFour: text("last_four").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("idx_sandbox_api_keys_key_hash").on(table.keyHash),
    index("idx_sandbox_api_keys_user_id").on(table.userId),
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
    releasedAt: text("released_at"),
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
    legacyReportId: text("legacy_report_id"),
    sourceDocumentHash: text("source_document_hash"),
    sourceDocumentName: text("source_document_name"),
    issuanceBasis: text("issuance_basis"),
    laboratoryReportNumber: text("laboratory_report_number"),
    laboratoryOrderNumber: text("laboratory_order_number"),
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
    uniqueIndex("idx_credentials_legacy_report_id").on(table.legacyReportId),
    index("idx_credentials_source_document_hash").on(table.sourceDocumentHash),
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

export const legacyReports = sqliteTable(
  "legacy_reports",
  {
    id: text("id").primaryKey(),
    submittingOrganizationId: text("submitting_organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    issuerOrganizationId: text("issuer_organization_id").references(
      () => organizations.id,
      { onDelete: "restrict" },
    ),
    submittedByUserId: text("submitted_by_user_id").notNull(),
    claimedByUserId: text("claimed_by_user_id"),
    confirmedByUserId: text("confirmed_by_user_id"),
    status: text("status").notNull().default("awaiting_lab_claim"),
    laboratoryName: text("laboratory_name").notNull(),
    laboratoryWebsite: text("laboratory_website"),
    confirmationEmail: text("confirmation_email").notNull(),
    confirmationTokenHash: text("confirmation_token_hash").notNull(),
    confirmationTokenLastFour: text("confirmation_token_last_four").notNull(),
    sampleName: text("sample_name").notNull(),
    lotNumber: text("lot_number"),
    matrix: text("matrix"),
    method: text("method"),
    reportNumber: text("report_number"),
    orderNumber: text("order_number"),
    collectedAt: text("collected_at"),
    receivedAt: text("received_at"),
    testedAt: text("tested_at"),
    releasedAt: text("released_at"),
    sourceObjectKey: text("source_object_key").notNull(),
    sourceFilename: text("source_filename").notNull(),
    sourceMimeType: text("source_mime_type").notNull(),
    sourceSize: integer("source_size").notNull(),
    sourceSha256: text("source_sha256").notNull(),
    documentVisibility: text("document_visibility").notNull().default("private"),
    discrepancyNote: text("discrepancy_note"),
    issuedCredentialIdentifier: text("issued_credential_identifier").references(
      () => credentials.identifier,
      { onDelete: "restrict" },
    ),
    claimedAt: text("claimed_at"),
    confirmedAt: text("confirmed_at"),
    declinedAt: text("declined_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_legacy_reports_confirmation_token_hash").on(
      table.confirmationTokenHash,
    ),
    uniqueIndex("idx_legacy_reports_submitter_hash").on(
      table.submittingOrganizationId,
      table.sourceSha256,
    ),
    uniqueIndex("idx_legacy_reports_issued_credential").on(
      table.issuedCredentialIdentifier,
    ),
    index("idx_legacy_reports_status").on(table.status),
    index("idx_legacy_reports_issuer_org").on(table.issuerOrganizationId),
    index("idx_legacy_reports_confirmation_email").on(table.confirmationEmail),
    index("idx_legacy_reports_source_sha256").on(table.sourceSha256),
  ],
);

export const legacyReportResults = sqliteTable(
  "legacy_report_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    legacyReportId: text("legacy_report_id")
      .notNull()
      .references(() => legacyReports.id, { onDelete: "cascade" }),
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
    index("idx_legacy_report_results_report").on(table.legacyReportId),
  ],
);

export const legacyReportEvents = sqliteTable(
  "legacy_report_events",
  {
    id: text("id").primaryKey(),
    legacyReportId: text("legacy_report_id")
      .notNull()
      .references(() => legacyReports.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    actorUserId: text("actor_user_id"),
    eventType: text("event_type").notNull(),
    payload: text("payload"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_legacy_report_events_report").on(table.legacyReportId),
    index("idx_legacy_report_events_org").on(table.organizationId),
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

export const foundingOnboarding = sqliteTable(
  "founding_onboarding",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    primaryGoal: text("primary_goal").notNull(),
    pilotProduct: text("pilot_product").notNull(),
    estimatedReportCount: integer("estimated_report_count").notNull(),
    primaryLaboratories: text("primary_laboratories"),
    targetLaunchDate: text("target_launch_date"),
    notes: text("notes"),
    status: text("status").notNull().default("submitted"),
    submittedAt: text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_founding_onboarding_organization_id").on(table.organizationId),
    index("idx_founding_onboarding_status").on(table.status),
  ],
);

export const disclosureProducts = sqliteTable(
  "disclosure_products",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sku: text("sku").notNull(),
    upc: text("upc"),
    category: text("category"),
    ageRange: text("age_range"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_disclosure_products_org_slug").on(
      table.organizationId,
      table.slug,
    ),
    uniqueIndex("idx_disclosure_products_org_sku").on(
      table.organizationId,
      table.sku,
    ),
  ],
);

export const disclosureImports = sqliteTable(
  "disclosure_imports",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceName: text("source_name").notNull(),
    sourceSha256: text("source_sha256").notNull(),
    status: text("status").notNull().default("processing"),
    rowCount: integer("row_count").notNull().default(0),
    readyRows: integer("ready_rows").notNull().default(0),
    blockedRows: integer("blocked_rows").notNull().default(0),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_disclosure_imports_org_created").on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);

export const disclosureBatches = sqliteTable(
  "disclosure_batches",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => disclosureProducts.id, { onDelete: "cascade" }),
    importId: text("import_id").references(() => disclosureImports.id, {
      onDelete: "set null",
    }),
    batchCode: text("batch_code").notNull(),
    productionDate: text("production_date").notNull(),
    shelfLifeEnd: text("shelf_life_end").notNull(),
    retentionUntil: text("retention_until").notNull(),
    status: text("status").notNull().default("ready_for_review"),
    sourceType: text("source_type").notNull().default("csv_import"),
    laboratoryName: text("laboratory_name").notNull(),
    labReportNumber: text("lab_report_number").notNull(),
    sourceSha256: text("source_sha256").notNull(),
    labConfirmed: integer("lab_confirmed", { mode: "boolean" })
      .notNull()
      .default(false),
    linkedTecrid: text("linked_tecrid"),
    publicRecord: integer("public_record", { mode: "boolean" })
      .notNull()
      .default(false),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_disclosure_batches_product_code").on(
      table.productId,
      table.batchCode,
    ),
    index("idx_disclosure_batches_org_status").on(
      table.organizationId,
      table.status,
    ),
    index("idx_disclosure_batches_product").on(table.productId),
  ],
);

export const disclosureResults = sqliteTable(
  "disclosure_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    batchId: text("batch_id")
      .notNull()
      .references(() => disclosureBatches.id, { onDelete: "cascade" }),
    analyte: text("analyte").notNull(),
    symbol: text("symbol").notNull(),
    resultText: text("result_text").notNull(),
    numericValue: real("numeric_value"),
    unit: text("unit").notNull().default("ppb"),
    loqText: text("loq_text"),
    sequence: integer("sequence").notNull().default(0),
  },
  (table) => [
    uniqueIndex("idx_disclosure_results_batch_analyte").on(
      table.batchId,
      table.analyte,
    ),
  ],
);

export const disclosureImportRows = sqliteTable(
  "disclosure_import_rows",
  {
    id: text("id").primaryKey(),
    importId: text("import_id")
      .notNull()
      .references(() => disclosureImports.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    status: text("status").notNull(),
    productName: text("product_name"),
    batchCode: text("batch_code"),
    payload: text("payload").notNull(),
    errors: text("errors"),
    disclosureBatchId: text("disclosure_batch_id").references(
      () => disclosureBatches.id,
      { onDelete: "set null" },
    ),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_disclosure_import_rows_import_row").on(
      table.importId,
      table.rowNumber,
    ),
    index("idx_disclosure_import_rows_status").on(table.importId, table.status),
  ],
);

export const verificationChecks = sqliteTable(
  "verification_checks",
  {
    id: text("id").primaryKey(),
    lookupType: text("lookup_type").notNull(),
    lookupValue: text("lookup_value").notNull(),
    outcome: text("outcome").notNull(),
    credentialIdentifier: text("credential_identifier"),
    issuerOrganizationId: text("issuer_organization_id").references(
      () => organizations.id,
      { onDelete: "set null" },
    ),
    recordFingerprint: text("record_fingerprint"),
    receiptFingerprint: text("receipt_fingerprint").notNull(),
    requesterUserId: text("requester_user_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_verification_checks_issuer_created").on(
      table.issuerOrganizationId,
      table.createdAt,
    ),
    index("idx_verification_checks_credential_created").on(
      table.credentialIdentifier,
      table.createdAt,
    ),
    uniqueIndex("idx_verification_checks_receipt_fingerprint").on(
      table.receiptFingerprint,
    ),
  ],
);

export const disputeCases = sqliteTable(
  "dispute_cases",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").notNull(),
    title: text("title").notNull(),
    purpose: text("purpose"),
    status: text("status").notNull().default("open"),
    leftCredentialIdentifier: text("left_credential_identifier").notNull(),
    rightCredentialIdentifier: text("right_credential_identifier").notNull(),
    comparisonStatus: text("comparison_status").notNull(),
    comparisonJson: text("comparison_json").notNull(),
    evidenceManifestJson: text("evidence_manifest_json").notNull(),
    evidenceFingerprint: text("evidence_fingerprint").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_dispute_cases_org_created").on(table.organizationId, table.createdAt),
    index("idx_dispute_cases_left_identifier").on(table.leftCredentialIdentifier),
    index("idx_dispute_cases_right_identifier").on(table.rightCredentialIdentifier),
  ],
);

export const certificationPrograms = sqliteTable(
  "certification_programs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    publicToken: text("public_token").notNull(),
    apiTokenHash: text("api_token_hash").notNull(),
    apiTokenPrefix: text("api_token_prefix").notNull(),
    apiTokenLastFour: text("api_token_last_four").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_certification_programs_public_token").on(table.publicToken),
    uniqueIndex("idx_certification_programs_api_token_hash").on(table.apiTokenHash),
    index("idx_certification_programs_org_created").on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);

export const certificationIntakes = sqliteTable(
  "certification_intakes",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => certificationPrograms.id, { onDelete: "restrict" }),
    receivingOrganizationId: text("receiving_organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    applicantOrganization: text("applicant_organization").notNull(),
    applicantName: text("applicant_name").notNull(),
    applicantEmail: text("applicant_email").notNull(),
    submissionReference: text("submission_reference"),
    sourceType: text("source_type").notNull(),
    status: text("status").notNull(),
    rowCount: integer("row_count").notNull(),
    validRows: integer("valid_rows").notNull(),
    blockedRows: integer("blocked_rows").notNull(),
    manifestJson: text("manifest_json").notNull(),
    manifestFingerprint: text("manifest_fingerprint").notNull(),
    submittedByUserId: text("submitted_by_user_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_certification_intakes_receiver_created").on(
      table.receivingOrganizationId,
      table.createdAt,
    ),
    index("idx_certification_intakes_program_created").on(
      table.programId,
      table.createdAt,
    ),
  ],
);

export const certificationIntakeItems = sqliteTable(
  "certification_intake_items",
  {
    id: text("id").primaryKey(),
    intakeId: text("intake_id")
      .notNull()
      .references(() => certificationIntakes.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    submittedIdentifier: text("submitted_identifier").notNull(),
    normalizedIdentifier: text("normalized_identifier").notNull(),
    validationStatus: text("validation_status").notNull(),
    credentialIdentifier: text("credential_identifier"),
    issuerOrganizationId: text("issuer_organization_id").references(
      () => organizations.id,
      { onDelete: "set null" },
    ),
    recordVersion: integer("record_version"),
    recordStatus: text("record_status"),
    issuerSignatureVerified: integer("issuer_signature_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    snapshotFingerprint: text("snapshot_fingerprint"),
    snapshotJson: text("snapshot_json"),
    errors: text("errors"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_certification_items_intake_row").on(table.intakeId, table.rowNumber),
    index("idx_certification_items_identifier").on(table.credentialIdentifier),
    index("idx_certification_items_status").on(table.intakeId, table.validationStatus),
  ],
);
