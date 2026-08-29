import { isSampleTecrid, sampleCredentialDocument } from "../../../../../lib/sample-tecrid";

type RouteContext = { params: Promise<{ identifier: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { identifier } = await params;
  if (isSampleTecrid(identifier)) {
    return Response.json(sampleCredentialDocument(), {
      headers: {
        "cache-control": "public, max-age=300",
        "x-tecrid-demonstration": "true",
      },
    });
  }
  const { getCredential, publicCredentialDocument } = await import("../../../../../lib/tec");
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
