import { getChatGPTUser } from "../../../chatgpt-auth";
import {
  DisclosureAuthorizationError,
  DisclosureInputError,
  importDisclosureCsv,
} from "../../../../lib/disclosures";
import { rejectCrossOriginWrite } from "../../../../lib/request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const result = await importDisclosureCsv(user, await request.json());
    return Response.json({ result }, { status: 201 });
  } catch (error) {
    const known =
      error instanceof DisclosureInputError ||
      error instanceof DisclosureAuthorizationError;
    return Response.json(
      { error: known ? error.message : "The disclosure import could not be completed." },
      { status: known ? error.status : 500 },
    );
  }
}
