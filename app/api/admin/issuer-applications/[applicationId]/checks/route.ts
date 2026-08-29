import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { reviewIssuerVerificationCheck } from "../../../../../../lib/issuer-verification";
import { rejectCrossOriginWrite } from "../../../../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../../../../lib/tec";

type RouteContext = { params: Promise<{ applicationId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const { applicationId } = await params;
    const check = await reviewIssuerVerificationCheck(
      user,
      decodeURIComponent(applicationId),
      await request.json(),
    );
    return Response.json({ check });
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json(
      { error: known ? error.message : "Verification check review failed." },
      { status: known ? error.status : 500 },
    );
  }
}
