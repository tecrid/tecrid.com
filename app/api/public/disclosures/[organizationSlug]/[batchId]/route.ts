import {
  getPublicDisclosureBatch,
  publicDisclosureDocument,
} from "../../../../../../lib/disclosures";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ organizationSlug: string; batchId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { organizationSlug, batchId } = await params;
  const record = await getPublicDisclosureBatch(
    decodeURIComponent(organizationSlug),
    decodeURIComponent(batchId),
  );
  if (!record) {
    return Response.json(
      { error: { code: "not_found", message: "No public disclosure was found." } },
      { status: 404 },
    );
  }
  return Response.json(publicDisclosureDocument(record), {
    headers: { "cache-control": "public, max-age=60" },
  });
}
