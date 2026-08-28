import {
  authenticateApiRequest,
  canonicalizeCredential,
  TecAuthorizationError,
  TecInputError,
} from "../../../../../lib/tec";

export async function POST(request: Request) {
  try {
    await authenticateApiRequest(request);
    return Response.json(canonicalizeCredential(await request.json()));
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    const status = known ? error.status : 500;
    return Response.json(
      {
        error: {
          code: status === 403 ? "not_authorized" : "invalid_request",
          message: known ? error.message : "Canonicalization failed.",
        },
      },
      { status },
    );
  }
}
