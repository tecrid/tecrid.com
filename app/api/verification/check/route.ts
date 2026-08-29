import { getChatGPTUser } from "../../../chatgpt-auth";
import { createVerificationCheck } from "../../../../lib/lab-defense";
import { rejectCrossOriginWrite } from "../../../../lib/request-security";
import { TecAuthorizationError, TecInputError } from "../../../../lib/tec";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  try {
    const result = await createVerificationCheck(await request.json(), user?.userId ?? null);
    return Response.json({ result }, { status: 201 });
  } catch (error) {
    const known = error instanceof TecInputError || error instanceof TecAuthorizationError;
    return Response.json(
      { error: known ? error.message : "The verification check could not be completed." },
      { status: known ? error.status : 500 },
    );
  }
}
