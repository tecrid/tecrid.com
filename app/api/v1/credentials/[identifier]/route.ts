import { getCredential, publicCredentialDocument } from "../../../../../lib/tec";

type RouteContext = { params: Promise<{ identifier: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { identifier } = await params;
  const record = await getCredential(decodeURIComponent(identifier));
  if (!record) {
    return Response.json(
      { error: { code: "not_found", message: "No public TECRID was found." } },
      { status: 404 },
    );
  }
  return Response.json(publicCredentialDocument(record), {
    headers: { "cache-control": "no-store" },
  });
}
