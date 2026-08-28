import { getChatGPTUser } from "../../chatgpt-auth";
import {
  submitIssuerApplication,
  TecAuthorizationError,
  TecInputError,
} from "../../../lib/tec";

export async function POST(request: Request) {
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
    return Response.json(
      { error: error instanceof Error ? error.message : "Application failed." },
      { status },
    );
  }
}
