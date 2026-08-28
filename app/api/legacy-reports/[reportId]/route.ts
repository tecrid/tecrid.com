import { getChatGPTUser } from "../../../chatgpt-auth";
import { updateLegacyReportTranscription } from "../../../../lib/legacy-reports";
import { TecAuthorizationError, TecInputError } from "../../../../lib/tec";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Cross-origin correction is not allowed." }, { status: 403 });
  }
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const { reportId } = await params;
    const report = await updateLegacyReportTranscription(
      user,
      decodeURIComponent(reportId),
      await request.json(),
    );
    return Response.json({ report });
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json(
      { error: known ? error.message : "Report correction failed." },
      { status: known ? error.status : 500 },
    );
  }
}
