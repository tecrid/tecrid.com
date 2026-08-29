import { redeemEvidenceShareCode } from "../../../../../lib/sharing";
import { TecAuthorizationError, TecInputError } from "../../../../../lib/tec";

export async function POST(request: Request) {
  try {
    return Response.json(await redeemEvidenceShareCode(await request.json()));
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    const status = known ? error.status : 500;
    return Response.json({
      error: {
        code: status === 403 ? "not_authorized" : status === 400 ? "invalid_request" : "internal_error",
        message: known ? error.message : "The evidence package could not be redeemed.",
      },
    }, { status });
  }
}
