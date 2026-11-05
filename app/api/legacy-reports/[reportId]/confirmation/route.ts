import { getChatGPTUser } from "../../../../chatgpt-auth";
import { manageLegacyConfirmation } from "../../../../../lib/legacy-reports";
import { rejectCrossOriginWrite } from "../../../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../../../lib/tec";

const headers = { "cache-control": "private, no-store", vary: "cookie", "referrer-policy": "no-referrer" };

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401, headers });
  try {
    const { reportId } = await params;
    const text = await request.text();
    if (text.length > 1000) return Response.json({ error: "Request is too large." }, { status: 413, headers });
    const body = JSON.parse(text) as { action?: unknown };
    return Response.json(await manageLegacyConfirmation(user, decodeURIComponent(reportId), body.action), { headers });
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json({ error: known ? error.message : "Confirmation management failed." }, { status: known ? error.status : 500, headers });
  }
}
