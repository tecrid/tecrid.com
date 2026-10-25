import { getChatGPTUser } from "../../chatgpt-auth";
import { acceptOrganizationTerms, configureDeliveryPolicy, reviewOrganizationIdentity } from "../../../lib/organization-access";
import { rejectCrossOriginWrite } from "../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../lib/tec";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginWrite(request); if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const input = await request.json();
    const result = input.action === "configure" ? await configureDeliveryPolicy(user, input) : input.action === "identity" ? await reviewOrganizationIdentity(user, input) : await acceptOrganizationTerms(user, input);
    return Response.json({ result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const known = error instanceof TecInputError || error instanceof TecAuthorizationError;
    return Response.json({ error: known ? error.message : "Organization access could not be updated." }, { status: known ? error.status : 500 });
  }
}
