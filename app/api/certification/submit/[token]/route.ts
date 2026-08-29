import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getCertificationProgramByPublicToken, submitCertificationIntake } from "../../../../../lib/certification";
import { rejectCrossOriginWrite } from "../../../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../../../lib/tec";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ token: string }> };
export async function POST(request: Request, { params }: RouteContext) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const { token } = await params;
  const program = await getCertificationProgramByPublicToken(token);
  if (!program) return Response.json({ error: "This submission link is invalid or inactive." }, { status: 404 });
  try {
    const result = await submitCertificationIntake(program, await request.json(), user.userId);
    return Response.json({ result }, { status: 201 });
  } catch (error) {
    const known = error instanceof TecInputError || error instanceof TecAuthorizationError;
    return Response.json({ error: known ? error.message : "The certification submission could not be validated." }, { status: known ? error.status : 500 });
  }
}
