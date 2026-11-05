import { getChatGPTUser } from "../../../../chatgpt-auth";
import { redeemEvidenceShareCode } from "../../../../../lib/sharing";
import { rejectCrossOriginWrite } from "../../../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../../../lib/tec";

const headers = { "cache-control": "private, no-store", vary: "cookie" };

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  try {
    const user = await getChatGPTUser();
    return Response.json(await redeemEvidenceShareCode(await request.json(), user), { headers });
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    const status = known ? error.status : 500;
    return Response.json({
      error: {
        code: status === 403 ? "not_authorized" : status === 400 ? "invalid_request" : "internal_error",
        message: known ? error.message : "The evidence package could not be redeemed.",
      },
    }, { status, headers });
  }
}
