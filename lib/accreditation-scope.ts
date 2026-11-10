export function parseScopeList(value: unknown, itemMaximum = 180, listMaximum = 400) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];
  const items: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const text = typeof entry === "string" ? entry.trim().slice(0, itemMaximum) : "";
    const key = normalizeScopeName(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(text);
    if (items.length > listMaximum) break;
  }
  return items;
}

export function storedScopeList(value: string | null | undefined) {
  if (!value) return [];
  try {
    return parseScopeList(JSON.parse(value));
  } catch {
    return [];
  }
}

export function normalizeScopeName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function evaluateAccreditationScope(input: {
  laboratorySite: string | null;
  analytes: string[];
  sites: string[] | null;
  accreditedAnalytes: string[] | null;
}) {
  const sites = input.sites ?? [];
  const siteKey = input.laboratorySite ? normalizeScopeName(input.laboratorySite) : "";
  const siteOnCertificate = sites.length
    ? Boolean(siteKey) && sites.some((site) => normalizeScopeName(site) === siteKey)
    : null;
  const accreditationLabel = sites.length
    ? siteOnCertificate ? "accredited" as const : "not_accredited" as const
    : null;
  const analytes = input.accreditedAnalytes ?? [];
  const analyteOnScope = analytes.length
    ? input.analytes.map((analyte) => analytes.some((item) => normalizeScopeName(item) === normalizeScopeName(analyte)))
    : input.analytes.map(() => null);
  return { accreditationLabel, siteOnCertificate, analyteOnScope };
}
