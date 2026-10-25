import { getChatGPTUser } from "../../chatgpt-auth";
import { completeWorkspaceDetails, TecInputError, TecAuthorizationError } from "../../../lib/tec";
import { rejectCrossOriginWrite } from "../../../lib/request-security";
export async function POST(request: Request) {
  const rejected = rejectCrossOriginWrite(request); if (rejected) return rejected;
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try { await completeWorkspaceDetails(user, await request.json()); return Response.json({ saved: true }); }
  catch (error) { return Response.json({ error: (error instanceof TecInputError || error instanceof TecAuthorizationError) ? error.message : "We could not save these details." }, { status: (error instanceof TecInputError || error instanceof TecAuthorizationError) ? error.status : 500 }); }
}
