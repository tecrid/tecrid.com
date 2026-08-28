import {
  authenticateApiRequest,
  createCredential,
  listCredentialsForApi,
  TecAuthorizationError,
  TecInputError,
} from "../../../../lib/tec";

function errorResponse(error: unknown) {
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
        message:
          error instanceof Error ? error.message : "Credential operation failed.",
      },
    },
    { status },
  );
}

export async function GET(request: Request) {
  try {
    const { organization } = await authenticateApiRequest(request);
    const records = await listCredentialsForApi(organization.id);
    return Response.json({ records, count: records.length });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { organization } = await authenticateApiRequest(request);
    const credential = await createCredential(
      organization,
      null,
      await request.json(),
    );
    return Response.json({ credential }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
