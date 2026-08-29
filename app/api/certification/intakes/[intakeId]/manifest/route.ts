import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { getCertificationIntakeForUser } from "../../../../../../lib/certification";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ intakeId: string }> };
export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const { intakeId } = await params;
  const record = await getCertificationIntakeForUser(user, intakeId);
  if (!record) return Response.json({ error: "Certification intake not found." }, { status: 404 });
  return new Response(record.intake.manifestJson, { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="tecrid-certification-${record.intake.id}.json"`, "x-tecrid-manifest-fingerprint": record.intake.manifestFingerprint } });
}
