import { getChatGPTUser } from "../../chatgpt-auth";
import { disableNotificationChannel, notificationDashboard, saveNotificationChannel, testNotificationChannel } from "../../../lib/notification-delivery";
import { rejectCrossOriginWrite } from "../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../lib/tec";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const crossOrigin = request.method === "GET" ? null : rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    if (request.method === "GET") return Response.json(await notificationDashboard(user), { headers: { "cache-control": "no-store" } });
    const input = await request.json();
    if (input.action === "test") return Response.json(await testNotificationChannel(user, String(input.id || "")));
    if (input.action === "disable") { await disableNotificationChannel(user, String(input.id || "")); return Response.json({ disabled: true }); }
    return Response.json(await saveNotificationChannel(user, input), { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const known = error instanceof TecInputError || error instanceof TecAuthorizationError;
    return Response.json({ error: known ? error.message : "Notification operation failed. Check channel configuration." }, { status: known ? error.status : 500, headers: { "cache-control": "no-store" } });
  }
}
export const GET = handle;
export const POST = handle;
