import { authenticateApiRequest, TecAuthorizationError, TecInputError } from "../../../../../lib/tec";
import { importLegacyBackfill, LegacyBackfillRateLimitError } from "../../../../../lib/legacy-backfill";

function errorResponse(error: unknown) {
  const known = error instanceof LegacyBackfillRateLimitError || error instanceof TecAuthorizationError || error instanceof TecInputError;
  const status = known ? error.status : 500;
  return Response.json({
    error: {
      code: status === 429 ? "rate_limited" : status === 403 ? "not_authorized" : status === 400 ? "invalid_request" : "internal_error",
      message: known ? error.message : "Backfill import failed.",
    },
  }, { status });
}

export async function POST(request: Request) {
  try {
    const { organization, key } = await authenticateApiRequest(request);
    const actor = `api:${key.id}`;
    const result = request.headers.get("content-type")?.includes("multipart/form-data")
      ? await importLegacyBackfill(organization, actor, { form: await request.formData() })
      : await importLegacyBackfill(organization, actor, { json: await request.json() });
    const created = result.summary.created > 0 || result.summary.minted > 0;
    return Response.json(result, { status: created ? 201 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
