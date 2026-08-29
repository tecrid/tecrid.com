import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDisputeCaseForUser } from "../../../../../lib/lab-defense";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ caseId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const { caseId } = await params;
  const record = await getDisputeCaseForUser(user, caseId);
  if (!record) return Response.json({ error: "Evidence case not found." }, { status: 404 });
  return new Response(record.evidenceManifestJson, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="tecrid-evidence-${record.id}.json"`,
      "x-tecrid-evidence-fingerprint": record.evidenceFingerprint,
    },
  });
}
