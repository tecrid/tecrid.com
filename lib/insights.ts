import { desc, eq, inArray } from "drizzle-orm";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import {
  controllerEvidenceReceipts,
  credentialResults,
  credentials,
  evidenceDeliveries,
  organizationNotifications,
} from "../db/schema";
import { getOrganizationForUser, TecAuthorizationError } from "./tec";

type SnapshotResult = {
  analyte?: string;
  resultText?: string;
  numericValue?: number | null;
  unit?: string;
  loqText?: string | null;
  method?: string | null;
};

type EvidenceRecord = {
  tecrid: string;
  sampleName: string;
  productSku: string | null;
  releasedAt: string | null;
  issuedAt: string | null;
  source: "issuer" | "controller_receipt" | "recipient_delivery";
  results: SnapshotResult[];
  missingAnalytes: string[];
};

function parseSnapshot(value: string) {
  try {
    return JSON.parse(value) as {
      tecrid?: string;
      issuedAt?: string | null;
      subject?: { sampleName?: string; productSku?: string | null; releasedAt?: string | null };
      results?: SnapshotResult[];
      resultsAccess?: { missingAnalytes?: string[] };
    };
  } catch {
    return {};
  }
}

function dateValue(value: string | null) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export async function getEvidenceInsightsForOrganization(organizationId: string) {
  const db = getDb();
  const [ownedCredentials, controllerReceipts, recipientDeliveries, notifications] = await Promise.all([
    db.select().from(credentials).where(eq(credentials.organizationId, organizationId)).orderBy(desc(credentials.createdAt)).limit(250),
    db.select().from(controllerEvidenceReceipts).where(eq(controllerEvidenceReceipts.controllerOrganizationId, organizationId)).orderBy(desc(controllerEvidenceReceipts.deliveredAt)).limit(250),
    db.select().from(evidenceDeliveries).where(eq(evidenceDeliveries.recipientOrganizationId, organizationId)).orderBy(desc(evidenceDeliveries.deliveredAt)).limit(250),
    db.select().from(organizationNotifications).where(eq(organizationNotifications.organizationId, organizationId)).orderBy(desc(organizationNotifications.createdAt)).limit(25),
  ]);
  const credentialIds = ownedCredentials.map((record) => record.identifier);
  const ownedResults = credentialIds.length
    ? await db.select().from(credentialResults).where(inArray(credentialResults.credentialIdentifier, credentialIds))
    : [];
  const resultsByCredential = new Map<string, SnapshotResult[]>();
  for (const result of ownedResults) {
    const list = resultsByCredential.get(result.credentialIdentifier) ?? [];
    list.push(result);
    resultsByCredential.set(result.credentialIdentifier, list);
  }

  const records: EvidenceRecord[] = ownedCredentials.map((record) => ({
    tecrid: record.identifier,
    sampleName: record.sampleName,
    productSku: record.productSku,
    releasedAt: record.releasedAt,
    issuedAt: record.issuedAt,
    source: "issuer",
    results: resultsByCredential.get(record.identifier) ?? [],
    missingAnalytes: [],
  }));
  for (const receipt of controllerReceipts) {
    const snapshot = parseSnapshot(receipt.snapshotJson);
    records.push({
      tecrid: receipt.credentialIdentifier,
      sampleName: snapshot.subject?.sampleName ?? "Laboratory evidence",
      productSku: snapshot.subject?.productSku ?? null,
      releasedAt: snapshot.subject?.releasedAt ?? null,
      issuedAt: snapshot.issuedAt ?? receipt.deliveredAt,
      source: "controller_receipt",
      results: snapshot.results ?? [],
      missingAnalytes: snapshot.resultsAccess?.missingAnalytes ?? [],
    });
  }
  for (const delivery of recipientDeliveries) {
    const snapshot = parseSnapshot(delivery.snapshotJson);
    records.push({
      tecrid: delivery.credentialIdentifier,
      sampleName: snapshot.subject?.sampleName ?? "Scoped evidence",
      productSku: snapshot.subject?.productSku ?? null,
      releasedAt: snapshot.subject?.releasedAt ?? null,
      issuedAt: snapshot.issuedAt ?? delivery.deliveredAt,
      source: "recipient_delivery",
      results: snapshot.results ?? [],
      missingAnalytes: snapshot.resultsAccess?.missingAnalytes ?? [],
    });
  }

  const deduplicated = new Map<string, EvidenceRecord>();
  for (const record of records) {
    const current = deduplicated.get(record.tecrid);
    if (!current || record.results.length > current.results.length) deduplicated.set(record.tecrid, record);
  }
  const evidence = [...deduplicated.values()].sort((a, b) => dateValue(b.releasedAt ?? b.issuedAt) - dateValue(a.releasedAt ?? a.issuedAt));
  const analytes = new Map<string, { name: string; count: number; units: Set<string>; latestResult: string; latestUnit: string; latestTecrid: string; latestAt: string | null }>();
  for (const record of evidence) {
    for (const result of record.results) {
      const name = String(result.analyte ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const current = analytes.get(key);
      const at = record.releasedAt ?? record.issuedAt;
      const unit = String(result.unit ?? "");
      if (!current) {
        analytes.set(key, {
          name,
          count: 1,
          units: new Set(unit ? [unit] : []),
          latestResult: String(result.resultText ?? "—"),
          latestUnit: unit,
          latestTecrid: record.tecrid,
          latestAt: at,
        });
      } else {
        current.count += 1;
        if (unit) current.units.add(unit);
        if (dateValue(at) > dateValue(current.latestAt)) {
          current.latestResult = String(result.resultText ?? "—");
          current.latestUnit = unit;
          current.latestTecrid = record.tecrid;
          current.latestAt = at;
        }
      }
    }
  }
  const skuCounts = new Map<string, number>();
  for (const record of evidence) {
    if (record.productSku) skuCounts.set(record.productSku, (skuCounts.get(record.productSku) ?? 0) + 1);
  }
  const missing = [...new Set(evidence.flatMap((record) => record.missingAnalytes))];
  return {
    summary: {
      tecrids: evidence.length,
      resultRows: evidence.reduce((sum, record) => sum + record.results.length, 0),
      skus: skuCounts.size,
      analytes: analytes.size,
      scopeExceptions: evidence.filter((record) => record.missingAnalytes.length > 0).length,
      unreadNotifications: notifications.filter((item) => item.status === "unread").length,
    },
    evidence: evidence.slice(0, 100),
    analytes: [...analytes.values()].map((item) => ({ ...item, units: [...item.units] })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    skus: [...skuCounts.entries()].map(([sku, count]) => ({ sku, count })).sort((a, b) => b.count - a.count || a.sku.localeCompare(b.sku)),
    missingAnalytes: missing,
    notifications,
    interpretationBoundary: "These are descriptive portfolio summaries of issued or delivered records. TECRID does not infer pass/fail, legal compliance, product safety, or comparability across different units and methods.",
  };
}

export async function getEvidenceInsightsForUser(user: ChatGPTUser) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) throw new TecAuthorizationError("Complete organization setup first.");
  return {
    membership,
    insights: await getEvidenceInsightsForOrganization(membership.organization.id),
  };
}
