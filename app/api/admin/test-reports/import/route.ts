import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { requireAdminFactor } from "../../../../../lib/admin-mfa";
import { rejectCrossOriginWrite } from "../../../../../lib/request-security";
import { isIcsAdmin, TecAuthorizationError } from "../../../../../lib/tec";
import { importTestReportSource } from "../../../../../lib/test-report-permissions";

export const dynamic = "force-dynamic";
const headers = { "cache-control": "no-store" };

// Moves a Kasandrinos TEST source PDF and/or transcript into TECRID's own bucket.
export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401, headers });
  try {
    if (!isIcsAdmin(user)) throw new TecAuthorizationError("ICS administrator access required.");
    await requireAdminFactor(user, request);
    const form = await request.formData();
    const result = await importTestReportSource((env as unknown as { DOCUMENTS?: R2Bucket }).DOCUMENTS, { reportNumber: form.get("reportNumber"), pdf: form.get("pdf"), transcript: form.get("transcript") });
    return Response.json(result.body, { status: result.status, headers });
  } catch (error) {
    if (error instanceof TecAuthorizationError) return Response.json({ error: error.message }, { status: 403, headers });
    return Response.json({ error: "Import failed." }, { status: 400, headers });
  }
}
