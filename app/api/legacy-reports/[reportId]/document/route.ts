import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getLegacyDocument } from "../../../../../lib/legacy-reports";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const { reportId } = await params;
  const document = await getLegacyDocument(user, decodeURIComponent(reportId));
  if (!document) return Response.json({ error: "Document not found." }, { status: 404 });
  return new Response(document.object.body, {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(document.report.sourceSize),
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.report.sourceFilename)}`,
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
      "x-frame-options": "DENY",
      "cross-origin-resource-policy": "same-origin",
      "x-tecrid-document-sha256": document.report.sourceSha256,
    },
  });
}
