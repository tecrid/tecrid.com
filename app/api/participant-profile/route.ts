import { getChatGPTUser } from "../../chatgpt-auth";
import { upsertParticipantProfile } from "../../../lib/sharing";
import { rejectCrossOriginWrite } from "../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../lib/tec";

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    return Response.json({ result: await upsertParticipantProfile(user, await request.json()) });
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json({ error: known ? error.message : "The participant profile could not be saved." }, { status: known ? error.status : 500 });
  }
}
