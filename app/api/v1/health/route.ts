import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  try {
    const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    if (row?.ok !== 1) throw new Error("Database check failed");
    return Response.json(
      {
        status: "operational",
        service: "TEC Registry API",
        apiVersion: "v1",
        schemaVersion: "tec-registry/1.0-draft",
        checks: { registryDatabase: "operational" },
        checkedAt,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        status: "degraded",
        service: "TEC Registry API",
        apiVersion: "v1",
        checks: { registryDatabase: "unavailable" },
        checkedAt,
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
