export const API_SCOPES = ["read", "reports:write", "credentials:write", "legacy:write", "*"] as const;

export function normalizeApiScopes(value: unknown): string[] {
  if (value === undefined) return ["read"];
  if (!Array.isArray(value) || !value.length || value.some((scope) => !API_SCOPES.includes(scope))) {
    throw new Error("Choose valid API permissions.");
  }
  return [...new Set(value as string[])].sort();
}

// Unknown write routes fail closed for scoped keys. Existing keys retain their
// historical permissions until their owner rotates them.
export function apiRequestScope(request: Request): string | null {
  if (["GET", "HEAD"].includes(request.method)) return "read";
  const path = new URL(request.url).pathname;
  if (/^\/api\/v1\/report-reservations(?:\/|$)/.test(path)) return "reports:write";
  if (/^\/api\/v1\/credentials(?:\/|$)/.test(path)) return "credentials:write";
  if (path === "/api/v1/legacy-reports") return "legacy:write";
  return null;
}
