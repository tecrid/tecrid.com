import { getChatGPTUser } from "../../chatgpt-auth";
import {
  createLegacyReport,
  LegacyReportConflictError,
  LegacyReportRateLimitError,
} from "../../../lib/legacy-reports";
import { TecAuthorizationError, TecInputError } from "../../../lib/tec";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Cross-origin report submission is not allowed." }, { status: 403 });
  }
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const report = await createLegacyReport(user, await request.formData());
    return Response.json({ report }, { status: 201 });
  } catch (error) {
    const status =
      error instanceof LegacyReportConflictError ||
      error instanceof LegacyReportRateLimitError ||
      error instanceof TecAuthorizationError ||
      error instanceof TecInputError
        ? error.status
        : 500;
    const known =
      error instanceof LegacyReportConflictError ||
      error instanceof LegacyReportRateLimitError ||
      error instanceof TecAuthorizationError ||
      error instanceof TecInputError;
    return Response.json(
      { error: known ? error.message : "Report intake failed." },
      { status },
    );
  }
}
