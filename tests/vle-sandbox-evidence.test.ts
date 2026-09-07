import { describe, expect, it } from "vitest";
import {
  buildVleSandboxEvidence,
  VLE_SANDBOX_SAMPLE_CODE,
  VLE_SANDBOX_TECRID,
} from "../lib/vle-sandbox-evidence";

describe("VLE sandbox evidence contract", () => {
  it("returns a deterministic, explicitly non-production envelope after issue", async () => {
    const first = await buildVleSandboxEvidence("issued", VLE_SANDBOX_TECRID, VLE_SANDBOX_SAMPLE_CODE);
    const second = await buildVleSandboxEvidence("issued", VLE_SANDBOX_TECRID, VLE_SANDBOX_SAMPLE_CODE);

    expect(first).toEqual(second);
    expect(first.sampleCode).toBe(VLE_SANDBOX_SAMPLE_CODE);
    expect(first.authentication.status).toBe("VERIFIED");
    expect(first.authentication.method).toBe("TECRID_SANDBOX_STATE_ONLY");
    expect(first.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.sandbox).toBe(true);
    expect(first.productionAuthority).toBe(false);
    expect(first.contractStatus).toBe("CANDIDATE_NOT_PRODUCTION");
  });

  it("fails closed before issuance or when identifiers do not match", async () => {
    await expect(buildVleSandboxEvidence("confirmed", VLE_SANDBOX_TECRID, VLE_SANDBOX_SAMPLE_CODE)).rejects.toMatchObject({ code: "evidence_not_issued" });
    await expect(buildVleSandboxEvidence("issued", "SBX·WRONG", VLE_SANDBOX_SAMPLE_CODE)).rejects.toMatchObject({ code: "tecrid_mismatch" });
    await expect(buildVleSandboxEvidence("issued", VLE_SANDBOX_TECRID, "VLE-SAMPLE-WRONG")).rejects.toMatchObject({ code: "sample_mismatch" });
  });
});
