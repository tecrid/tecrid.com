import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { respondToEvidenceRequest } from "../../../../../../lib/evidence-routing";
import { rejectCrossOriginWrite } from "../../../../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../../../../lib/tec";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ requestId: string }> };
export async function POST(request: Request, { params }: RouteContext) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const { requestId } = await params;
    return Response.json({ result: await respondToEvidenceRequest(user, requestId, await request.json()) });
  } catch (error) {
    const known = error instanceof TecInputError || error instanceof TecAuthorizationError;
    return Response.json({ error: known ? error.message : "The evidence request could not be answered." }, { status: known ? error.status : 500 });
  }
}
