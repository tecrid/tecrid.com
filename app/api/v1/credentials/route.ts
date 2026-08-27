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
        code: status === 403 ? "not_authorized" : status === 400 ? "invalid_request" : "server_error",
        message: error instanceof Error ? error.message : "The request could not be completed.",
      },
    },
    { status },
  );
}

export async function GET(request: Request) {
  try {
    const context = await authenticateApiRequest(request);
    const data = await listCredentialsForApi(context.organization.id);
    return Response.json({ object: "list", data, has_more: false });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await authenticateApiRequest(request);
    const credential = await createCredential(
      context.organization,
      `api_key:${context.key.id}`,
      await request.json(),
    );
    return Response.json({ object: "credential", ...credential }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
