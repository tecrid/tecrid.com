import { getChatGPTUser } from "../../../chatgpt-auth";
import { createEvidenceShareCode } from "../../../../lib/sharing";
import { rejectCrossOriginWrite } from "../../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../../lib/tec";

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    return Response.json({ result: await createEvidenceShareCode(user, await request.json()) }, { status: 201 });
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json({ error: known ? error.message : "The share code could not be created." }, { status: known ? error.status : 500 });
  }
}
