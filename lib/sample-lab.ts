import reports from "./sample-lab-reports.json";
import reportDetails from "./sample-lab-report-details.json";

export const sampleLabReports = reports;
export const SAMPLE_LAB_NAME = "TECRID Sample Laboratory";
export function sampleLabReport(identifier: string) {
  let decoded: string;
  try { decoded = decodeURIComponent(identifier); } catch { return null; }
  return reports.find(r => r.testIdentifier === decoded || r.reportNumber === decoded) ?? null;
}
export function sampleLabReference(identifier: string) {
  const report = sampleLabReport(identifier);
  if (!report) return null;
  return {
    ...report,
    reportDetails: reportDetails[report.reportNumber as keyof typeof reportDetails],
    resultsAccess: {state: "controlled", url: `https://tecrid.com/api/test-reports/${encodeURIComponent(report.testIdentifier)}/results`},
    schemaVersion: "tecrid-sample-lab/1",
    sandbox: true,
    productionAuthority: false,
    status: "test_reference",
    productionTecrid: null,
    laboratoryConfirmation: "pending",
    testIssuer: SAMPLE_LAB_NAME,
    resolverUrl: `https://tecrid.com/records/${encodeURIComponent(report.testIdentifier)}`,
    jsonUrl: `https://tecrid.com/api/v1/credentials/${encodeURIComponent(report.testIdentifier)}`,
    vleDisplayLabel: "TEST identifier · Light Labs confirmation pending",
    documentUrl: `https://vle.exchange/reports/ll-${report.reportNumber}`,
    documentAccess: "Verified email and an active Kasandrinos grant for this report and scope required. Kasandrinos team owners and administrators manage TEST access at /dashboard/kasandrinos.",
    authenticatedDocumentUrl: `https://tecrid.com/api/test-reports/${encodeURIComponent(report.testIdentifier)}/document`,
    sourceProfileUrl: "https://tecrid.com/participants/LLTEST",
    controllerProfileUrl: "https://tecrid.com/participants/KASTEST",
    vleSamplingId: null,
    vleCustodyId: null,
    results: [],
    note: "Source report association for integration testing. Not a Light Labs signature, issued production credential, certification or VLE qualification. Original PDFs and analytical transcriptions are not published by this endpoint.",
  };
}

export async function sampleHash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), b => b.toString(16).padStart(2,"0")).join("");
}

export async function sampleLabCanonical(userId: string, identifier: string) {
  const report = sampleLabReference(identifier);
  if (!report) throw new Error("Unknown sample-lab report.");
  return JSON.stringify({
    type: "TECRIDSampleLabTransportProof",
    sandbox: true,
    productionAuthority: false,
    ownerScope: await sampleHash(userId),
    testIdentifier: report.testIdentifier,
    testIssuer: SAMPLE_LAB_NAME,
    sourceReport: {reportNumber:report.reportNumber,sourceIssuer:report.sourceIssuer,sampleName:report.sampleName,lotNumber:report.lotNumber,testedAt:report.testedAt,releasedAt:report.releasedAt,sha256:report.sourceSha256},
    attestation: "Integration test only; the test signer does not represent Light Labs or confirm the analytical results.",
  });
}

export async function verifySampleLabProof(payload: string, publicJwk: JsonWebKey, signature: string) {
  if (!publicJwk || publicJwk.kty !== "OKP" || publicJwk.crv !== "Ed25519" || !publicJwk.x || publicJwk.d) throw new Error("Supply only an Ed25519 public JWK; never send a private key.");
  if (typeof signature !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(signature)) throw new Error("A base64url Ed25519 signature is required.");
  const publicKeyJwk = {kty:"OKP",crv:"Ed25519",x:publicJwk.x};
  const key = await crypto.subtle.importKey("jwk",publicKeyJwk,"Ed25519",false,["verify"]);
  const bytes = Uint8Array.from(atob(signature.replaceAll("-","+").replaceAll("_","/")+"=="),c=>c.charCodeAt(0));
  if (!await crypto.subtle.verify("Ed25519",key,bytes,new TextEncoder().encode(payload))) throw new Error("Sample-lab signature did not verify.");
  return publicKeyJwk;
}
