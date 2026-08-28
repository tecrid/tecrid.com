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
    const status =
      error instanceof TecAuthorizationError || error instanceof TecInputError
        ? error.status
        : 500;
    return Response.json(
      {
        error: {
          code: status === 403 ? "not_authorized" : "invalid_request",
          message: error instanceof Error ? error.message : "Canonicalization failed.",
        },
      },
      { status },
    );
  }
}
