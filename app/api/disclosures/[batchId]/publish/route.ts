import { getChatGPTUser } from "../../../../chatgpt-auth";
import {
  DisclosureAuthorizationError,
  DisclosureInputError,
  publishDisclosureBatch,
} from "../../../../../lib/disclosures";
import { rejectCrossOriginWrite } from "../../../../../lib/request-security";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ batchId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const { batchId } = await params;
    const result = await publishDisclosureBatch(user, decodeURIComponent(batchId));
    return Response.json({ result });
  } catch (error) {
    const known =
      error instanceof DisclosureInputError ||
      error instanceof DisclosureAuthorizationError;
    return Response.json(
      { error: known ? error.message : "The disclosure could not be published." },
      { status: known ? error.status : 500 },
    );
  }
}
