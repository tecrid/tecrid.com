import { authenticateSandboxApiRequest, SandboxInputError } from "../../../../../lib/sandbox";

export const dynamic = "force-dynamic";

type Stage = "submitted" | "claimed" | "confirmed" | "issued";
type Action = "claim" | "confirm" | "issue";

const stages: Stage[] = ["submitted", "claimed", "confirmed", "issued"];
const transitions: Record<Action, { from: Stage; to: Stage; message: string }> = {
  claim: { from: "submitted", to: "claimed", message: "Northstar claimed the report. Compare the transcription with the fictional source document." },
  confirm: { from: "claimed", to: "confirmed", message: "The laboratory confirmed the sample context, method, findings, and source fingerprint." },
  issue: { from: "confirmed", to: "issued", message: "Sandbox TECRID issued. Switch to the retailer to see the evidence gate update." },
};

type RoutingState = {
  certificationRequestStatus?: string;
  certifierDeliveryStatus?: string;
  retailerGrantStatus?: string;
  retailerDeliveryStatus?: string;
};

function scenario(stage: Stage, persistent = false, routing: RoutingState = {}) {
  return {
    sandbox: true,
    persistent,
    scenarioId: "SBX-AVO-260812",
    stage,
    identifier: stage === "issued" ? "SBX·NORTHSTAR-26-AVO8F2C1" : null,
    sample: { name: "Refined avocado oil", lotNumber: "SI-AVO-260812", matrix: "Edible oil" },
    parties: { brand: "Atlas Pantry", laboratory: "Northstar Analytical", supplier: "Sierra Ingredients", retailer: "Market Square", certifier: "ICS Certification" },
    method: "ICP-MS + GC-FID fatty acid profile + sterol profile",
    sourceDocument: { reportNumber: "NS-260814-77", sha256: "8a4e90f2d51b48130ed83f516b1126cc208b51852e2be98f44de63b6c72bd140", public: false },
    findings: [
      { analyte: "Oleic acid", resultText: "68.4", unit: "% total fatty acids" },
      { analyte: "Linoleic acid", resultText: "13.2", unit: "% total fatty acids" },
      { analyte: "Campesterol", resultText: "0.18", unit: "% total sterols" },
      { analyte: "Stigmasterol", resultText: "0.09", unit: "% total sterols" },
      { analyte: "Lead", resultText: "7.4", unit: "µg/kg" },
      { analyte: "Cadmium", resultText: "1.8", unit: "µg/kg" },
      { analyte: "Arsenic", resultText: "2.6", unit: "µg/kg" },
      { analyte: "Mercury", resultText: "<0.5", unit: "µg/kg" },
    ],
    controlledRouting: {
      productSku: "AP-AVO-SEA-05",
      controller: "Atlas Pantry",
      certificationRequestStatus: routing.certificationRequestStatus ?? "pending",
      certifierDeliveryStatus: routing.certifierDeliveryStatus ?? "not_delivered",
      retailerGrantStatus: routing.retailerGrantStatus ?? "not_granted",
      retailerDeliveryStatus: routing.retailerDeliveryStatus ?? "not_delivered",
      onwardSharing: "not_implied",
    },
    proof: stage === "issued" ? { algorithm: "Ed25519 demonstration", verified: true, productionAuthority: false } : null,
  };
}

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateSandboxApiRequest(request);
    if (authenticated) {
      return Response.json(
        { scenario: scenario(authenticated.session.stage as Stage, true, authenticated.session) },
        { headers: { "cache-control": "no-store" } },
      );
    }
  } catch (error) {
    const message = error instanceof SandboxInputError ? error.message : "Sandbox API authentication failed.";
    return Response.json({ error: { code: "invalid_api_key", message } }, { status: 401 });
  }
  const requested = new URL(request.url).searchParams.get("stage");
  const stage = stages.includes(requested as Stage) ? requested as Stage : "submitted";
  return Response.json({ scenario: scenario(stage) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: Action; currentStage?: Stage };
    const transition = body.action ? transitions[body.action] : null;
    if (!transition || body.currentStage !== transition.from) {
      return Response.json({ error: { code: "invalid_transition", message: "That action is not available at the current sandbox stage." } }, { status: 409 });
    }
    return Response.json({ scenario: scenario(transition.to), message: transition.message }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "invalid_request", message: "The sandbox request was not valid JSON." } }, { status: 400 });
  }
}
