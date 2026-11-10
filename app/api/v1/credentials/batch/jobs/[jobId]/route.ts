import { authenticateApiRequest, TecAuthorizationError, TecInputError } from "../../../../../../../lib/tec";
import { getCredentialBatchJob } from "../../../../../../../lib/credential-batch";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { organization } = await authenticateApiRequest(request);
    const { jobId } = await params;
    const job = await getCredentialBatchJob(organization.id, decodeURIComponent(jobId));
    if (!job) {
      return Response.json({ error: { code: "not_found", message: "Batch job not found." } }, { status: 404 });
    }
    return Response.json(job);
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    const status = known ? error.status : 500;
    return Response.json({
      error: {
        code: status === 403 ? "not_authorized" : status === 400 ? "invalid_request" : "internal_error",
        message: known ? error.message : "Batch job lookup failed.",
      },
    }, { status });
  }
}
