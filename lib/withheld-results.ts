const COMMITMENT_KEYS = [
  "fingerprint",
  "signedPayloadHash",
  "issuerSignature",
  "signature",
  "canonicalPayload",
  "signedPayload",
  "controllerReceiptFingerprint",
] as const;

type EvidenceView = "full" | "partial" | "none";

function accessRecord(value: Record<string, unknown>) {
  const access = value.resultsAccess ?? value.resultAccess;
  return access && typeof access === "object" ? access as Record<string, unknown> : null;
}

function viewOf(value: Record<string, unknown>): EvidenceView | null {
  const access = accessRecord(value);
  if (!access) return null;
  const level = String(access.level ?? access.accessLevel ?? "");
  const state = String(access.state ?? "");
  if (level === "full_record" || state === "included") return "full";
  if (level === "status_only" || state === "controlled") return "none";
  if (level === "selected_analytes") return "partial";
  return null;
}

function allowedAnalytes(value: Record<string, unknown>) {
  const access = accessRecord(value);
  const delivered = access?.deliveredAnalytes ?? access?.analytes;
  if (!Array.isArray(delivered)) return null;
  return new Set(delivered.map((item) => String(item).toLowerCase()));
}

function stripCommitments(value: Record<string, unknown>) {
  for (const key of COMMITMENT_KEYS) {
    if (key in value) value[key] = null;
  }
  const integrity = value.integrity;
  if (integrity && typeof integrity === "object") stripCommitments(integrity as Record<string, unknown>);
  const proof = value.issuerProof;
  if (proof && typeof proof === "object") stripCommitments(proof as Record<string, unknown>);
  if (Array.isArray(value.versions)) {
    for (const version of value.versions) {
      if (version && typeof version === "object") stripCommitments(version as Record<string, unknown>);
    }
  }
}

function restrictResults(value: Record<string, unknown>, view: EvidenceView) {
  if (!Array.isArray(value.results)) return;
  if (view === "none") {
    value.results = [];
    return;
  }
  const allowed = allowedAnalytes(value);
  value.results = allowed
    ? value.results.filter((row) => row && typeof row === "object" && allowed.has(String((row as { analyte?: unknown }).analyte ?? "").toLowerCase()))
    : [];
}

function walk(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const view = viewOf(record);
  if (view === "none" || view === "partial") {
    restrictResults(record, view);
    stripCommitments(record);
  }
  for (const nested of Object.values(record)) walk(nested);
}

// Public and partial views must not carry a hash or signature that commits to
// withheld analyte values. A known payload shape makes those commitments brute-forceable.
export function redactUnentitledCommitments<T>(value: T): T {
  const copy = structuredClone(value);
  walk(copy);
  return copy;
}

export function entitledSnapshotResults(snapshot: {
  results?: Array<{ analyte?: string; resultText?: string; numericValue?: number | null; unit?: string; loqText?: string | null; method?: string | null }>;
  resultsAccess?: { deliveredAnalytes?: string[]; analytes?: string[]; accessLevel?: string; state?: string; missingAnalytes?: string[] };
}, accessLevel: string) {
  const results = snapshot.results ?? [];
  if (accessLevel === "full_record") return results;
  if (accessLevel === "status_only") return [];
  const names = snapshot.resultsAccess?.deliveredAnalytes ?? [];
  if (!names.length) return [];
  const allowed = new Set(names.map((item) => item.toLowerCase()));
  return results.filter((row) => row.analyte && allowed.has(row.analyte.toLowerCase()));
}
