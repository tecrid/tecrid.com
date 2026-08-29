import { getEvidenceInsightsForOrganization } from "../../../../lib/insights";
import { authenticateApiRequest, TecAuthorizationError, TecInputError } from "../../../../lib/tec";

export async function GET(request: Request) {
  try {
    const { organization } = await authenticateApiRequest(request);
    return Response.json(await getEvidenceInsightsForOrganization(organization.id));
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    const status = known ? error.status : 500;
    return Response.json({ error: { code: status === 403 ? "not_authorized" : "internal_error", message: known ? error.message : "Insights could not be generated." } }, { status });
  }
}
