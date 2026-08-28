import {
  authenticateApiRequest,
  createCredentialRevision,
  getCredential,
  TecAuthorizationError,
  TecInputError,
} from "../../../../../../lib/tec";

type RouteContext = { params: Promise<{ identifier: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { identifier } = await params;
  const record = await getCredential(decodeURIComponent(identifier));
  if (!record) {
    return Response.json(
      { error: { code: "not_found", message: "No public TECRID was found." } },
      { status: 404 },
    );
  }
  return Response.json({ tecrid: record.credential.identifier, versions: record.versions });
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { organization } = await authenticateApiRequest(request);
    const { identifier } = await params;
    const revision = await createCredentialRevision(
      organization,
      null,
      decodeURIComponent(identifier),
      await request.json(),
    );
    return Response.json({ revision }, { status: 201 });
  } catch (error) {
    const status =
      error instanceof TecAuthorizationError || error instanceof TecInputError
        ? error.status
        : 500;
    return Response.json(
      {
        error: {
          code:
            status === 403
              ? "not_authorized"
              : status === 400
                ? "invalid_request"
                : "internal_error",
          message: error instanceof Error ? error.message : "Revision failed.",
        },
      },
      { status },
    );
  }
}
