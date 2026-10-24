export const VLE_SANDBOX_TECRID = "SBX·NORTHSTAR-26-AVO8F2C1";
export const VLE_SANDBOX_SAMPLE_CODE = "VLE-SAMPLE-AVO-260812-A";

export class VleSandboxEvidenceError extends Error {
  constructor(public code: "evidence_not_issued" | "tecrid_mismatch" | "sample_mismatch", message: string) {
    super(message);
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildVleSandboxEvidence(stage: string, tecridId: string, expectedSampleCode: string) {
  if (stage !== "issued") {
    throw new VleSandboxEvidenceError("evidence_not_issued", "Issue the sandbox TECRID before requesting its VLE evidence envelope.");
  }
  if (tecridId !== VLE_SANDBOX_TECRID) {
    throw new VleSandboxEvidenceError("tecrid_mismatch", "The requested TECRID is not the issued record in this sandbox scenario.");
  }
  if (expectedSampleCode !== VLE_SANDBOX_SAMPLE_CODE) {
    throw new VleSandboxEvidenceError("sample_mismatch", "The TECRID sample code does not match the VLE sample code supplied by the caller.");
  }

  const evidence = {
    contractVersion: "vle-tecrid-candidate-2026-09-07",
    tecridId: VLE_SANDBOX_TECRID,
    sampleCode: VLE_SANDBOX_SAMPLE_CODE,
    issuer: "Northstar Analytical (fictional sandbox)",
    status: "CURRENT" as const,
    issuedAt: "2026-09-07T00:00:00.000Z",
    expiresAt: "2026-09-21T00:00:00.000Z",
    results: [
      { analyte: "Lead", valuePpm: 0.0074, unit: "ppm" as const },
      { analyte: "Cadmium", valuePpm: 0.0018, unit: "ppm" as const },
      { analyte: "Arsenic", valuePpm: 0.0026, unit: "ppm" as const },
      { analyte: "Mercury", valuePpm: 0.0004, unit: "ppm" as const },
    ],
  };

  return {
    ...evidence,
    payloadHash: await sha256(JSON.stringify(evidence)),
    authentication: {
      status: "VERIFIED" as const,
      method: "TECRID_SANDBOX_STATE_ONLY",
      keyId: null,
      verifiedAt: "2026-09-07T00:00:00.000Z",
    },
    sandbox: true,
    productionAuthority: false,
    contractStatus: "CANDIDATE_NOT_PRODUCTION",
    boundaries: {
      proves: "The saved sandbox issued this fictional envelope and its declared sample code matches the caller's expected sample code.",
      doesNotProve: "Laboratory identity, production signing-key control, representative sampling, chain of custody, analytical correctness, certification, or VLE QUALIFIED status.",
    },
  };
}
