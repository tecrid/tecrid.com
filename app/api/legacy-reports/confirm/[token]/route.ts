import { getChatGPTUser } from "../../../../chatgpt-auth";
import {
  claimLegacyReport,
  declineLegacyReport,
  flagLegacyReportDiscrepancy,
  issueLegacyReport,
} from "../../../../../lib/legacy-reports";
import { TecAuthorizationError, TecInputError } from "../../../../../lib/tec";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Cross-origin confirmation is not allowed." }, { status: 403 });
  }
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const { token } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action;
    const decoded = decodeURIComponent(token);
    const result =
      action === "claim"
        ? await claimLegacyReport(user, decoded)
        : action === "discrepancy"
          ? await flagLegacyReportDiscrepancy(user, decoded, body.note)
          : action === "decline"
            ? await declineLegacyReport(user, decoded, body.note)
            : action === "issue"
              ? await issueLegacyReport(user, decoded, body.proof)
              : (() => {
                  throw new TecInputError("Choose claim, discrepancy, decline, or issue.");
                })();
    return Response.json({ result });
  } catch (error) {
    const status =
      error instanceof TecAuthorizationError || error instanceof TecInputError
        ? error.status
        : 500;
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json(
      { error: known ? error.message : "Confirmation action failed." },
      { status },
    );
  }
}
