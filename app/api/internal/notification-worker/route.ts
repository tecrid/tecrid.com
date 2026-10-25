import { env } from "cloudflare:workers";
import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { processNotificationOutbox } from "../../../../lib/notification-delivery";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const secret = (env as unknown as Record<string, string>).TECRID_DELIVERY_WORKER_SECRET;
  const token = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret || ""}`;
  if (!secret || Buffer.byteLength(token) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return new Response(null, { status: 403 });
  return Response.json(await processNotificationOutbox(), { headers: { "cache-control": "no-store" } });
}
