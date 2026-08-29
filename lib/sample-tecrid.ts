import { getDemoRecord } from "./demo-records";

export const SAMPLE_TECRID = "TECRID·DEMO-26-HM0001";
export const SAMPLE_ISSUED_AT = "2026-08-23T18:42:00.000Z";
export const SAMPLE_RECORD_FINGERPRINT =
  "0bd6c0c9d7427fb6e3804ff2a29091088a17668812024c2778d4563d057e7700";
export const SAMPLE_SOURCE_FINGERPRINT =
  "2e2f612152e26ec403885d816e21851abf2f113024e383bc1d72cce12cd0aec8";

export function isSampleTecrid(identifier: string) {
  try {
    return decodeURIComponent(identifier).trim().toUpperCase() === SAMPLE_TECRID;
  } catch {
    return false;
  }
}

const sampleReport = getDemoRecord("heavy-metals");
const report = sampleReport.report;

if (!report) throw new Error("The resolver sample requires complete report details.");

const canonicalRecord = {
  type: "TestEvidenceCredentialResolverSample",
  schemaVersion: "tec-registry/1.1-draft",
  tecrid: SAMPLE_TECRID,
  version: 1,
  status: "sample",
  issuedAt: SAMPLE_ISSUED_AT,
  issuer: {
    code: "DEMO-NLA",
    name: "Northstar Laboratory Demonstration",
    status: "fictional_not_verified",
  },
  customer: {
    organizationName: report.preparedFor,
    brandName: report.brandName,
    accountCode: "DEMO-ATL",
    contactVisibility: "withheld_from_public_sample",
  },
  subject: {
    productName: report.productName,
    sku: report.sku,
    packageFormat: report.packageFormat,
    lotNumber: sampleReport.lot,
    sampleId: report.sampleId,
    sampleDescription: sampleReport.sample,
    matrix: sampleReport.matrix,
    servingSize: report.servingSize,
  },
  report: {
    reportNumber: report.reportNumber,
    orderNumber: report.orderNumber,
    testNumber: report.testNumber,
    assay: report.assay,
    testingLocation: report.testingLocation,
    notes: report.notes,
  },
  timeline: {
    receivedAt: report.receivedAt,
    testedAt: report.testedAt,
    releasedAt: report.releasedAt,
    tecridIssuedAt: SAMPLE_ISSUED_AT,
  },
  method: {
    code: report.methodCode,
    name: sampleReport.method,
    reference: report.methodReference,
    accreditationScope: report.accreditation,
  },
  approval: {
    approverName: report.approverName,
    approverTitle: report.approverTitle,
    approvedAt: report.releasedAt,
    state: report.approvalState,
    cryptographicIssuerSignatureVerified: false,
  },
  sourceDocument: {
    sha256: SAMPLE_SOURCE_FINGERPRINT,
    filename: report.sourceFilename,
    mediaType: "application/pdf",
    pageCount: 1,
    reportNumber: report.reportNumber,
    orderNumber: report.orderNumber,
    testNumber: report.testNumber,
    issuanceBasis: "resolver_sample",
    publicDocument: true,
    publicPath: report.sourcePath,
  },
  results: sampleReport.results.map((row, sequence) => ({
    analyte: row.analyte,
    symbol: row.symbol,
    resultText: row.result,
    qualifier: row.qualifier ?? "reported",
    numericValue: row.numericValue ?? null,
    unit: row.unit,
    loqText: row.loq ?? null,
    limitText: row.limit ?? null,
    limitSource: row.limitSource ?? null,
    status: row.status ?? "Reported",
    basis: row.basis ?? null,
    method: row.method ?? report.methodCode,
    sequence,
  })),
  visibility: {
    publicFields: ["report_identity", "product_identity", "timeline", "method", "results", "approval_state", "source_document"],
    controlledFields: ["customer_contact", "chain_of_custody", "raw_instrument_data"],
    sourceDocumentVisibility: "public_fictional_sample",
  },
};

export const SAMPLE_CANONICAL_PAYLOAD = JSON.stringify(canonicalRecord);

export function sampleCredentialDocument() {
  return {
    ...canonicalRecord,
    updatedAt: SAMPLE_ISSUED_AT,
    sample: true,
    productionAuthority: false,
    issuer: {
      ...canonicalRecord.issuer,
      registryPath: "/demo/lab",
    },
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
        "The sample record and source PDF digests are reproducible, but no real laboratory key or production issuance authority is asserted.",
    },
    versions: [
      {
        version: 1,
        status: "sample",
        fingerprint: SAMPLE_RECORD_FINGERPRINT,
        canonicalPayload: SAMPLE_CANONICAL_PAYLOAD,
        changeType: "sample_issuance",
        changeReason: "Complete report-shaped fictional record published for resolver evaluation",
        createdAt: SAMPLE_ISSUED_AT,
      },
    ],
    links: {
      human: `/records/${encodeURIComponent(SAMPLE_TECRID)}`,
      json: `/api/v1/credentials/${encodeURIComponent(SAMPLE_TECRID)}`,
      issuer: "/demo/lab",
      sourceDocument: report.sourcePath,
      sourceDemonstration: "/demo/heavy-metals",
    },
    relatedRecords: [],
    interpretationBoundary:
      "This fictional sample demonstrates a complete report identity, exact source-document binding, structured findings, visibility, and version display. It is not laboratory evidence and cannot establish product safety or compliance.",
  };
}
