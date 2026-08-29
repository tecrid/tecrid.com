import { authenticateApiRequest, TecAuthorizationError, TecInputError } from "../../../../lib/tec";
import { listReportReservations, reserveReportTecrid } from "../../../../lib/report-issuance";

function errorResponse(error: unknown) {
  const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
  const status = known ? error.status : 500;
  return Response.json({
    error: {
      code: status === 403 ? "not_authorized" : status === 400 ? "invalid_request" : "internal_error",
      message: known ? error.message : "Report reservation operation failed.",
    },
  }, { status });
}

export async function GET(request: Request) {
  try {
    const { organization } = await authenticateApiRequest(request);
    const reservations = await listReportReservations(organization.id);
    return Response.json({ reservations, count: reservations.length });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { organization } = await authenticateApiRequest(request);
    const reservation = await reserveReportTecrid(
      organization,
      await request.json() as Record<string, unknown>,
    );
    return Response.json({ reservation }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
