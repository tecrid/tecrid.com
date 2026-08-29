import { getChatGPTUser } from "../../../chatgpt-auth";
import { createCertificationProgram } from "../../../../lib/certification";
import { rejectCrossOriginWrite } from "../../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../../lib/tec";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const result = await createCertificationProgram(user, (await request.json()).name);
    return Response.json({ result }, { status: 201 });
  } catch (error) {
    const known = error instanceof TecInputError || error instanceof TecAuthorizationError;
    return Response.json({ error: known ? error.message : "The certification program could not be created." }, { status: known ? error.status : 500 });
  }
}
