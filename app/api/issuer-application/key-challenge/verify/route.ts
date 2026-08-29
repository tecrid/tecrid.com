import { getChatGPTUser } from "../../../../chatgpt-auth";
import { verifyIssuerKeyChallenge } from "../../../../../lib/issuer-verification";
import { rejectCrossOriginWrite } from "../../../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../../../lib/tec";

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const verification = await verifyIssuerKeyChallenge(user, await request.json());
    return Response.json({ verification });
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json(
      { error: known ? error.message : "Signing challenge verification failed." },
      { status: known ? error.status : 500 },
    );
  }
}
