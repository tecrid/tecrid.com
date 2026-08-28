import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { getLegacySigningPayload } from "../../../../../../lib/legacy-reports";
import { TecAuthorizationError, TecInputError } from "../../../../../../lib/tec";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const { token } = await params;
    const payload = await getLegacySigningPayload(user, decodeURIComponent(token));
    return Response.json(payload, {
      headers: { "cache-control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status =
      error instanceof TecAuthorizationError || error instanceof TecInputError
        ? error.status
        : 500;
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json(
      { error: known ? error.message : "Signing payload unavailable." },
      { status },
    );
  }
}
