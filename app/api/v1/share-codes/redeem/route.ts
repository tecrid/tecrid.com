import { getChatGPTUser } from "../../../../chatgpt-auth";
import { redeemEvidenceShareCode } from "../../../../../lib/sharing";
import { TecAuthorizationError, TecInputError } from "../../../../../lib/tec";

export async function POST(request: Request) {
  const headers = {"Cache-Control":"private, no-store", "Vary":"Cookie"};
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({error:"Same-origin request required."},{status:403,headers});
    const user = await getChatGPTUser();
    if (!user) return Response.json({error:"Sign in to redeem this recipient package."},{status:401,headers});
    return Response.json(await redeemEvidenceShareCode(await request.json(), user), {headers});
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
