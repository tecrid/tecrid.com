import { getIssuer } from "../../../../../lib/tec";

type RouteContext = { params: Promise<{ issuerCode: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { issuerCode } = await params;
  const issuer = await getIssuer(decodeURIComponent(issuerCode));
  if (!issuer) {
    return Response.json(
      { error: { code: "not_found", message: "No issuer was found." } },
      { status: 404 },
    );
  }
  return Response.json({ issuer }, { headers: { "cache-control": "no-store" } });
}
