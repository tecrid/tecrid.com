import { getChatGPTUser } from "../../../chatgpt-auth";
import { createIssuerKeyChallenge } from "../../../../lib/issuer-verification";
import { rejectCrossOriginWrite } from "../../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../../lib/tec";

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const challenge = await createIssuerKeyChallenge(user);
    return Response.json({ challenge }, { status: 201 });
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json(
      { error: known ? error.message : "Signing challenge creation failed." },
      { status: known ? error.status : 500 },
    );
  }
}
