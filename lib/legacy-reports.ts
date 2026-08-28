import { and, asc, count, desc, eq, gte, or } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../db";
import {
  auditEvents,
  credentials,
  legacyReportEvents,
  legacyReportResults,
  legacyReports,
  organizations,
} from "../db/schema";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import {
  canonicalizeCredential,
  createCredential,
  getOrganizationForUser,
  isIcsAdmin,
  TecAuthorizationError,
  TecInputError,
  type CredentialProofInput,
  type CredentialResultInput,
} from "./tec";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

type LegacyResultInput = CredentialResultInput;

export class LegacyReportConflictError extends Error {
  status = 409;
}

export class LegacyReportRateLimitError extends Error {
  status = 429;
}

function now() {
  return new Date().toISOString();
}

function normalizeText(value: unknown, maximum = 180) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function documentsBucket() {
  const bucket = (env as unknown as { DOCUMENTS?: R2Bucket }).DOCUMENTS;
  if (!bucket) {
    throw new Error("Private document storage is not available.");
  }
  return bucket;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Bytes(value: ArrayBuffer) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", value)));
}

async function sha256Text(value: string) {
  return sha256Bytes(new TextEncoder().encode(value).buffer as ArrayBuffer);
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function cleanFilename(value: string) {
  return normalizeText(value.split(/[\\/]/).pop() || "report.pdf", 240)
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("") || "report.pdf";
}

function normalizeDate(value: unknown) {
  const date = normalizeText(value, 40);
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new TecInputError("Report dates must use YYYY-MM-DD.");
  }
  return date;
}

function validateResults(rows: unknown): LegacyResultInput[] {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) {
    throw new TecInputError("Provide between 1 and 100 analytical results.");
  }
  return rows.map((value, index) => {
    const row = (value ?? {}) as Record<string, unknown>;
    const analyte = normalizeText(row.analyte, 100);
    const resultText = normalizeText(row.resultText, 80);
    const unit = normalizeText(row.unit, 40);
    if (!analyte || !resultText || !unit) {
      throw new TecInputError(
        `Result ${index + 1} requires an analyte, exact result text, and unit.`,
      );
    }
    const numericValue =
      typeof row.numericValue === "number" && Number.isFinite(row.numericValue)
        ? row.numericValue
        : null;
    return {
      analyte,
      symbol: normalizeText(row.symbol, 12) || undefined,
      resultText,
      numericValue,
      unit,
      loqText: normalizeText(row.loqText, 80) || undefined,
      method: normalizeText(row.method, 120) || undefined,
    };
  });
}

function parseResults(value: FormDataEntryValue | null): LegacyResultInput[] {
  if (typeof value !== "string") {
    throw new TecInputError("At least one transcribed analytical result is required.");
  }
  try {
    return validateResults(JSON.parse(value));
  } catch (error) {
    if (error instanceof TecInputError) throw error;
    throw new TecInputError("The analytical results payload is invalid.");
  }
}

async function getOrganizationsForReport(
  report: typeof legacyReports.$inferSelect,
) {
  const db = getDb();
  const [submitter] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, report.submittingOrganizationId))
    .limit(1);
  const [issuer] = report.issuerOrganizationId
    ? await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, report.issuerOrganizationId))
        .limit(1)
    : [];
  return { submitter: submitter ?? null, issuer: issuer ?? null };
}

async function getLegacyReportBundle(reportId: string) {
  const db = getDb();
  const [report] = await db
    .select()
    .from(legacyReports)
    .where(eq(legacyReports.id, reportId))
    .limit(1);
  if (!report) return null;
  const [results, events, parties] = await Promise.all([
    db
      .select()
      .from(legacyReportResults)
      .where(eq(legacyReportResults.legacyReportId, report.id))
      .orderBy(asc(legacyReportResults.sequence)),
    db
      .select()
      .from(legacyReportEvents)
      .where(eq(legacyReportEvents.legacyReportId, report.id))
      .orderBy(desc(legacyReportEvents.createdAt)),
    getOrganizationsForReport(report),
  ]);
  return { report, results, events, ...parties };
}

function canAccessBundle(
  user: ChatGPTUser,
  membership: Awaited<ReturnType<typeof getOrganizationForUser>>,
  bundle: NonNullable<Awaited<ReturnType<typeof getLegacyReportBundle>>>,
) {
  if (isIcsAdmin(user)) return true;
  if (membership?.organization.id === bundle.report.submittingOrganizationId) return true;
  if (membership?.organization.id === bundle.report.issuerOrganizationId) return true;
  return false;
}

export async function createLegacyReport(user: ChatGPTUser, form: FormData) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) throw new TecAuthorizationError("Complete organization setup first.");
  const db = getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [[dailyUsage], [totalUsage]] = await Promise.all([
    db
      .select({ value: count() })
      .from(legacyReports)
      .where(
        and(
          eq(legacyReports.submittingOrganizationId, membership.organization.id),
          gte(legacyReports.createdAt, since),
        ),
      ),
    db
      .select({ value: count() })
      .from(legacyReports)
      .where(eq(legacyReports.submittingOrganizationId, membership.organization.id)),
  ]);
  const founding = membership.organization.plan === "founding";
  if ((dailyUsage?.value ?? 0) >= (founding ? 250 : 25)) {
    throw new LegacyReportRateLimitError(
      "This workspace has reached its 24-hour private-intake limit.",
    );
  }
  if ((totalUsage?.value ?? 0) >= (founding ? 5000 : 25)) {
    throw new LegacyReportRateLimitError(
      "This workspace has reached its current private-intake capacity.",
    );
  }

  const document = form.get("document");
  if (!(document instanceof File)) throw new TecInputError("Choose a PDF laboratory report.");
  if (document.size < 5 || document.size > MAX_PDF_BYTES) {
    throw new TecInputError("The PDF must be between 5 bytes and 20 MB.");
  }
  const filename = cleanFilename(document.name);
  if (!filename.toLowerCase().endsWith(".pdf")) {
    throw new TecInputError("Only PDF laboratory reports are accepted.");
  }
  const bytes = await document.arrayBuffer();
  const magic = new TextDecoder().decode(bytes.slice(0, 5));
  if (magic !== "%PDF-") throw new TecInputError("The uploaded file is not a valid PDF.");

  const laboratoryName = normalizeText(form.get("laboratoryName"));
  const confirmationEmail = normalizeText(form.get("confirmationEmail"), 254).toLowerCase();
  const sampleName = normalizeText(form.get("sampleName"));
  const results = parseResults(form.get("results"));
  if (form.get("attested") !== "on") {
    throw new TecInputError("The submission attestation is required.");
  }
  if (!laboratoryName || !sampleName || !/^\S+@\S+\.\S+$/.test(confirmationEmail)) {
    throw new TecInputError(
      "Laboratory name, laboratory confirmation email, and sample name are required.",
    );
  }
  const laboratoryWebsite = normalizeText(form.get("laboratoryWebsite"), 300) || null;
  if (laboratoryWebsite) {
    try {
      const url = new URL(laboratoryWebsite);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      throw new TecInputError("Laboratory website must be a complete http or https URL.");
    }
  }

  const reportNumber = normalizeText(form.get("reportNumber"), 120) || null;
  const orderNumber = normalizeText(form.get("orderNumber"), 120) || null;
  const collectedAt = normalizeDate(form.get("collectedAt"));
  const receivedAt = normalizeDate(form.get("receivedAt"));
  const testedAt = normalizeDate(form.get("testedAt"));
  const releasedAt = normalizeDate(form.get("releasedAt"));

  const sourceSha256 = await sha256Bytes(bytes);
  const [duplicate] = await db
    .select({ id: legacyReports.id })
    .from(legacyReports)
    .where(
      and(
        eq(legacyReports.submittingOrganizationId, membership.organization.id),
        eq(legacyReports.sourceSha256, sourceSha256),
      ),
    )
    .limit(1);
  if (duplicate) {
    throw new LegacyReportConflictError(
      `This exact PDF is already in your private intake as ${duplicate.id}.`,
    );
  }
  if (reportNumber) {
    const [sameReference] = await db
      .select({ id: legacyReports.id, sourceSha256: legacyReports.sourceSha256 })
      .from(legacyReports)
      .where(
        and(
          eq(legacyReports.submittingOrganizationId, membership.organization.id),
          eq(legacyReports.laboratoryName, laboratoryName),
          eq(legacyReports.reportNumber, reportNumber),
        ),
      )
      .limit(1);
    if (sameReference && sameReference.sourceSha256 !== sourceSha256) {
      throw new LegacyReportConflictError(
        `Report ${reportNumber} already exists as ${sameReference.id} with different file bytes. Reconcile the document versions with the laboratory instead of merging them.`,
      );
    }
  }

  const id = `intake_${crypto.randomUUID().replaceAll("-", "")}`;
  const token = randomToken();
  const tokenHash = await sha256Text(token);
  const createdAt = now();
  const objectKey = `legacy-reports/${membership.organization.id}/${id}/${sourceSha256}.pdf`;
  const bucket = documentsBucket();

  await bucket.put(objectKey, bytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      sha256: sourceSha256,
      intakeId: id,
      submittingOrganizationId: membership.organization.id,
    },
  });

  try {
    const reportInsert = db.insert(legacyReports).values({
      id,
      submittingOrganizationId: membership.organization.id,
      submittedByUserId: user.userId,
      status: "awaiting_lab_claim",
      laboratoryName,
      laboratoryWebsite,
      confirmationEmail,
      confirmationTokenHash: tokenHash,
      confirmationTokenLastFour: token.slice(-4),
      sampleName,
      lotNumber: normalizeText(form.get("lotNumber"), 120) || null,
      matrix: normalizeText(form.get("matrix"), 120) || null,
      method: normalizeText(form.get("method"), 160) || null,
      reportNumber,
      orderNumber,
      collectedAt,
      receivedAt,
      testedAt,
      releasedAt,
      sourceObjectKey: objectKey,
      sourceFilename: filename,
      sourceMimeType: "application/pdf",
      sourceSize: document.size,
      sourceSha256,
      documentVisibility: "private",
      createdAt,
      updatedAt: createdAt,
    });
    const resultInserts = results.map((row, sequence) =>
      db.insert(legacyReportResults).values({
        legacyReportId: id,
        analyte: row.analyte,
        symbol: row.symbol ?? null,
        resultText: row.resultText,
        numericValue: row.numericValue ?? null,
        unit: row.unit,
        loqText: row.loqText ?? null,
        method: row.method ?? null,
        sequence,
      }),
    );
    const eventInsert = db.insert(legacyReportEvents).values({
      id: `levent_${crypto.randomUUID().replaceAll("-", "")}`,
      legacyReportId: id,
      organizationId: membership.organization.id,
      actorUserId: user.userId,
      eventType: "report.submitted",
      payload: JSON.stringify({ sourceSha256, resultCount: results.length }),
      createdAt,
    });
    const auditInsert = db.insert(auditEvents).values({
      id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
      organizationId: membership.organization.id,
      actorUserId: user.userId,
      eventType: "legacy_report.submitted",
      entityType: "legacy_report",
      entityId: id,
      payload: JSON.stringify({ sourceSha256, laboratoryName, confirmationEmail }),
      createdAt,
    });
    await db.batch([reportInsert, ...resultInserts, eventInsert, auditInsert]);
  } catch (error) {
    await bucket.delete(objectKey);
    throw error;
  }

  return {
    id,
    status: "awaiting_lab_claim",
    sourceSha256,
    confirmationPath: `/confirm/${token}`,
  };
}

export async function listLegacyReportsForUser(user: ChatGPTUser) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) return [];
  const db = getDb();
  return db
    .select()
    .from(legacyReports)
    .where(
      or(
        eq(legacyReports.submittingOrganizationId, membership.organization.id),
        eq(legacyReports.issuerOrganizationId, membership.organization.id),
      ),
    )
    .orderBy(desc(legacyReports.createdAt))
    .limit(50);
}

export async function getLegacyReportForUser(user: ChatGPTUser, reportIdValue: string) {
  const reportId = normalizeText(reportIdValue, 120);
  const bundle = await getLegacyReportBundle(reportId);
  if (!bundle) return null;
  const membership = await getOrganizationForUser(user.userId);
  if (!canAccessBundle(user, membership, bundle)) return null;
  return { ...bundle, membership };
}

async function getLegacyReportForToken(user: ChatGPTUser, tokenValue: string) {
  const token = normalizeText(tokenValue, 180);
  if (!token) return null;
  const tokenHash = await sha256Text(token);
  const db = getDb();
  const [report] = await db
    .select()
    .from(legacyReports)
    .where(eq(legacyReports.confirmationTokenHash, tokenHash))
    .limit(1);
  if (!report) return null;
  const bundle = await getLegacyReportBundle(report.id);
  if (!bundle) return null;
  const membership = await getOrganizationForUser(user.userId);
  const authorized =
    isIcsAdmin(user) ||
    membership?.organization.id === report.submittingOrganizationId ||
    membership?.organization.id === report.issuerOrganizationId ||
    user.email.toLowerCase() === report.confirmationEmail.toLowerCase();
  if (!authorized) return null;
  return { ...bundle, membership };
}

export async function getLegacyConfirmation(user: ChatGPTUser, token: string) {
  return getLegacyReportForToken(user, token);
}

export async function getLegacyDocument(user: ChatGPTUser, reportId: string) {
  const bundle = await getLegacyReportForUser(user, reportId);
  if (!bundle) return null;
  const object = await documentsBucket().get(bundle.report.sourceObjectKey);
  if (!object) return null;
  return { report: bundle.report, object };
}

export async function updateLegacyReportTranscription(
  user: ChatGPTUser,
  reportIdValue: string,
  value: unknown,
) {
  const reportId = normalizeText(reportIdValue, 120);
  const bundle = await getLegacyReportBundle(reportId);
  const membership = await getOrganizationForUser(user.userId);
  if (
    !bundle ||
    !membership ||
    membership.organization.id !== bundle.report.submittingOrganizationId
  ) {
    throw new TecAuthorizationError("Only the submitting organization can correct this transcription.");
  }
  if (!["awaiting_lab_claim", "needs_submitter_correction"].includes(bundle.report.status)) {
    throw new TecInputError(
      "The transcription is locked while it is claimed for laboratory review.",
    );
  }
  const body = (value ?? {}) as Record<string, unknown>;
  const sampleName = normalizeText(body.sampleName);
  if (!sampleName) throw new TecInputError("Sample name is required.");
  const results = validateResults(body.results);
  const issuer = bundle.report.issuerOrganizationId
    ? (await getOrganizationsForReport(bundle.report)).issuer
    : null;
  const status = !bundle.report.issuerOrganizationId
    ? "awaiting_lab_claim"
    : issuer?.issuerStatus === "verified"
      ? "ready_for_signature"
      : "awaiting_issuer_verification";
  const updatedAt = now();
  const db = getDb();
  const update = db
    .update(legacyReports)
    .set({
      sampleName,
      lotNumber: normalizeText(body.lotNumber, 120) || null,
      matrix: normalizeText(body.matrix, 120) || null,
      method: normalizeText(body.method, 160) || null,
      reportNumber: normalizeText(body.reportNumber, 120) || null,
      orderNumber: normalizeText(body.orderNumber, 120) || null,
      collectedAt: normalizeDate(body.collectedAt),
      receivedAt: normalizeDate(body.receivedAt),
      testedAt: normalizeDate(body.testedAt),
      releasedAt: normalizeDate(body.releasedAt),
      status,
      discrepancyNote: null,
      updatedAt,
    })
    .where(eq(legacyReports.id, reportId));
  const deleteResults = db
    .delete(legacyReportResults)
    .where(eq(legacyReportResults.legacyReportId, reportId));
  const resultInserts = results.map((row, sequence) =>
    db.insert(legacyReportResults).values({
      legacyReportId: reportId,
      analyte: row.analyte,
      symbol: row.symbol ?? null,
      resultText: row.resultText,
      numericValue: row.numericValue ?? null,
      unit: row.unit,
      loqText: row.loqText ?? null,
      method: row.method ?? null,
      sequence,
    }),
  );
  await db.batch([
    update,
    deleteResults,
    ...resultInserts,
    reportEvent(reportId, membership.organization.id, user.userId, "report.transcription_corrected", {
      resultCount: results.length,
      priorDiscrepancy: bundle.report.discrepancyNote,
      status,
    }),
    db.insert(auditEvents).values({
      id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
      organizationId: membership.organization.id,
      actorUserId: user.userId,
      eventType: "legacy_report.transcription_corrected",
      entityType: "legacy_report",
      entityId: reportId,
      payload: JSON.stringify({ resultCount: results.length, status }),
      createdAt: updatedAt,
    }),
  ]);
  return { id: reportId, status };
}

function reportEvent(
  reportId: string,
  organizationId: string | null,
  actorUserId: string | null,
  eventType: string,
  payload: Record<string, unknown> = {},
) {
  return getDb().insert(legacyReportEvents).values({
    id: `levent_${crypto.randomUUID().replaceAll("-", "")}`,
    legacyReportId: reportId,
    organizationId,
    actorUserId,
    eventType,
    payload: JSON.stringify(payload),
    createdAt: now(),
  });
}

export async function claimLegacyReport(user: ChatGPTUser, token: string) {
  const bundle = await getLegacyReportForToken(user, token);
  if (!bundle) throw new TecAuthorizationError("This confirmation request is unavailable.");
  if (user.email.toLowerCase() !== bundle.report.confirmationEmail.toLowerCase()) {
    throw new TecAuthorizationError("Use the laboratory email address named in this request.");
  }
  if (!bundle.membership || bundle.membership.organization.organizationType !== "laboratory") {
    throw new TecAuthorizationError(
      "A laboratory organization account is required to claim this report.",
    );
  }
  if (
    bundle.report.issuerOrganizationId &&
    bundle.report.issuerOrganizationId !== bundle.membership.organization.id
  ) {
    throw new TecAuthorizationError("This report has already been claimed by another organization.");
  }
  if (["issued", "withdrawn", "declined"].includes(bundle.report.status)) {
    throw new TecInputError("This report can no longer be claimed.");
  }
  const claimedAt = now();
  const status =
    bundle.membership.organization.issuerStatus === "verified"
      ? "ready_for_signature"
      : "awaiting_issuer_verification";
  const db = getDb();
  await db.batch([
    db
      .update(legacyReports)
      .set({
        issuerOrganizationId: bundle.membership.organization.id,
        claimedByUserId: user.userId,
        claimedAt,
        status,
        discrepancyNote: null,
        updatedAt: claimedAt,
      })
      .where(eq(legacyReports.id, bundle.report.id)),
    reportEvent(
      bundle.report.id,
      bundle.membership.organization.id,
      user.userId,
      "report.claimed",
      { status },
    ),
  ]);
  return { id: bundle.report.id, status };
}

export async function flagLegacyReportDiscrepancy(
  user: ChatGPTUser,
  token: string,
  noteValue: unknown,
) {
  const bundle = await getLegacyReportForToken(user, token);
  if (!bundle?.membership || bundle.report.issuerOrganizationId !== bundle.membership.organization.id) {
    throw new TecAuthorizationError("Only the claiming laboratory can flag this transcription.");
  }
  const note = normalizeText(noteValue, 1200);
  if (!note) throw new TecInputError("Describe the discrepancy that the submitter must resolve.");
  const updatedAt = now();
  const db = getDb();
  await db.batch([
    db
      .update(legacyReports)
      .set({ status: "needs_submitter_correction", discrepancyNote: note, updatedAt })
      .where(eq(legacyReports.id, bundle.report.id)),
    reportEvent(
      bundle.report.id,
      bundle.membership.organization.id,
      user.userId,
      "report.discrepancy_flagged",
      { note },
    ),
  ]);
  return { id: bundle.report.id, status: "needs_submitter_correction" };
}

export async function declineLegacyReport(
  user: ChatGPTUser,
  token: string,
  noteValue: unknown,
) {
  const bundle = await getLegacyReportForToken(user, token);
  if (!bundle) throw new TecAuthorizationError("This confirmation request is unavailable.");
  if (user.email.toLowerCase() !== bundle.report.confirmationEmail.toLowerCase()) {
    throw new TecAuthorizationError("Only the invited laboratory contact can decline this request.");
  }
  const note = normalizeText(noteValue, 1200);
  if (!note) throw new TecInputError("A decline reason is required.");
  const declinedAt = now();
  const db = getDb();
  await db.batch([
    db
      .update(legacyReports)
      .set({
        status: "declined",
        discrepancyNote: note,
        declinedAt,
        updatedAt: declinedAt,
      })
      .where(eq(legacyReports.id, bundle.report.id)),
    reportEvent(
      bundle.report.id,
      bundle.membership?.organization.id ?? null,
      user.userId,
      "report.declined",
      { note },
    ),
  ]);
  return { id: bundle.report.id, status: "declined" };
}

function legacyCredentialValue(
  bundle: NonNullable<Awaited<ReturnType<typeof getLegacyReportBundle>>>,
  proof?: CredentialProofInput,
) {
  if (!bundle.submitter) throw new Error("The submitting organization is unavailable.");
  return {
    sampleName: bundle.report.sampleName,
    lotNumber: bundle.report.lotNumber ?? undefined,
    matrix: bundle.report.matrix ?? undefined,
    method: bundle.report.method ?? undefined,
    submittingParty: bundle.submitter.name,
    collectedAt: bundle.report.collectedAt ?? undefined,
    receivedAt: bundle.report.receivedAt ?? undefined,
    testedAt: bundle.report.testedAt ?? undefined,
    releasedAt: bundle.report.releasedAt ?? undefined,
    publish: true,
    proof,
    sourceDocument: {
      sha256: bundle.report.sourceSha256,
      filename: bundle.report.sourceFilename,
      reportNumber: bundle.report.reportNumber ?? undefined,
      orderNumber: bundle.report.orderNumber ?? undefined,
      intakeId: bundle.report.id,
      issuanceBasis: "legacy_report_confirmation",
    },
    results: bundle.results.map((row) => ({
      analyte: row.analyte,
      symbol: row.symbol ?? undefined,
      resultText: row.resultText,
      numericValue: row.numericValue,
      unit: row.unit,
      loqText: row.loqText ?? undefined,
      method: row.method ?? undefined,
    })),
  };
}

async function requireIssuingLaboratory(user: ChatGPTUser, token: string) {
  const bundle = await getLegacyReportForToken(user, token);
  if (!bundle?.membership || bundle.report.issuerOrganizationId !== bundle.membership.organization.id) {
    throw new TecAuthorizationError("The claiming laboratory must perform this action.");
  }
  if (
    bundle.membership.organization.organizationType !== "laboratory" ||
    bundle.membership.organization.issuerStatus !== "verified"
  ) {
    throw new TecAuthorizationError(
      "ICS laboratory verification and a reviewed issuer key are required before issuance.",
    );
  }
  if (bundle.report.status === "needs_submitter_correction") {
    throw new TecInputError("Resolve the reported discrepancy before issuance.");
  }
  if (["declined", "withdrawn"].includes(bundle.report.status)) {
    throw new TecInputError("This report is not eligible for issuance.");
  }
  return bundle;
}

export async function getLegacySigningPayload(user: ChatGPTUser, token: string) {
  const bundle = await requireIssuingLaboratory(user, token);
  const value = legacyCredentialValue(bundle);
  const canonical = canonicalizeCredential(value);
  return {
    reportId: bundle.report.id,
    canonicalPayload: canonical.canonicalPayload,
    keyId: bundle.membership!.organization.issuerKeyId,
    algorithm: bundle.membership!.organization.issuerKeyAlgorithm,
  };
}

export async function issueLegacyReport(
  user: ChatGPTUser,
  token: string,
  proofValue: unknown,
) {
  const bundle = await requireIssuingLaboratory(user, token);
  const db = getDb();
  const [existing] = await db
    .select({ identifier: credentials.identifier })
    .from(credentials)
    .where(eq(credentials.legacyReportId, bundle.report.id))
    .limit(1);
  if (existing) {
    await db
      .update(legacyReports)
      .set({
        status: "issued",
        issuedCredentialIdentifier: existing.identifier,
        updatedAt: now(),
      })
      .where(eq(legacyReports.id, bundle.report.id));
    return { tecrid: existing.identifier, status: "issued", idempotent: true };
  }

  const proof = (proofValue ?? {}) as Partial<CredentialProofInput>;
  const normalizedProof: CredentialProofInput = {
    keyId: normalizeText(proof.keyId, 180),
    algorithm: proof.algorithm === "Ed25519" ? "Ed25519" : "Ed25519",
    signature: normalizeText(proof.signature, 500),
  };
  if (!normalizedProof.keyId || !normalizedProof.signature || proof.algorithm !== "Ed25519") {
    throw new TecInputError("A valid Ed25519 issuer proof is required.");
  }

  const credential = await createCredential(
    bundle.membership!.organization,
    user.userId,
    legacyCredentialValue(bundle, normalizedProof),
    { legacyReportId: bundle.report.id, issuanceBasis: "legacy_report_confirmation" },
  );
  const confirmedAt = now();
  await db.batch([
    db
      .update(legacyReports)
      .set({
        status: "issued",
        confirmedByUserId: user.userId,
        confirmedAt,
        issuedCredentialIdentifier: credential.identifier,
        updatedAt: confirmedAt,
      })
      .where(eq(legacyReports.id, bundle.report.id)),
    reportEvent(
      bundle.report.id,
      bundle.membership!.organization.id,
      user.userId,
      "report.confirmed_and_issued",
      { tecrid: credential.identifier, sourceSha256: bundle.report.sourceSha256 },
    ),
  ]);
  return { tecrid: credential.identifier, status: "issued", idempotent: false };
}

export async function listAllLegacyReportsForAdmin(user: ChatGPTUser) {
  if (!isIcsAdmin(user)) throw new TecAuthorizationError("ICS administrator access required.");
  return getDb()
    .select()
    .from(legacyReports)
    .orderBy(desc(legacyReports.createdAt))
    .limit(100);
}
