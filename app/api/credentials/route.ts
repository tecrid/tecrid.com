import { getChatGPTUser } from "../../chatgpt-auth";
import {
  createCredentialForUser,
  TecAuthorizationError,
  TecInputError,
} from "../../../lib/tec";
import { rejectCrossOriginWrite } from "../../../lib/request-security";

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const credential = await createCredentialForUser(user, await request.json());
    return Response.json({ credential }, { status: 201 });
  } catch (error) {
    const status =
      error instanceof TecAuthorizationError || error instanceof TecInputError
        ? error.status
        : 500;
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json(
      { error: known ? error.message : "Credential creation failed." },
      { status },
    );
  }
}
