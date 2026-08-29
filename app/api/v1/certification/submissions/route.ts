import { authenticateCertificationIntakeRequest, submitCertificationIntake } from "../../../../../lib/certification";
import { TecAuthorizationError, TecInputError } from "../../../../../lib/tec";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const program = await authenticateCertificationIntakeRequest(request);
    const result = await submitCertificationIntake(program, await request.json(), null);
    return Response.json({ result }, { status: 201 });
  } catch (error) {
    const known = error instanceof TecInputError || error instanceof TecAuthorizationError;
    return Response.json({ error: known ? error.message : "The certification submission could not be processed." }, { status: known ? error.status : 500 });
  }
}
