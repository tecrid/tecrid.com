import { getChatGPTUser } from "../../../chatgpt-auth";
import {
  createSandboxApiKey,
  listSandboxApiKeys,
  revokeSandboxApiKey,
  SandboxInputError,
} from "../../../../lib/sandbox";
import { rejectCrossOriginWrite } from "../../../../lib/request-security";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const known = error instanceof SandboxInputError;
  return Response.json(
    { error: { message: known ? error.message : "Sandbox API key operation failed." } },
    { status: known ? error.status : 500 },
  );
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: { message: "Sign in is required." } }, { status: 401 });
  try {
    return Response.json({ keys: await listSandboxApiKeys(user.userId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: { message: "Sign in is required." } }, { status: 401 });
  try {
    const body = await request.json() as { label?: unknown };
    return Response.json({ key: await createSandboxApiKey(user, body.label) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: { message: "Sign in is required." } }, { status: 401 });
  try {
    const body = await request.json() as { id?: unknown };
    return Response.json({ key: await revokeSandboxApiKey(user, body.id) });
  } catch (error) {
    return errorResponse(error);
  }
}
