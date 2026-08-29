import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { revokeRoutingAuthorization } from "../../../../../../lib/evidence-routing";
import { rejectCrossOriginWrite } from "../../../../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../../../../lib/tec";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ authorizationId: string }> };
export async function POST(request: Request, { params }: RouteContext) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const { authorizationId } = await params;
    return Response.json({ result: await revokeRoutingAuthorization(user, authorizationId) });
  } catch (error) {
    const known = error instanceof TecInputError || error instanceof TecAuthorizationError;
    return Response.json({ error: known ? error.message : "The routing authorization could not be revoked." }, { status: known ? error.status : 500 });
  }
}
