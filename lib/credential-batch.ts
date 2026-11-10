import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { credentialBatchJobs, organizations } from "../db/schema";
import { takeBudget, type BudgetDb } from "./abuse-budget";
import {
  createCredential,
  TecAuthorizationError,
  TecDuplicateDocumentError,
  TecExistingReferenceError,
  TecInputError,
} from "./tec";

export const CREDENTIAL_BATCH_MAX = 500;
export const CREDENTIAL_BATCH_PER_MINUTE = 10;
export const CREDENTIAL_BATCH_MAX_BYTES = 2_000_000;

export const CREDENTIAL_BATCH_CHUNKING =
  "Each call accepts 500 credentials. This laboratory can send 10 batch calls per minute. For 10000 or more, split the list into chunks of 500 and repeat. A repeated reportId or sampleId returns the existing TECRID.";

export class BatchRateLimitError extends Error {
  status = 429;
}

export type CredentialBatchItemResult = {
  index: number;
  status: "created" | "existing" | "error";
  tecrid?: string;
  reportId?: string | null;
  sampleId?: string | null;
  reason?: string;
};

function text(value: unknown, maximum = 120) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function itemReference(value: unknown) {
  const input = (value ?? {}) as Record<string, unknown>;
  return {
    reportId: text(input.reportId) || null,
    sampleId: text(input.sampleId) || null,
  };
}

async function budgetAllows(organizationId: string) {
  const database = (env as unknown as { DB?: BudgetDb }).DB;
  return takeBudget(database, "credentials-batch", organizationId, CREDENTIAL_BATCH_PER_MINUTE, 60_000);
}

export async function createCredentialBatch(
  organization: typeof organizations.$inferSelect,
  value: unknown,
  options: { async?: boolean } = {},
) {
  if (!value || typeof value !== "object" || !Array.isArray((value as { credentials?: unknown }).credentials)) {
    throw new TecInputError("credentials must be an array.");
  }
  const items = (value as { credentials: unknown[] }).credentials;
  if (items.length > CREDENTIAL_BATCH_MAX) {
    throw new TecInputError(`A batch accepts at most ${CREDENTIAL_BATCH_MAX} credentials. Split the list and send the next chunk.`);
  }
  if (!items.length) throw new TecInputError("At least one credential is required.");
  if (!await budgetAllows(organization.id)) {
    throw new BatchRateLimitError("Batch issuance is limited to 10 requests per minute for each laboratory. Retry after the window. A repeated report or sample ID returns the existing TECRID.");
  }

  const results: CredentialBatchItemResult[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const reference = itemReference(items[index]);
    if (!reference.reportId && !reference.sampleId) {
      results.push({
        index,
        status: "error",
        reason: "A report ID or sample ID is required so a repeat returns the same TECRID.",
      });
      continue;
    }
    try {
      const credential = await createCredential(organization, null, items[index]);
      results.push({
        index,
        status: "created",
        tecrid: credential.identifier,
        reportId: reference.reportId,
        sampleId: reference.sampleId,
      });
    } catch (error) {
      if (error instanceof TecExistingReferenceError) {
        results.push({
          index,
          status: "existing",
          tecrid: error.existingTecrid,
          reportId: reference.reportId,
          sampleId: reference.sampleId,
        });
      } else if (error instanceof TecDuplicateDocumentError) {
        results.push({
          index,
          status: "error",
          tecrid: error.existingTecrid,
          reportId: reference.reportId,
          sampleId: reference.sampleId,
          reason: error.message,
        });
      } else if (error instanceof TecInputError || error instanceof TecAuthorizationError) {
        results.push({
          index,
          status: "error",
          reportId: reference.reportId,
          sampleId: reference.sampleId,
          reason: error.message,
        });
      } else {
        results.push({
          index,
          status: "error",
          reportId: reference.reportId,
          sampleId: reference.sampleId,
          reason: "This credential could not be issued.",
        });
      }
    }
  }

  const summary = {
    created: results.filter((item) => item.status === "created").length,
    existing: results.filter((item) => item.status === "existing").length,
    errors: results.filter((item) => item.status === "error").length,
  };
  const now = new Date().toISOString();
  const jobId = `batch_${crypto.randomUUID().replaceAll("-", "")}`;
  await getDb().insert(credentialBatchJobs).values({
    id: jobId,
    organizationId: organization.id,
    status: "complete",
    total: items.length,
    createdCount: summary.created,
    existingCount: summary.existing,
    errorCount: summary.errors,
    resultsJson: JSON.stringify(results),
    createdAt: now,
    completedAt: now,
  });
  return {
    jobId,
    status: "complete" as const,
    async: Boolean(options.async),
    summary,
    results,
    limit: {
      maxItems: CREDENTIAL_BATCH_MAX,
      requestsPerMinute: CREDENTIAL_BATCH_PER_MINUTE,
      maxBodyBytes: CREDENTIAL_BATCH_MAX_BYTES,
    },
    chunking: CREDENTIAL_BATCH_CHUNKING,
  };
}

export async function getCredentialBatchJob(organizationId: string, jobIdValue: string) {
  const jobId = text(jobIdValue, 80);
  if (!jobId) return null;
  const [job] = await getDb()
    .select()
    .from(credentialBatchJobs)
    .where(and(eq(credentialBatchJobs.id, jobId), eq(credentialBatchJobs.organizationId, organizationId)))
    .limit(1);
  if (!job) return null;
  return {
    jobId: job.id,
    status: job.status,
    summary: { created: job.createdCount, existing: job.existingCount, errors: job.errorCount },
    results: JSON.parse(job.resultsJson) as CredentialBatchItemResult[],
    limit: {
      maxItems: CREDENTIAL_BATCH_MAX,
      requestsPerMinute: CREDENTIAL_BATCH_PER_MINUTE,
      maxBodyBytes: CREDENTIAL_BATCH_MAX_BYTES,
    },
    chunking: CREDENTIAL_BATCH_CHUNKING,
  };
}
