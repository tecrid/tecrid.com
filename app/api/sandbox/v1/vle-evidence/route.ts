import { buildVleSandboxEvidence, VleSandboxEvidenceError } from "../../../../../lib/vle-sandbox-evidence";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer\s+tec_sandbox_[a-z0-9]+$/i.test(authorization)) {
    return Response.json({ error: { code: "sandbox_api_key_required", message: "Use a personal tec_sandbox_… bearer key for this contract test." } }, { status: 401, headers: noStore });
  }

  let authenticated;
  try {
    const { authenticateSandboxApiRequest } = await import("../../../../../lib/sandbox");
    authenticated = await authenticateSandboxApiRequest(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sandbox API authentication failed.";
    return Response.json({ error: { code: "invalid_api_key", message } }, { status: 401, headers: noStore });
  }
  if (!authenticated) {
    return Response.json({ error: { code: "sandbox_api_key_required", message: "Use a personal tec_sandbox_… bearer key for this contract test." } }, { status: 401, headers: noStore });
  }

  const search = new URL(request.url).searchParams;
  const tecridId = search.get("tecridId") ?? "";
  const expectedSampleCode = search.get("expectedSampleCode") ?? "";
  try {
    const evidence = await buildVleSandboxEvidence(authenticated.session.stage, tecridId, expectedSampleCode);
    return Response.json({ evidence }, { headers: noStore });
  } catch (error) {
    if (error instanceof VleSandboxEvidenceError) {
      const status = error.code === "tecrid_mismatch" ? 404 : 409;
      return Response.json({ error: { code: error.code, message: error.message } }, { status, headers: noStore });
    }
    return Response.json({ error: { code: "sandbox_contract_error", message: "The sandbox evidence envelope could not be created." } }, { status: 500, headers: noStore });
  }
}
