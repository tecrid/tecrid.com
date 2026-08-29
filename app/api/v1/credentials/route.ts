import {
  authenticateApiRequest,
  createCredential,
  listCredentialsForApi,
  TecAuthorizationError,
  TecInputError,
} from "../../../../lib/tec";
import {
  authorizeRoutingToken,
  deliverCredentialWithAuthorization,
} from "../../../../lib/evidence-routing";

function errorResponse(error: unknown) {
  const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
  const status = known ? error.status : 500;
  return Response.json(
    {
      error: {
        code:
          status === 403
            ? "not_authorized"
            : status === 400
              ? "invalid_request"
              : "internal_error",
        message: known ? error.message : "Credential operation failed.",
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
    const payload = await request.json() as Record<string, unknown>;
    const routingToken = typeof payload.routingToken === "string" ? payload.routingToken : "";
    const routingAuthorization = routingToken
      ? await authorizeRoutingToken(routingToken, organization.id)
      : null;
    if (routingAuthorization) {
      const submittedSku = typeof payload.productSku === "string"
        ? payload.productSku.trim().toUpperCase().replace(/\s+/g, "-")
        : "";
      if (submittedSku !== routingAuthorization.authorization.productSku) {
        throw new TecInputError("productSku must match the SKU bound to the brand-controlled routing token.");
      }
    }
    const credential = await createCredential(
      organization,
      null,
      payload,
      { controlledRoutingAuthorized: Boolean(routingAuthorization) },
    );
    const routing = routingAuthorization && credential.status === "issued"
      ? await deliverCredentialWithAuthorization(routingAuthorization, credential.identifier)
      : null;
    return Response.json({ credential, routing }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
