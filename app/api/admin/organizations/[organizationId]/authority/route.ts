import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { requireAdminFactor } from "../../../../../../lib/admin-mfa";
import { rejectCrossOriginWrite } from "../../../../../../lib/request-security";
import {
  setLaboratoryAuthority,
  TecAuthorizationError,
  TecInputError,
} from "../../../../../../lib/tec";

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    await requireAdminFactor(user, request);
    const { organizationId } = await params;
    const body = await request.json() as { action?: unknown; reason?: unknown };
    const authority = await setLaboratoryAuthority(user, decodeURIComponent(organizationId), body.action, body.reason);
    return Response.json({ authority });
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json(
      { error: known ? error.message : "The laboratory status was not changed." },
      { status: known ? error.status : 500 },
    );
  }
}
