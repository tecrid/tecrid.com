import { and, asc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../db";
import {
  auditEvents,
  legacyReportEvents,
  legacyReportResults,
  legacyReports,
  organizations,
} from "../db/schema";
import { privateFetch } from "./private-fetch";
import { takeBudget, type BudgetDb } from "./abuse-budget";
import {
  canonicalizeCredential,
  createCredential,
  generateTecridIdentifier,
  TecAuthorizationError,
  TecDuplicateDocumentError,
  TecExistingReferenceError,
  TecInputError,
  type CredentialResultInput,
} from "./tec";

export const LEGACY_BACKFILL_MAX = 25;
export const LEGACY_BACKFILL_PER_MINUTE = 10;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

export const LEGACY_BACKFILL_CHUNKING =
  "Each call accepts 25 reports. This laboratory can send 10 backfill calls per minute. For more reports, send the next chunk. A repeated PDF SHA-256 returns the existing record and does not create a second TECRID.";

export class LegacyBackfillRateLimitError extends Error {
  status = 429;
}

type BackfillItemResult = {
  index: number;
  status: "created" | "existing" | "error";
  legacyReportId?: string;
  sha256?: string;
  tecrid?: string;
  reportId?: string | null;
  originalReportDate?: string | null;
  backfilled?: boolean;
  minted?: boolean;
  canonicalPayload?: string;
  credential?: ReturnType<typeof credentialBody>;
  reason?: string;
};

type BackfillResult = {
  analyte: string;
  symbol?: string;
  resultText: string;
  numericValue?: number | null;
  unit: string;
  loqText?: string;
  method?: string;
};

type BackfillItem = {
  reportId: string | null;
  sampleId: string | null;
  sampleName: string;
  originalReportDate: string;
  laboratorySite: string | null;
  sha256: string;
  filename: string;
  pdfUrl: string | null;
  lotNumber: string | null;
  matrix: string | null;
  method: string | null;
  results: BackfillResult[];
  proof: unknown;
};

function text(value: unknown, maximum = 180) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function now() {
  return new Date().toISOString();
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Bytes(value: BufferSource) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return bytesToHex(new Uint8Array(digest));
}

async function sha256Text(value: string) {
  return sha256Bytes(new TextEncoder().encode(value));
}

function documentsBucket() {
  const bucket = (env as unknown as { DOCUMENTS?: R2Bucket }).DOCUMENTS;
  if (!bucket) throw new Error("Private document storage is not available.");
  return bucket;
}

function parseResults(value: unknown): BackfillResult[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
    throw new TecInputError("Provide between 1 and 100 analytical results.");
  }
  return value.map((entry, index) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const analyte = text(row.analyte, 100);
    const resultText = text(row.resultText, 80);
    const unit = text(row.unit, 40);
    if (!analyte || !resultText || !unit) {
      throw new TecInputError(`Result ${index + 1} requires an analyte, result text, and unit.`);
    }
    return {
      analyte,
      symbol: text(row.symbol, 12) || undefined,
      resultText,
      numericValue: typeof row.numericValue === "number" && Number.isFinite(row.numericValue) ? row.numericValue : null,
      unit,
      loqText: text(row.loqText, 80) || undefined,
      method: text(row.method, 120) || undefined,
    };
  });
}

function reportDate(value: unknown) {
  const date = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TecInputError("originalReportDate must use YYYY-MM-DD.");
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new TecInputError("originalReportDate must be a real date.");
  }
  return date;
}

function itemFromRecord(value: Record<string, unknown>): BackfillItem {
  const sha256 = text(value.sha256, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new TecInputError("Each report requires a lowercase SHA-256 fingerprint.");
  const reportId = text(value.reportId, 120) || null;
  const sampleId = text(value.sampleId, 120) || null;
  if (!reportId && !sampleId) throw new TecInputError("Each backfilled report needs a report ID or sample ID.");
  const sampleName = text(value.sampleName);
  const filename = text(value.filename, 240);
  if (!sampleName || !filename) throw new TecInputError("Each backfilled report needs a sample name and filename.");
  return {
    reportId,
    sampleId,
    sampleName,
    originalReportDate: reportDate(value.originalReportDate),
    laboratorySite: text(value.laboratorySite, 180) || null,
    sha256,
    filename,
    pdfUrl: text(value.pdfUrl, 500) || null,
    lotNumber: text(value.lotNumber, 120) || null,
    matrix: text(value.matrix, 120) || null,
    method: text(value.method, 160) || null,
    results: parseResults(value.results),
    proof: value.proof,
  };
}

function parseCsv(textValue: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < textValue.length; index += 1) {
    const char = textValue[index];
    if (quoted) {
      if (char === '"') {
        if (textValue[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && textValue[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function itemsFromCsv(source: string) {
  const table = parseCsv(source);
  const header = table.shift();
  if (!header) throw new TecInputError("The CSV manifest needs a header row.");
  const keys = header.map((column) => column.trim());
  const grouped = new Map<string, Record<string, unknown>>();
  for (const cells of table) {
    const record = Object.fromEntries(keys.map((key, index) => [key, cells[index] ?? ""]));
    const sha = text(record.sha256, 64).toLowerCase();
    if (!sha) throw new TecInputError("Each CSV row needs a sha256 value.");
    const existing = grouped.get(sha);
    const result = {
      analyte: record.analyte,
      symbol: record.symbol,
      resultText: record.resultText,
      unit: record.unit,
      loqText: record.loqText,
      method: record.method,
      numericValue: record.numericValue === "" || record.numericValue === undefined ? null : Number(record.numericValue),
    };
    if (!existing) grouped.set(sha, { ...record, sha256: sha, results: [result] });
    else (existing.results as unknown[]).push(result);
  }
  return [...grouped.values()].map((record) => itemFromRecord(record));
}

function itemsFromJson(value: unknown) {
  const records = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: unknown[] }).items
      : null;
  if (!records) throw new TecInputError("Send a JSON items array or a CSV manifest.");
  return records.map((record) => itemFromRecord((record ?? {}) as Record<string, unknown>));
}

function itemsFromManifest(manifest: string) {
  const trimmed = manifest.trim();
  if (!trimmed) throw new TecInputError("The manifest is empty.");
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return itemsFromJson(JSON.parse(trimmed));
    } catch (error) {
      if (error instanceof TecInputError) throw error;
      throw new TecInputError("The JSON manifest could not be read.");
    }
  }
  return itemsFromCsv(trimmed);
}

function assertManifestSize(items: BackfillItem[]) {
  if (items.length > LEGACY_BACKFILL_MAX) {
    throw new TecInputError(`A backfill accepts at most ${LEGACY_BACKFILL_MAX} reports. Split the manifest and send the next chunk.`);
  }
  if (!items.length) throw new TecInputError("At least one report is required.");
}

function blockedAddress(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.includes(":")) return true;
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0 || a >= 224) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function publicPdfUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new TecInputError("pdfUrl must be a complete https URL."); }
  if (url.protocol !== "https:" || url.username || url.password || blockedAddress(url.hostname)) {
    throw new TecInputError("pdfUrl must be a public https URL.");
  }
  return url;
}

async function readLimited(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new TecInputError("The PDF response was empty.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PDF_BYTES) throw new TecInputError("The PDF must be 20 MB or smaller.");
      chunks.push(value);
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

async function pdfBytes(item: BackfillItem, files: Map<string, ArrayBuffer>, transport: typeof fetch) {
  const uploaded = files.get(item.filename);
  if (uploaded) return uploaded;
  if (!item.pdfUrl) throw new TecInputError("Attach the PDF or provide a pdfUrl and sha256.");
  const url = publicPdfUrl(item.pdfUrl);
  const response = await transport(url, { method: "GET", redirect: "error" });
  if (!response.ok) throw new TecInputError("The PDF URL did not return the report.");
  return readLimited(response);
}

function credentialBody(
  item: BackfillItem,
  tecrid: string,
  results: CredentialResultInput[],
) {
  return {
    tecrid,
    reportId: item.reportId,
    sampleId: item.sampleId,
    laboratorySite: item.laboratorySite,
    sampleName: item.sampleName,
    lotNumber: item.lotNumber,
    matrix: item.matrix,
    method: item.method,
    releasedAt: item.originalReportDate,
    publish: true,
    backfill: true,
    originalReportDate: item.originalReportDate,
    sourceDocument: {
      sha256: item.sha256,
      filename: item.filename,
      reportNumber: item.reportId ?? undefined,
      orderNumber: item.sampleId ?? undefined,
      issuanceBasis: "backfill",
    },
    results,
  };
}

async function storedResults(reportId: string) {
  return getDb()
    .select()
    .from(legacyReportResults)
    .where(eq(legacyReportResults.legacyReportId, reportId))
    .orderBy(asc(legacyReportResults.sequence));
}

function resultsFromRows(rows: Array<typeof legacyReportResults.$inferSelect>): CredentialResultInput[] {
  return rows.map((row) => ({
    analyte: row.analyte,
    symbol: row.symbol ?? undefined,
    resultText: row.resultText,
    numericValue: row.numericValue,
    unit: row.unit,
    loqText: row.loqText ?? undefined,
    method: row.method ?? undefined,
  }));
}

async function mintBackfill(
  organization: typeof organizations.$inferSelect,
  actorUserId: string,
  report: typeof legacyReports.$inferSelect,
  item: BackfillItem,
  results: CredentialResultInput[],
) {
  const tecrid = report.pendingCredentialIdentifier || report.issuedCredentialIdentifier || generateTecridIdentifier(organization.issuerCode);
  if (!report.pendingCredentialIdentifier && !report.issuedCredentialIdentifier) {
    await getDb().update(legacyReports).set({ pendingCredentialIdentifier: tecrid, updatedAt: now() }).where(eq(legacyReports.id, report.id));
  }
  const credential = await createCredential(
    organization,
    actorUserId,
    { ...credentialBody(item, tecrid, results), proof: item.proof },
    { legacyReportId: report.id, issuanceBasis: "backfill", reservedIdentifier: tecrid },
  );
  const confirmedAt = now();
  await getDb().batch([
    getDb().update(legacyReports).set({
      status: "issued",
      issuedCredentialIdentifier: credential.identifier,
      confirmedAt,
      updatedAt: confirmedAt,
    }).where(eq(legacyReports.id, report.id)),
    getDb().insert(legacyReportEvents).values({
      id: `levent_${crypto.randomUUID().replaceAll("-", "")}`,
      legacyReportId: report.id,
      organizationId: organization.id,
      actorUserId,
      eventType: "report.backfilled_and_issued",
      payload: JSON.stringify({ tecrid: credential.identifier, sourceSha256: item.sha256 }),
      createdAt: confirmedAt,
    }),
  ]);
  return credential.identifier;
}

export async function importLegacyBackfill(
  organization: typeof organizations.$inferSelect,
  actorUserId: string,
  source: { json?: unknown; form?: FormData },
  transport: typeof fetch = privateFetch,
) {
  const files = new Map<string, ArrayBuffer>();
  let items: BackfillItem[];
  if (source.form) {
    let manifest = "";
    for (const [key, value] of source.form.entries()) {
      if (key === "manifest") manifest = value instanceof File ? await value.text() : String(value);
      else if (value instanceof File) files.set(value.name, await value.arrayBuffer());
    }
    items = itemsFromManifest(manifest);
  } else items = itemsFromJson(source.json);
  assertManifestSize(items);
  const database = (env as unknown as { DB?: BudgetDb }).DB;
  if (!await takeBudget(database, "legacy-backfill", organization.id, LEGACY_BACKFILL_PER_MINUTE, 60_000)) {
    throw new LegacyBackfillRateLimitError("Backfill is limited to 10 requests per minute for each laboratory. A repeated PDF SHA-256 returns the existing record.");
  }

  const db = getDb();
  const results: BackfillItemResult[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    try {
      const [existing] = await db.select().from(legacyReports).where(and(
        eq(legacyReports.submittingOrganizationId, organization.id),
        eq(legacyReports.sourceSha256, item.sha256),
      )).limit(1);
      if (existing) {
        if (existing.issuedCredentialIdentifier) {
          results.push({
            index, status: "existing" as const, legacyReportId: existing.id, sha256: item.sha256,
            tecrid: existing.issuedCredentialIdentifier, originalReportDate: existing.originalReportDate,
            backfilled: true, minted: false,
          });
          continue;
        }
        const rows = resultsFromRows(await storedResults(existing.id));
        const tecrid = existing.pendingCredentialIdentifier || generateTecridIdentifier(organization.issuerCode);
        if (!existing.pendingCredentialIdentifier) {
          await db.update(legacyReports).set({ pendingCredentialIdentifier: tecrid, updatedAt: now() }).where(eq(legacyReports.id, existing.id));
          existing.pendingCredentialIdentifier = tecrid;
        }
        const replayItem = {
          ...item,
          reportId: item.reportId || existing.reportNumber,
          sampleId: item.sampleId || existing.orderNumber,
          sampleName: existing.sampleName,
          originalReportDate: existing.originalReportDate || item.originalReportDate,
          laboratorySite: item.laboratorySite,
        };
        const body = credentialBody(replayItem, tecrid, rows);
        if (item.proof) {
          const minted = await mintBackfill(organization, actorUserId, existing, replayItem, rows);
          results.push({
            index, status: "existing" as const, legacyReportId: existing.id, sha256: item.sha256,
            tecrid: minted, originalReportDate: existing.originalReportDate, backfilled: true, minted: true,
          });
        } else {
          results.push({
            index, status: "existing" as const, legacyReportId: existing.id, sha256: item.sha256,
            tecrid, originalReportDate: existing.originalReportDate, backfilled: true, minted: false,
            canonicalPayload: canonicalizeCredential(body).canonicalPayload,
            credential: body,
          });
        }
        continue;
      }

      const bytes = await pdfBytes(item, files, transport);
      if (bytes.byteLength < 5 || bytes.byteLength > MAX_PDF_BYTES) throw new TecInputError("The PDF must be between 5 bytes and 20 MB.");
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new TecInputError("The uploaded file is not a valid PDF.");
      const actualSha = await sha256Bytes(bytes);
      if (actualSha !== item.sha256) throw new TecInputError("The PDF SHA-256 does not match the manifest.");
      const id = `intake_${crypto.randomUUID().replaceAll("-", "")}`;
      const tecrid = generateTecridIdentifier(organization.issuerCode);
      const createdAt = now();
      const objectKey = `legacy-reports/${organization.id}/${id}/${item.sha256}.pdf`;
      const tokenHash = await sha256Text(`${id}:${crypto.randomUUID()}`);
      await documentsBucket().put(objectKey, bytes, {
        httpMetadata: { contentType: "application/pdf" },
        customMetadata: { sha256: item.sha256, intakeId: id, submittingOrganizationId: organization.id, backfill: "true" },
      });
      try {
        await db.batch([
          db.insert(legacyReports).values({
            id,
            submittingOrganizationId: organization.id,
            issuerOrganizationId: organization.id,
            submittedByUserId: actorUserId,
            status: "backfilled",
            laboratoryName: organization.name,
            laboratoryWebsite: organization.website,
            confirmationEmail: organization.ownerEmail,
            confirmationTokenHash: tokenHash,
            confirmationTokenLastFour: tokenHash.slice(-4),
            sampleName: item.sampleName,
            lotNumber: item.lotNumber,
            matrix: item.matrix,
            method: item.method,
            reportNumber: item.reportId,
            orderNumber: item.sampleId,
            releasedAt: item.originalReportDate,
            sourceObjectKey: objectKey,
            sourceFilename: item.filename,
            sourceMimeType: "application/pdf",
            sourceSize: bytes.byteLength,
            sourceSha256: item.sha256,
            documentVisibility: "private",
            backfilled: true,
            originalReportDate: item.originalReportDate,
            pendingCredentialIdentifier: tecrid,
            createdAt,
            updatedAt: createdAt,
          }),
          ...item.results.map((row, sequence) => db.insert(legacyReportResults).values({
            legacyReportId: id,
            analyte: row.analyte,
            symbol: row.symbol ?? null,
            resultText: row.resultText,
            numericValue: row.numericValue ?? null,
            unit: row.unit,
            loqText: row.loqText ?? null,
            method: row.method ?? null,
            sequence,
          })),
          db.insert(legacyReportEvents).values({
            id: `levent_${crypto.randomUUID().replaceAll("-", "")}`,
            legacyReportId: id,
            organizationId: organization.id,
            actorUserId,
            eventType: "report.backfilled",
            payload: JSON.stringify({ sourceSha256: item.sha256, originalReportDate: item.originalReportDate }),
            createdAt,
          }),
          db.insert(auditEvents).values({
            id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
            organizationId: organization.id,
            actorUserId,
            eventType: "legacy_report.backfilled",
            entityType: "legacy_report",
            entityId: id,
            payload: JSON.stringify({ sourceSha256: item.sha256, originalReportDate: item.originalReportDate, reportId: item.reportId, sampleId: item.sampleId }),
            createdAt,
          }),
        ]);
      } catch (error) {
        await documentsBucket().delete(objectKey);
        throw error;
      }
      const [stored] = await db.select().from(legacyReports).where(eq(legacyReports.id, id)).limit(1);
      const body = credentialBody(item, tecrid, item.results);
      if (item.proof && stored) {
        const minted = await mintBackfill(organization, actorUserId, stored, item, item.results);
        results.push({
          index, status: "created" as const, legacyReportId: id, sha256: item.sha256, tecrid: minted,
          originalReportDate: item.originalReportDate, backfilled: true, minted: true,
        });
      } else {
        results.push({
          index, status: "created" as const, legacyReportId: id, sha256: item.sha256, tecrid,
          originalReportDate: item.originalReportDate, backfilled: true, minted: false,
          canonicalPayload: canonicalizeCredential(body).canonicalPayload,
          credential: body,
        });
      }
    } catch (error) {
      const known = error instanceof TecInputError || error instanceof TecAuthorizationError || error instanceof TecDuplicateDocumentError || error instanceof TecExistingReferenceError;
      results.push({
        index,
        status: "error" as const,
        sha256: item.sha256,
        reportId: item.reportId,
        originalReportDate: item.originalReportDate,
        backfilled: true,
        reason: known ? error.message : "This report could not be backfilled.",
        ...(error instanceof TecDuplicateDocumentError || error instanceof TecExistingReferenceError ? { tecrid: error.existingTecrid } : {}),
      });
    }
  }

  const summary = {
    created: results.filter((item) => item.status === "created").length,
    existing: results.filter((item) => item.status === "existing").length,
    errors: results.filter((item) => item.status === "error").length,
    minted: results.filter((item) => "minted" in item && item.minted).length,
  };
  return {
    summary,
    results,
    limit: { maxItems: LEGACY_BACKFILL_MAX, maxPdfBytes: MAX_PDF_BYTES, requestsPerMinute: LEGACY_BACKFILL_PER_MINUTE },
    chunking: LEGACY_BACKFILL_CHUNKING,
  };
}
