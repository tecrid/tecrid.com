import { getChatGPTUser } from "../../chatgpt-auth";
import { onboardOrganization, TecInputError } from "../../../lib/tec";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });

  try {
    const payload = await request.json();
    const membership = await onboardOrganization(user, payload);
    return Response.json({ organization: membership?.organization }, { status: 201 });
  } catch (error) {
    const status = error instanceof TecInputError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to create organization.";
    return Response.json({ error: message }, { status });
  }
}
