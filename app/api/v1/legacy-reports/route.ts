import { authenticateApiRequest, TecAuthorizationError, TecInputError } from "../../../../lib/tec";
import {
  createLegacyReportForApi,
  LegacyReportConflictError,
  LegacyReportRateLimitError,
  listLegacyReportsForOrganization,
} from "../../../../lib/legacy-reports";

function errorResponse(error: unknown) {
  const known = error instanceof LegacyReportConflictError ||
    error instanceof LegacyReportRateLimitError ||
    error instanceof TecAuthorizationError ||
    error instanceof TecInputError;
  const status = known ? error.status : 500;
  return Response.json({
    error: {
      code: status === 409 ? "conflict" : status === 429 ? "rate_limited" : status === 403 ? "not_authorized" : status === 400 ? "invalid_request" : "internal_error",
      message: known ? error.message : "Legacy report intake failed.",
    },
  }, { status });
}

export async function GET(request: Request) {
  try {
    const { organization } = await authenticateApiRequest(request);
    const reports = await listLegacyReportsForOrganization(organization.id);
    return Response.json({ reports, count: reports.length });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { organization, key } = await authenticateApiRequest(request);
    const report = await createLegacyReportForApi(organization, key.id, await request.formData());
    return Response.json({ report }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
