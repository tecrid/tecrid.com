// Use Vinext's native request CSP nonce propagation for its bootstrap and RSC scripts.
// This policy is generated here, never accepted from the browser.
export function prepareContentSecurityPolicy(request: Request) {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
  const policy = `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
  const headers = new Headers(request.headers);
  headers.set("content-security-policy", policy);
  headers.delete("content-security-policy-report-only");
  return { request: new Request(request, { headers }), policy };
}

export function applyContentSecurityPolicy(response: Response, policy: string, request?: Request) {
  const headers = new Headers(response.headers);
  const html = headers.get("content-type")?.includes("text/html") ?? false;
  const api = request ? new URL(request.url).pathname.startsWith("/api/") : false;
  const carriesIdentity = Boolean(request?.headers.has("cookie") || request?.headers.has("authorization"));
  if (!html && !api && !carriesIdentity) return response;
  // A nonce belongs to this response, and an API error must not be reused for another viewer.
  headers.set("cache-control", "private, no-store, max-age=0");
  const vary = new Set((headers.get("vary") || "").split(",").map((value) => value.trim()).filter(Boolean));
  vary.add("Cookie");
  vary.add("Authorization");
  headers.set("vary", [...vary].join(", "));
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  if (html) {
    headers.set("content-security-policy", policy);
    headers.set("x-frame-options", "DENY");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
