import { authenticateApiRequest, TecAuthorizationError, TecInputError } from "../../../../../lib/tec";
import { BatchRateLimitError, createCredentialBatch } from "../../../../../lib/credential-batch";

function errorResponse(error: unknown) {
  const known = error instanceof TecAuthorizationError || error instanceof TecInputError || error instanceof BatchRateLimitError;
  const status = known ? error.status : 500;
  return Response.json({
    error: {
      code: status === 429 ? "rate_limited" : status === 403 ? "not_authorized" : status === 400 ? "invalid_request" : "internal_error",
      message: known ? error.message : "Batch issuance failed.",
    },
  }, { status });
}

export async function POST(request: Request) {
  try {
    const { organization } = await authenticateApiRequest(request);
    const payload = await request.json() as { async?: unknown };
    const result = await createCredentialBatch(organization, payload, { async: payload?.async === true });
    return Response.json(result, { status: payload?.async === true ? 202 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
