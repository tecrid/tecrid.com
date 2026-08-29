import { getChatGPTUser } from "../../../chatgpt-auth";
import {
  ensureSandboxSession,
  resetSandboxSession,
  SandboxInputError,
  transitionSandboxSession,
  transitionSandboxRouting,
  type SandboxAction,
  type SandboxRoutingAction,
} from "../../../../lib/sandbox";
import { rejectCrossOriginWrite } from "../../../../lib/request-security";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const known = error instanceof SandboxInputError;
  return Response.json(
    { error: { message: known ? error.message : "The personal sandbox could not be updated." } },
    { status: known ? error.status : 500 },
  );
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: { message: "Sign in is required." } }, { status: 401 });
  try {
    const session = await ensureSandboxSession(user);
    return Response.json({ sandbox: { ...session, persistent: true, productionAuthority: false } });
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
    const body = await request.json() as {
      action?: SandboxAction | SandboxRoutingAction | "reset";
      currentStage?: string;
    };
    if (body.action === "reset") {
      const sandbox = await resetSandboxSession(user);
      return Response.json({ sandbox: { ...sandbox, persistent: true, productionAuthority: false }, message: "Your personal sandbox was reset." });
    }
    if (["approve_certifier", "grant_retailer", "deliver_tecrid", "revoke_retailer"].includes(body.action ?? "")) {
      const result = await transitionSandboxRouting(user, body.action as SandboxRoutingAction);
      return Response.json({ sandbox: { ...result, persistent: true, productionAuthority: false }, message: result.message });
    }
    if (!body.action || !["claim", "confirm", "issue"].includes(body.action)) {
      throw new SandboxInputError("A valid sandbox action is required.");
    }
    const result = await transitionSandboxSession(user, body.action as SandboxAction, body.currentStage);
    return Response.json({ sandbox: { ...result, persistent: true, productionAuthority: false }, message: result.message });
  } catch (error) {
    return errorResponse(error);
  }
}
