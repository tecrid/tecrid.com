export const dynamic = "force-dynamic";

type Stage = "submitted" | "claimed" | "confirmed" | "issued";
type Action = "claim" | "confirm" | "issue";

const stages: Stage[] = ["submitted", "claimed", "confirmed", "issued"];
const transitions: Record<Action, { from: Stage; to: Stage; message: string }> = {
  claim: { from: "submitted", to: "claimed", message: "Northstar claimed the report. Compare the transcription with the fictional source document." },
  confirm: { from: "claimed", to: "confirmed", message: "The laboratory confirmed the sample context, method, findings, and source fingerprint." },
  issue: { from: "confirmed", to: "issued", message: "Sandbox TECRID issued. Switch to the retailer to see the evidence gate update." },
};

function scenario(stage: Stage) {
  return {
    sandbox: true,
    persistent: false,
    scenarioId: "SBX-AVO-260812",
    stage,
    identifier: stage === "issued" ? "SBX·NORTHSTAR-26-AVO8F2C1" : null,
    sample: { name: "Refined avocado oil", lotNumber: "SI-AVO-260812", matrix: "Edible oil" },
    parties: { brand: "Atlas Pantry", laboratory: "Northstar Analytical", supplier: "Sierra Ingredients", retailer: "Market Square" },
    method: "GC-FID fatty acid profile + sterol profile",
    sourceDocument: { reportNumber: "NS-260814-77", sha256: "8a4e90f2d51b48130ed83f516b1126cc208b51852e2be98f44de63b6c72bd140", public: false },
    findings: [
      { analyte: "Oleic acid", resultText: "68.4", unit: "% total fatty acids" },
      { analyte: "Linoleic acid", resultText: "13.2", unit: "% total fatty acids" },
      { analyte: "Campesterol", resultText: "0.18", unit: "% total sterols" },
      { analyte: "Stigmasterol", resultText: "0.09", unit: "% total sterols" },
    ],
    proof: stage === "issued" ? { algorithm: "Ed25519 demonstration", verified: true, productionAuthority: false } : null,
  };
}

export async function GET(request: Request) {
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
