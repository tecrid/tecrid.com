import {
  listEvidenceDeliveriesForOrganization,
  routeExistingCredential,
} from "../../../../../lib/evidence-routing";
import {
  authenticateApiRequest,
  TecAuthorizationError,
  TecInputError,
} from "../../../../../lib/tec";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { organization } = await authenticateApiRequest(request);
    const deliveries = await listEvidenceDeliveriesForOrganization(organization.id);
    return Response.json({ deliveries, count: deliveries.length });
  } catch (error) {
    const known = error instanceof TecInputError || error instanceof TecAuthorizationError;
    return Response.json({ error: known ? error.message : "Evidence deliveries could not be loaded." }, { status: known ? error.status : 500 });
  }
}

export async function POST(request: Request) {
  try {
    return Response.json({ result: await routeExistingCredential(request, await request.json()) }, { status: 201 });
  } catch (error) {
    const known = error instanceof TecInputError || error instanceof TecAuthorizationError;
    return Response.json({ error: known ? error.message : "The TECRID could not be routed." }, { status: known ? error.status : 500 });
  }
}
