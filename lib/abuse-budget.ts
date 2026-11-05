const encoder = new TextEncoder();

type BudgetStatement = {
  bind(...values: unknown[]): {
    run(): Promise<unknown>;
    first<T>(): Promise<T | null>;
  };
};

type BudgetDb = {
  prepare(query: string): BudgetStatement;
};

type BudgetEnv = {
  DB?: BudgetDb;
  TECRID_API_IP_LIMIT?: string;
  TECRID_API_PRINCIPAL_LIMIT?: string;
  TECRID_API_GLOBAL_LIMIT?: string;
};

export function configuredLimit(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : fallback;
}

export async function takeBudget(db: BudgetDb | undefined, scope: string, principal: string, limit: number, windowMs: number, at = Date.now()) {
  if (!db) throw new Error("Security budget storage unavailable.");
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(`${scope}\n${principal}`))), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const key = `tecrid-budget:${digest}`;
  await db.prepare("DELETE FROM auth_rate_limit WHERE key LIKE 'tecrid-budget:%' AND last_request < ?").bind(at - 86_400_000).run();
  const row = await db.prepare(`INSERT INTO auth_rate_limit (id, key, count, last_request) VALUES (?, ?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN auth_rate_limit.last_request <= ? THEN 1 ELSE auth_rate_limit.count + 1 END,
      last_request = CASE WHEN auth_rate_limit.last_request <= ? THEN excluded.last_request ELSE auth_rate_limit.last_request END
    RETURNING count`).bind(key, key, at, at - windowMs, at - windowMs).first<{ count: number }>();
  return Boolean(row && row.count <= limit);
}

function failure(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { "cache-control": "private, no-store", "retry-after": "60" } });
}

async function boundedText(request: Request, maximum: number) {
  const reader = request.clone().body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new Error("Too large");
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
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

// IP and principal denials return before the shared counter moves, so one client cannot exhaust everyone else.
export async function guardMutationRequest(request: Request, env: BudgetEnv) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/") || ["GET", "HEAD", "OPTIONS"].includes(request.method)) return request;
  try {
    const ipLimit = configuredLimit(env.TECRID_API_IP_LIMIT, 120);
    if (!await takeBudget(env.DB, "api-ip", request.headers.get("cf-connecting-ip") || "unavailable", ipLimit, 60_000)) {
      return failure(429, "Too many requests. Try again shortly.");
    }
    const principal = request.headers.get("authorization") || request.headers.get("cookie");
    if (principal && !await takeBudget(env.DB, "api-principal", principal, configuredLimit(env.TECRID_API_PRINCIPAL_LIMIT, 90), 60_000)) {
      return failure(429, "Too many requests. Try again shortly.");
    }
    const globalLimit = Math.max(configuredLimit(env.TECRID_API_GLOBAL_LIMIT, 3000), ipLimit * 25);
    if (!await takeBudget(env.DB, "api-global", "application", globalLimit, 60_000)) {
      return failure(429, "Too many requests. Try again shortly.");
    }
    if (request.headers.get("content-type")?.includes("application/json")) {
      try {
        const text = await boundedText(request, 128_000);
        return new Request(request, { body: text });
      } catch {
        return failure(413, "JSON request is too large.");
      }
    }
    return request;
  } catch {
    return failure(503, "Request security controls are temporarily unavailable.");
  }
}
