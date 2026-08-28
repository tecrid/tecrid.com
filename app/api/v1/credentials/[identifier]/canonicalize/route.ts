import {
  authenticateApiRequest,
  canonicalizeCredentialRevision,
  TecAuthorizationError,
  TecInputError,
} from "../../../../../../lib/tec";

type RouteContext = { params: Promise<{ identifier: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { organization } = await authenticateApiRequest(request);
    const { identifier } = await params;
    const canonical = await canonicalizeCredentialRevision(
      organization,
      decodeURIComponent(identifier),
      await request.json(),
    );
    return Response.json(canonical);
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
