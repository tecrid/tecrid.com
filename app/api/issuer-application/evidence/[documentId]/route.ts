import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getIssuerEvidenceDocument } from "../../../../../lib/issuer-verification";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const { documentId } = await params;
  const evidence = await getIssuerEvidenceDocument(user, decodeURIComponent(documentId));
  if (!evidence) return Response.json({ error: "Evidence document not found." }, { status: 404 });
  return new Response(evidence.object.body, {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(evidence.document.size),
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(evidence.document.filename)}`,
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
      "x-frame-options": "DENY",
      "cross-origin-resource-policy": "same-origin",
      "x-tecrid-document-sha256": evidence.document.sha256,
    },
  });
}
