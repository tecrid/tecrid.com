import { getChatGPTUser } from "../../chatgpt-auth";
import {
  createApiKey,
  revokeApiKey,
  TecAuthorizationError,
  TecInputError,
} from "../../../lib/tec";

function errorResponse(error: unknown) {
  const status =
    error instanceof TecAuthorizationError || error instanceof TecInputError
      ? error.status
      : 500;
  return Response.json(
    { error: error instanceof Error ? error.message : "API key operation failed." },
    { status },
  );
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const payload = await request.json();
    const key = await createApiKey(user, payload.label);
    return Response.json({ key }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const payload = await request.json();
    return Response.json({ key: await revokeApiKey(user, payload.id) });
  } catch (error) {
    return errorResponse(error);
  }
}
