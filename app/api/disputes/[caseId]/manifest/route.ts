import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDisputeCaseForUser } from "../../../../../lib/lab-defense";
import { redactUnentitledCommitments } from "../../../../../lib/withheld-results";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ caseId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const { caseId } = await params;
  const record = await getDisputeCaseForUser(user, caseId);
  if (!record) return Response.json({ error: "Evidence case not found." }, { status: 404 });
  const manifest = JSON.stringify(redactUnentitledCommitments(JSON.parse(record.evidenceManifestJson)));
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(manifest))), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Response(manifest, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="tecrid-evidence-${record.id}.json"`,
      "x-tecrid-evidence-fingerprint": fingerprint,
    },
  });
}
