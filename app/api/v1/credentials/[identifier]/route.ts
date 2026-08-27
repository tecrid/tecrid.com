import { getCredential } from "../../../../../lib/tec";

export async function GET(
  _request: Request,
  context: { params: Promise<{ identifier: string }> },
) {
  const { identifier } = await context.params;
  const record = await getCredential(decodeURIComponent(identifier));
  if (!record) {
    return Response.json(
      { error: { code: "not_found", message: "No public TEC record was found." } },
      { status: 404 },
    );
  }
  return Response.json({
    object: "credential",
    identifier: record.credential.identifier,
    status: record.credential.status,
    version: record.credential.version,
    issued_at: record.credential.issuedAt,
    fingerprint: record.credential.fingerprint,
    sample: {
      name: record.credential.sampleName,
      lot_number: record.credential.lotNumber,
      matrix: record.credential.matrix,
    },
    method: record.credential.method,
    issuer: {
      name: record.issuer.name,
      code: record.issuer.issuerCode,
      verification_status: record.issuer.issuerStatus,
    },
    results: record.results.map((row) => ({
      analyte: row.analyte,
      symbol: row.symbol,
      result: row.resultText,
      numeric_value: row.numericValue,
      unit: row.unit,
      loq: row.loqText,
      method: row.method,
    })),
  });
}
