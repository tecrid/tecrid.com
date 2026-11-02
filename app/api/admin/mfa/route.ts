import { getChatGPTUser } from "../../../chatgpt-auth";
import {
  beginAdminEnrollment,
  confirmAdminEnrollment,
  mfaCookie,
  verifyAdminSecondFactor,
} from "../../../../lib/admin-mfa";
import { rejectCrossOriginWrite } from "../../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../../lib/tec";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const body = await request.json() as { action?: string; code?: string };
    if (body.action === "enroll") {
      return Response.json(await beginAdminEnrollment(user));
    }
    if (body.action === "confirm") {
      const result = await confirmAdminEnrollment(user, String(body.code ?? ""));
      return Response.json({ recoveryCodes: result.recoveryCodes }, { headers: { "set-cookie": mfaCookie(result.cookie, request.url) } });
    }
    if (body.action === "verify") {
      const result = await verifyAdminSecondFactor(user, String(body.code ?? ""));
      return Response.json({ verified: true, expiresAt: result.expiresAt }, { headers: { "set-cookie": mfaCookie(result.cookie, request.url) } });
    }
    return Response.json({ error: "Unknown second-factor action." }, { status: 400 });
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json({ error: known ? error.message : "Second factor failed." }, { status: known ? error.status : 500 });
  }
}
