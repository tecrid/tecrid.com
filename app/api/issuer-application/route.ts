import { getChatGPTUser } from "../../chatgpt-auth";
import {
  submitIssuerApplication,
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
    const application = await submitIssuerApplication(user, await request.json());
    return Response.json({ application }, { status: 201 });
  } catch (error) {
    const status =
      error instanceof TecAuthorizationError || error instanceof TecInputError
        ? error.status
        : 500;
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json(
      { error: known ? error.message : "Application failed." },
      { status },
    );
  }
}
