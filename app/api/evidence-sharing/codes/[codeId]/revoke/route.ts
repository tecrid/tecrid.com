import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { revokeEvidenceShareCode } from "../../../../../../lib/sharing";
import { rejectCrossOriginWrite } from "../../../../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../../../../lib/tec";

export async function POST(request: Request, context: { params: Promise<{ codeId: string }> }) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const { codeId } = await context.params;
    return Response.json({ result: await revokeEvidenceShareCode(user, codeId) });
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json({ error: known ? error.message : "The share code could not be revoked." }, { status: known ? error.status : 500 });
  }
}
