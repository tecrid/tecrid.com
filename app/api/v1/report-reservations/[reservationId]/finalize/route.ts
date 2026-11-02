import { authenticateApiRequest, TecAuthorizationError, TecDuplicateDocumentError, TecInputError } from "../../../../../../lib/tec";
import { finalizeReportTecrid } from "../../../../../../lib/report-issuance";

type RouteContext = { params: Promise<{ reservationId: string }> };

function errorResponse(error: unknown) {
  const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
  const status = known ? error.status : 500;
  const tecrid = error instanceof TecDuplicateDocumentError ? error.existingTecrid : undefined;
  return Response.json({
    error: {
      code: status === 409 ? "already_minted" : status === 403 ? "not_authorized" : status === 400 ? "invalid_request" : "internal_error",
      message: known ? error.message : "Report finalization failed.",
    },
    ...(tecrid ? { tecrid } : {}),
  }, { status });
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { organization } = await authenticateApiRequest(request);
    const { reservationId } = await params;
    const result = await finalizeReportTecrid(
      organization,
      reservationId,
      await request.json() as Record<string, unknown>,
    );
    return Response.json(result, { status: result.idempotent ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
