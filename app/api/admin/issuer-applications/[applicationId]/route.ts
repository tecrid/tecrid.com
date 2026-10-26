import { getVerifiedEmailSession } from "../../../../../lib/email-auth";
import {
  reviewIssuerApplication,
  TecAuthorizationError,
  TecInputError,
} from "../../../../../lib/tec";
import { rejectCrossOriginWrite } from "../../../../../lib/request-security";

const reviewHeaders={"Cache-Control":"private, no-store",Vary:"Cookie","X-Content-Type-Options":"nosniff"};
type RouteContext = { params: Promise<{ applicationId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Same-origin request required."},{status:403,headers:reviewHeaders});
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const identity = await getVerifiedEmailSession(request.headers);
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401, headers:reviewHeaders });
  try {
    const { applicationId } = await params;
    const review = await reviewIssuerApplication(
      identity.user,
      decodeURIComponent(applicationId),
      await request.json(),
      identity.session,
    );
    return Response.json({ review },{headers:reviewHeaders});
  } catch (error) {
    const status =
      error instanceof TecAuthorizationError || error instanceof TecInputError
        ? error.status
        : 500;
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json(
      { error: known ? error.message : "Review failed." },
      { status,headers:reviewHeaders },
    );
  }
}
