const CLIENT_IDENTITY_HEADERS = [
  "x-user-id",
  "x-userid",
  "x-user-email",
  "x-authenticated-user",
  "x-authenticated-user-id",
  "x-authenticated-user-email",
  "x-authenticated-user-name",
  "x-forwarded-user",
  "x-forwarded-user-id",
  "x-forwarded-email",
  "x-forwarded-preferred-username",
  "x-remote-user",
  "x-remote-email",
  "cf-access-authenticated-user-email",
  "cf-access-authenticated-user-id",
  "true-client-user",
];

const PLATFORM_IDENTITY_HEADERS = [
  "oai-authenticated-user-id",
  "oai-authenticated-user-email",
  "oai-authenticated-user-full-name",
  "oai-authenticated-user-full-name-encoding",
];

function timingSafeEqual(leftValue: string, rightValue: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(leftValue);
  const right = encoder.encode(rightValue);
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}

export function platformIdentityTrusted(headers: Headers, secret: string | undefined) {
  if (!secret || secret.length < 16) return false;
  return timingSafeEqual(headers.get("x-tecrid-platform-identity") ?? "", secret);
}

export function removeClientIdentityHeaders(headers: Headers, secret?: string) {
  for (const name of CLIENT_IDENTITY_HEADERS) headers.delete(name);
  if (!platformIdentityTrusted(headers, secret)) {
    for (const name of PLATFORM_IDENTITY_HEADERS) headers.delete(name);
  }
  headers.delete("x-tecrid-platform-identity");
}

const TRUSTED_ORIGINS = new Set(["https://tecrid.com", "https://www.tecrid.com"]);

export function sameSiteOrigin(origin: string | null, request: Pick<Request, "url" | "headers">) {
  if (!origin) return false;
  if (origin === new URL(request.url).origin || TRUSTED_ORIGINS.has(origin)) return true;
  // Behind the hosting proxy request.url can carry an internal host, so also
  // accept the public host the browser actually used.
  for (const name of ["x-forwarded-host", "host"]) {
    const host = request.headers.get(name)?.split(",")[0]?.trim();
    if (host && origin === `https://${host}`) return true;
  }
  return false;
}

export function rejectCrossOriginWrite(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || sameSiteOrigin(origin, request)) return null;
  // Pages send Referrer-Policy: no-referrer, so browsers send Origin: null on
  // plain form posts. Trust that only when the browser says it's same-origin.
  if (origin === "null" && request.headers.get("sec-fetch-site") === "same-origin") return null;
  return Response.json(
    { error: "Cross-origin state changes are not allowed." },
    { status: 403 },
  );
}
