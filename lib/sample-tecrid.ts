import { getDemoRecord } from "./demo-records";

export const SAMPLE_TECRID = "TECRID·DEMO-26-HM0001";
export const SAMPLE_ISSUED_AT = "2026-08-29T00:00:00.000Z";
export const SAMPLE_RECORD_FINGERPRINT =
  "35fc830fb17c6bbada9930e493f25ac28267dc8d3a85c7a1e1e30010179fe0cc";
export const SAMPLE_SOURCE_FINGERPRINT =
  "0fdf074b232d2df807918ded2b278b40793786663450488f951508172806390d";

export function isSampleTecrid(identifier: string) {
  try {
    return decodeURIComponent(identifier).trim().toUpperCase() === SAMPLE_TECRID;
  } catch {
    return false;
  }
}

const sampleReport = getDemoRecord("heavy-metals");

export const SAMPLE_CANONICAL_PAYLOAD = JSON.stringify({
  type: "TestEvidenceCredentialResolverSample",
  tecrid: SAMPLE_TECRID,
  version: 1,
  status: "sample",
  issuedAt: SAMPLE_ISSUED_AT,
  issuer: { code: "DEMO-NLA", name: "Northstar Laboratory Demonstration" },
  subject: {
    sampleName: sampleReport.sample,
    lotNumber: sampleReport.lot,
    matrix: sampleReport.matrix,
    method: sampleReport.method,
  },
  results: sampleReport.results.map((row, sequence) => ({
    analyte: row.analyte,
    symbol: row.symbol,
    resultText: row.result,
    unit: row.unit,
    loqText: row.loq ?? null,
    method: row.method ?? sampleReport.method,
    sequence,
  })),
});

export function sampleCredentialDocument() {
  const report = sampleReport;
  return {
    schemaVersion: "tec-registry/1.0-draft",
    type: "TestEvidenceCredentialResolverSample",
    tecrid: SAMPLE_TECRID,
    status: "sample",
    version: 1,
    issuedAt: SAMPLE_ISSUED_AT,
    updatedAt: SAMPLE_ISSUED_AT,
    sample: true,
    productionAuthority: false,
    issuer: {
      code: "DEMO-NLA",
      name: "Northstar Laboratory Demonstration",
      status: "fictional_not_verified",
      registryPath: "/demo/lab",
    },
    subject: {
      sampleName: report.sample,
      lotNumber: report.lot,
      matrix: report.matrix,
      method: report.method,
      collectedAt: "2026-08-20",
      receivedAt: "2026-08-21",
      testedAt: "2026-08-22",
      releasedAt: "2026-08-23",
      submittingParty: "Fictional demonstration brand",
    },
    sourceDocument: {
      sha256: SAMPLE_SOURCE_FINGERPRINT,
      filename: "northstar-demo-heavy-metals-report.pdf",
      reportNumber: "DEMO-NS-260823-01",
      orderNumber: "DEMO-ORD-0821",
      issuanceBasis: "resolver_sample",
      publicDocument: false,
    },
    results: report.results.map((row, sequence) => ({
      analyte: row.analyte,
      symbol: row.symbol,
      resultText: row.result,
      numericValue: null,
      unit: row.unit,
      loqText: row.loq ?? null,
      method: row.method ?? report.method,
      sequence,
    })),
    integrity: {
      fingerprintRecorded: true,
      fingerprintValid: true,
      issuerSignatureVerified: false,
      versionHistoryRecorded: true,
      currentVersionConsistent: true,
      fingerprintAlgorithm: "SHA-256",
      fingerprint: SAMPLE_RECORD_FINGERPRINT,
      issuerProof: null,
      demonstrationBoundary:
        "The sample digest is reproducible, but no real laboratory key or production issuance authority is asserted.",
    },
    versions: [
      {
        version: 1,
        status: "sample",
        fingerprint: SAMPLE_RECORD_FINGERPRINT,
        canonicalPayload: SAMPLE_CANONICAL_PAYLOAD,
        changeType: "sample_issuance",
        changeReason: "Resolver-compatible fictional record published for evaluation",
        createdAt: SAMPLE_ISSUED_AT,
      },
    ],
    links: {
      human: `/records/${encodeURIComponent(SAMPLE_TECRID)}`,
      json: `/api/v1/credentials/${encodeURIComponent(SAMPLE_TECRID)}`,
      issuer: "/demo/lab",
      sourceDemonstration: "/demo/heavy-metals",
    },
    interpretationBoundary:
      "This fictional sample demonstrates TECRID resolution, field structure, source-document binding, and version display. It is not laboratory evidence and cannot establish product safety or compliance.",
  };
}
