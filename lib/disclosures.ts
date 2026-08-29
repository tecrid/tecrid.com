import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import {
  auditEvents,
  disclosureBatches,
  disclosureImportRows,
  disclosureImports,
  disclosureProducts,
  disclosureResults,
  organizations,
} from "../db/schema";
import { getOrganizationForUser } from "./tec";

const MAX_CSV_BYTES = 1_000_000;
const MAX_ROWS = 250;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const REQUIRED_DISCLOSURE_ANALYTES = [
  { key: "lead", analyte: "Lead", symbol: "Pb", sequence: 0 },
  { key: "cadmium", analyte: "Cadmium", symbol: "Cd", sequence: 1 },
  { key: "arsenic", analyte: "Arsenic", symbol: "As", sequence: 2 },
  { key: "mercury", analyte: "Mercury", symbol: "Hg", sequence: 3 },
] as const;

export const DISCLOSURE_TEMPLATE_COLUMNS = [
  "product_name",
  "product_sku",
  "upc",
  "batch_code",
  "production_date",
  "shelf_life_end",
  "laboratory_name",
  "lab_report_number",
  "source_sha256",
  "lead_ppb",
  "lead_loq_ppb",
  "cadmium_ppb",
  "cadmium_loq_ppb",
  "arsenic_ppb",
  "arsenic_loq_ppb",
  "mercury_ppb",
  "mercury_loq_ppb",
] as const;

type ParsedDisclosureRow = Record<string, string>;

export class DisclosureInputError extends Error {
  status = 400;
}

export class DisclosureAuthorizationError extends Error {
  status = 403;
}

function clean(value: unknown, maximum = 240) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "product";
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isRealIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && formatDate(date) === value;
}

function addCalendarMonth(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const endOfTargetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, endOfTargetMonth));
  return formatDate(date);
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

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new DisclosureInputError("The CSV contains an unclosed quoted field.");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) {
    throw new DisclosureInputError("The CSV needs a header and at least one data row.");
  }

  const headers = rows[0].map((value, index) =>
    value.replace(/^\uFEFF/, "").trim().toLowerCase() || `column_${index + 1}`,
  );
  const duplicates = headers.filter((value, index) => headers.indexOf(value) !== index);
  if (duplicates.length) {
    throw new DisclosureInputError(`Duplicate CSV column: ${duplicates[0]}.`);
  }
  const missingColumns = DISCLOSURE_TEMPLATE_COLUMNS.filter(
    (column) => !headers.includes(column),
  );
  if (missingColumns.length) {
    throw new DisclosureInputError(
      `Missing required CSV columns: ${missingColumns.join(", ")}.`,
    );
  }
  if (rows.length - 1 > MAX_ROWS) {
    throw new DisclosureInputError(`One import may contain at most ${MAX_ROWS} rows.`);
  }

  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, clean(values[index] ?? "", 500)])),
  ) as ParsedDisclosureRow[];
}

function parseResult(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const match = normalized.match(/^(?:<\s*)?(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const numericValue = Number(match[1]);
  if (!Number.isFinite(numericValue) || numericValue < 0) return null;
  return { resultText: normalized.replace(/^<\s*/, "< "), numericValue };
}

function validateRow(row: ParsedDisclosureRow) {
  const errors: string[] = [];
  for (const field of [
    "product_name",
    "product_sku",
    "batch_code",
    "production_date",
    "shelf_life_end",
    "laboratory_name",
    "lab_report_number",
    "source_sha256",
  ]) {
    if (!row[field]) errors.push(`${field} is required`);
  }
  if (row.production_date && !isRealIsoDate(row.production_date)) {
    errors.push("production_date must be YYYY-MM-DD");
  }
  if (row.shelf_life_end && !isRealIsoDate(row.shelf_life_end)) {
    errors.push("shelf_life_end must be YYYY-MM-DD");
  }
  if (
    isRealIsoDate(row.production_date) &&
    isRealIsoDate(row.shelf_life_end) &&
    row.shelf_life_end < row.production_date
  ) {
    errors.push("shelf_life_end cannot precede production_date");
  }
  if (row.source_sha256 && !SHA256_PATTERN.test(row.source_sha256)) {
    errors.push("source_sha256 must be a 64-character SHA-256 digest");
  }
  for (const analyte of REQUIRED_DISCLOSURE_ANALYTES) {
    if (!parseResult(row[`${analyte.key}_ppb`])) {
      errors.push(`${analyte.key}_ppb must be a non-negative number or '< number'`);
    }
  }
  return errors;
}

async function requireOrganization(user: ChatGPTUser) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) {
    throw new DisclosureAuthorizationError(
      "Create an organization workspace before importing disclosures.",
    );
  }
  if (!["brand", "laboratory"].includes(membership.organization.organizationType)) {
    throw new DisclosureAuthorizationError(
      "Disclosure operations are currently available to brand and laboratory workspaces.",
    );
  }
  return membership;
}

export async function importDisclosureCsv(
  user: ChatGPTUser,
  input: { csv?: unknown; sourceName?: unknown },
) {
  const csv = typeof input.csv === "string" ? input.csv : "";
  if (!csv) throw new DisclosureInputError("Choose a CSV file to import.");
  if (new TextEncoder().encode(csv).byteLength > MAX_CSV_BYTES) {
    throw new DisclosureInputError("The CSV must be 1 MB or smaller.");
  }
  const rows = parseCsv(csv);
  const membership = await requireOrganization(user);
  const db = getDb();
  const importId = crypto.randomUUID();
  const sourceName = clean(input.sourceName, 180) || "disclosure-import.csv";
  const importSourceHash = await sha256(csv);

  await db.insert(disclosureImports).values({
    id: importId,
    organizationId: membership.organization.id,
    sourceName,
    sourceSha256: importSourceHash,
    rowCount: rows.length,
    createdByUserId: user.userId,
  });

  let readyRows = 0;
  let blockedRows = 0;
  const outcomes: Array<{
    rowNumber: number;
    status: "ready" | "blocked";
    batchId?: string;
    errors?: string[];
  }> = [];

  for (const [rowIndex, row] of rows.entries()) {
    const rowNumber = rowIndex + 2;
    const errors = validateRow(row);
    let batchId: string | undefined;

    if (!errors.length) {
      const [duplicate] = await db
        .select({ id: disclosureBatches.id })
        .from(disclosureBatches)
        .innerJoin(disclosureProducts, eq(disclosureBatches.productId, disclosureProducts.id))
        .where(
          and(
            eq(disclosureProducts.organizationId, membership.organization.id),
            eq(disclosureProducts.sku, row.product_sku),
            eq(disclosureBatches.batchCode, row.batch_code),
          ),
        )
        .limit(1);
      if (duplicate) errors.push("this product SKU and batch_code already exist");
    }

    if (!errors.length) {
      let [product] = await db
        .select()
        .from(disclosureProducts)
        .where(
          and(
            eq(disclosureProducts.organizationId, membership.organization.id),
            eq(disclosureProducts.sku, row.product_sku),
          ),
        )
        .limit(1);

      if (!product) {
        const productId = crypto.randomUUID();
        const productSlug = `${slugify(row.product_name)}-${slugify(row.product_sku)}-${productId.slice(0, 8)}`.slice(0, 150);
        await db.insert(disclosureProducts).values({
          id: productId,
          organizationId: membership.organization.id,
          name: row.product_name,
          slug: productSlug,
          sku: row.product_sku,
          upc: row.upc || null,
        });
        [product] = await db
          .select()
          .from(disclosureProducts)
          .where(eq(disclosureProducts.id, productId))
          .limit(1);
      }

      if (!product) throw new Error("Product creation failed.");
      batchId = crypto.randomUUID();
      await db.insert(disclosureBatches).values({
        id: batchId,
        organizationId: membership.organization.id,
        productId: product.id,
        importId,
        batchCode: row.batch_code,
        productionDate: row.production_date,
        shelfLifeEnd: row.shelf_life_end,
        retentionUntil: addCalendarMonth(row.shelf_life_end),
        laboratoryName: row.laboratory_name,
        labReportNumber: row.lab_report_number,
        sourceSha256: row.source_sha256.toLowerCase(),
      });
      await db.insert(disclosureResults).values(
        REQUIRED_DISCLOSURE_ANALYTES.map((analyte) => {
          const result = parseResult(row[`${analyte.key}_ppb`]);
          if (!result) throw new Error("Validated result was unavailable.");
          return {
            batchId: batchId as string,
            analyte: analyte.analyte,
            symbol: analyte.symbol,
            resultText: result.resultText,
            numericValue: result.numericValue,
            unit: "ppb",
            loqText: row[`${analyte.key}_loq_ppb`] || null,
            sequence: analyte.sequence,
          };
        }),
      );
      readyRows += 1;
      outcomes.push({ rowNumber, status: "ready", batchId });
    } else {
      blockedRows += 1;
      outcomes.push({ rowNumber, status: "blocked", errors });
    }

    await db.insert(disclosureImportRows).values({
      id: crypto.randomUUID(),
      importId,
      rowNumber,
      status: errors.length ? "blocked" : "ready",
      productName: row.product_name || null,
      batchCode: row.batch_code || null,
      payload: JSON.stringify(row),
      errors: errors.length ? JSON.stringify(errors) : null,
      disclosureBatchId: batchId ?? null,
    });
  }

  const status = blockedRows ? "completed_with_exceptions" : "completed";
  await db
    .update(disclosureImports)
    .set({ status, readyRows, blockedRows })
    .where(eq(disclosureImports.id, importId));
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    organizationId: membership.organization.id,
    actorUserId: user.userId,
    eventType: "disclosure_csv_imported",
    entityType: "disclosure_import",
    entityId: importId,
    payload: JSON.stringify({ sourceName, importSourceHash, rowCount: rows.length, readyRows, blockedRows }),
  });

  return { importId, status, rowCount: rows.length, readyRows, blockedRows, outcomes };
}

export async function listDisclosureOperations(user: ChatGPTUser) {
  const membership = await requireOrganization(user);
  const db = getDb();
  const [imports, batches, exceptions] = await Promise.all([
    db
      .select()
      .from(disclosureImports)
      .where(eq(disclosureImports.organizationId, membership.organization.id))
      .orderBy(desc(disclosureImports.createdAt))
      .limit(20),
    db
      .select({ batch: disclosureBatches, product: disclosureProducts })
      .from(disclosureBatches)
      .innerJoin(disclosureProducts, eq(disclosureBatches.productId, disclosureProducts.id))
      .where(eq(disclosureBatches.organizationId, membership.organization.id))
      .orderBy(desc(disclosureBatches.createdAt))
      .limit(100),
    db
      .select({ row: disclosureImportRows, sourceName: disclosureImports.sourceName })
      .from(disclosureImportRows)
      .innerJoin(disclosureImports, eq(disclosureImportRows.importId, disclosureImports.id))
      .where(
        and(
          eq(disclosureImports.organizationId, membership.organization.id),
          eq(disclosureImportRows.status, "blocked"),
        ),
      )
      .orderBy(desc(disclosureImportRows.createdAt))
      .limit(50),
  ]);
  return { membership, imports, batches, exceptions };
}

export async function publishDisclosureBatch(user: ChatGPTUser, batchIdValue: unknown) {
  const batchId = clean(batchIdValue, 100);
  if (!batchId) throw new DisclosureInputError("A disclosure batch is required.");
  const membership = await requireOrganization(user);
  const db = getDb();
  const [record] = await db
    .select({ batch: disclosureBatches, product: disclosureProducts })
    .from(disclosureBatches)
    .innerJoin(disclosureProducts, eq(disclosureBatches.productId, disclosureProducts.id))
    .where(
      and(
        eq(disclosureBatches.id, batchId),
        eq(disclosureBatches.organizationId, membership.organization.id),
      ),
    )
    .limit(1);
  if (!record) throw new DisclosureAuthorizationError("Disclosure batch not found.");
  if (record.batch.status === "published") return record;

  const results = await db
    .select()
    .from(disclosureResults)
    .where(eq(disclosureResults.batchId, batchId))
    .orderBy(asc(disclosureResults.sequence));
  const resultNames = new Set(results.map((result) => result.analyte));
  const complete = REQUIRED_DISCLOSURE_ANALYTES.every((item) => resultNames.has(item.analyte));
  if (
    !complete ||
    !record.product.name ||
    !record.product.sku ||
    !record.batch.batchCode ||
    !record.batch.productionDate ||
    !record.batch.shelfLifeEnd ||
    !record.batch.laboratoryName ||
    !record.batch.labReportNumber ||
    !SHA256_PATTERN.test(record.batch.sourceSha256)
  ) {
    throw new DisclosureInputError(
      "Publication is blocked until product, batch, dates, laboratory provenance, source fingerprint, and all four required metals are complete.",
    );
  }

  const publishedAt = new Date().toISOString();
  await db
    .update(disclosureBatches)
    .set({ status: "published", publicRecord: true, publishedAt, updatedAt: publishedAt })
    .where(eq(disclosureBatches.id, batchId));
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    organizationId: membership.organization.id,
    actorUserId: user.userId,
    eventType: "brand_disclosure_published",
    entityType: "disclosure_batch",
    entityId: batchId,
    payload: JSON.stringify({
      labConfirmed: record.batch.labConfirmed,
      linkedTecrid: record.batch.linkedTecrid,
      representation: record.batch.labConfirmed ? "laboratory_confirmed" : "brand_disclosure",
    }),
  });
  return { ...record, batch: { ...record.batch, status: "published", publicRecord: true, publishedAt } };
}

export async function getPublicDisclosurePortfolio(organizationSlug: string) {
  const db = getDb();
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, clean(organizationSlug, 120)))
    .limit(1);
  if (!organization) return null;
  const batches = await db
    .select({ batch: disclosureBatches, product: disclosureProducts })
    .from(disclosureBatches)
    .innerJoin(disclosureProducts, eq(disclosureBatches.productId, disclosureProducts.id))
    .where(
      and(
        eq(disclosureBatches.organizationId, organization.id),
        eq(disclosureBatches.publicRecord, true),
      ),
    )
    .orderBy(desc(disclosureBatches.productionDate))
    .limit(500);
  return { organization, batches };
}

export async function getPublicDisclosureFeed(organizationSlug: string) {
  const portfolio = await getPublicDisclosurePortfolio(organizationSlug);
  if (!portfolio) return null;
  if (!portfolio.batches.length) return {
    ...portfolio,
    resultsByBatch: new Map<string, (typeof disclosureResults.$inferSelect)[]>(),
  };
  const db = getDb();
  const results = await db
    .select()
    .from(disclosureResults)
    .where(inArray(disclosureResults.batchId, portfolio.batches.map((item) => item.batch.id)))
    .orderBy(asc(disclosureResults.batchId), asc(disclosureResults.sequence));
  const resultsByBatch = new Map<string, typeof results>();
  for (const result of results) {
    const list = resultsByBatch.get(result.batchId) ?? [];
    list.push(result);
    resultsByBatch.set(result.batchId, list);
  }
  return { ...portfolio, resultsByBatch };
}

export async function getPublicDisclosureBatch(organizationSlug: string, batchId: string) {
  const portfolio = await getPublicDisclosurePortfolio(organizationSlug);
  if (!portfolio) return null;
  const record = portfolio.batches.find((item) => item.batch.id === clean(batchId, 100));
  if (!record) return null;
  const db = getDb();
  const results = await db
    .select()
    .from(disclosureResults)
    .where(eq(disclosureResults.batchId, record.batch.id))
    .orderBy(asc(disclosureResults.sequence));
  return { organization: portfolio.organization, ...record, results };
}

export function publicDisclosureDocument(record: NonNullable<Awaited<ReturnType<typeof getPublicDisclosureBatch>>>) {
  return {
    schema: "https://tecrid.com/schemas/brand-disclosure/v1",
    type: "BrandDisclosure",
    id: record.batch.id,
    canonicalUrl: `https://tecrid.com/disclosures/${record.organization.slug}/${record.batch.id}`,
    representation: record.batch.labConfirmed ? "laboratory_confirmed" : "brand_disclosure",
    laboratoryConfirmation: record.batch.labConfirmed,
    linkedTecrid: record.batch.linkedTecrid,
    organization: { name: record.organization.name, slug: record.organization.slug },
    product: {
      name: record.product.name,
      sku: record.product.sku,
      upc: record.product.upc,
    },
    productionAggregate: {
      batchCode: record.batch.batchCode,
      productionDate: record.batch.productionDate,
      shelfLifeEnd: record.batch.shelfLifeEnd,
      retainUntil: record.batch.retentionUntil,
    },
    provenance: {
      laboratoryName: record.batch.laboratoryName,
      reportNumber: record.batch.labReportNumber,
      sourceSha256: record.batch.sourceSha256,
    },
    results: record.results.map((result) => ({
      analyte: result.analyte,
      symbol: result.symbol,
      result: result.resultText,
      numericValue: result.numericValue,
      unit: result.unit,
      loq: result.loqText,
    })),
    publishedAt: record.batch.publishedAt,
    boundary: "This record reports disclosed analytical data. It is not a safety or legal-compliance determination.",
  };
}

export function publicDisclosureFeedDocument(feed: NonNullable<Awaited<ReturnType<typeof getPublicDisclosureFeed>>>) {
  return {
    schema: "https://tecrid.com/schemas/brand-disclosure-feed/v1",
    type: "BrandDisclosureFeed",
    organization: { name: feed.organization.name, slug: feed.organization.slug },
    generatedAt: new Date().toISOString(),
    count: feed.batches.length,
    records: feed.batches.map(({ batch, product }) => ({
      id: batch.id,
      canonicalUrl: `https://tecrid.com/disclosures/${feed.organization.slug}/${batch.id}`,
      representation: batch.labConfirmed ? "laboratory_confirmed" : "brand_disclosure",
      laboratoryConfirmation: batch.labConfirmed,
      linkedTecrid: batch.linkedTecrid,
      product: { name: product.name, sku: product.sku, upc: product.upc },
      batchCode: batch.batchCode,
      productionDate: batch.productionDate,
      shelfLifeEnd: batch.shelfLifeEnd,
      retainUntil: batch.retentionUntil,
      laboratoryName: batch.laboratoryName,
      laboratoryReportNumber: batch.labReportNumber,
      sourceSha256: batch.sourceSha256,
      results: (feed.resultsByBatch.get(batch.id) ?? []).map((result) => ({
        analyte: result.analyte,
        result: result.resultText,
        numericValue: result.numericValue,
        unit: result.unit,
        loq: result.loqText,
      })),
      publishedAt: batch.publishedAt,
    })),
    boundary: "These records report disclosed analytical data. They are not safety or legal-compliance determinations.",
  };
}
