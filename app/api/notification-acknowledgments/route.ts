import { getChatGPTUser } from "../../chatgpt-auth";
import { acknowledgeOwnedNotification, acknowledgeSignedWebhook } from "../../../lib/notification-acknowledgments";
import { rejectCrossOriginWrite } from "../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../lib/tec";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 4096) throw new TecInputError("Acknowledgment body is too large.");
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 4096) throw new TecInputError("Acknowledgment body is too large.");
    if (request.headers.has("x-tecrid-signature")) return Response.json(await acknowledgeSignedWebhook(request, raw), { headers: { "cache-control": "no-store" } });
    const rejected = rejectCrossOriginWrite(request); if (rejected) return rejected;
    const user = await getChatGPTUser(); if (!user) return new Response(null, { status: 401 });
    return Response.json(await acknowledgeOwnedNotification(user, JSON.parse(raw)), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const known = error instanceof TecInputError || error instanceof TecAuthorizationError;
    return Response.json({ error: known ? error.message : "Acknowledgment could not be recorded." }, { status: known ? error.status : 400 });
  }
}
