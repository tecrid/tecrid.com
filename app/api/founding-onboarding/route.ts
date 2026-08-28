import { getChatGPTUser } from "../../chatgpt-auth";
import {
  submitFoundingOnboarding,
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
    const onboarding = await submitFoundingOnboarding(user, await request.json());
    return Response.json({ onboarding }, { status: 201 });
  } catch (error) {
    const expected = error instanceof TecInputError || error instanceof TecAuthorizationError;
    return Response.json(
      { error: expected ? error.message : "Unable to save the founding launch brief." },
      { status: expected ? error.status : 500 },
    );
  }
}
