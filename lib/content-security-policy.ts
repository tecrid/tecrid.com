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

export function applyContentSecurityPolicy(response: Response, policy: string) {
  if (!response.headers.get("content-type")?.includes("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.set("content-security-policy", policy);
  // A nonce belongs to this response; do not let a shared cache reuse the document.
  headers.set("cache-control", "private, no-store, max-age=0");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
