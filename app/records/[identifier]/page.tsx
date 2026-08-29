import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  isSampleTecrid,
  SAMPLE_ISSUED_AT,
  SAMPLE_RECORD_FINGERPRINT,
  SAMPLE_SOURCE_FINGERPRINT,
  SAMPLE_TECRID,
  sampleCredentialDocument,
} from "../../../lib/sample-tecrid";
import { ProductFooter, ProductNav } from "../../site-nav";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ identifier: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { identifier } = await params;
  if (isSampleTecrid(identifier)) {
    return {
      title: `${SAMPLE_TECRID} — Resolver sample`,
      description: "A complete fictional laboratory-report TECRID with product, SKU, lot, dates, method, results, source certificate, and provenance.",
      robots: { index: false, follow: true },
      openGraph: { title: `${SAMPLE_TECRID} — Resolver sample`, description: "A fictional public TECRID sample.", images: [] },
      twitter: { title: `${SAMPLE_TECRID} — Resolver sample`, description: "A fictional public TECRID sample.", images: [] },
    };
  }
  const { getCredential } = await import("../../../lib/tec");
  const record = await getCredential(decodeURIComponent(identifier));
  if (!record) {
    const { getPublicReportReservation } = await import("../../../lib/report-issuance");
    const reservation = await getPublicReportReservation(identifier);
    if (reservation) {
      return {
        title: `${reservation.tecrid} — Reserved report identifier`,
        description: "A laboratory reserved this TECRID for report rendering. No analytical credential has been issued yet.",
        robots: { index: false, follow: true },
      };
    }
    return {
      title: "TECRID not found",
      description: "No public TEC record was found for this TECRID.",
      openGraph: { title: "TECRID not found", description: "No public TEC record was found for this TECRID.", images: [] },
      twitter: { title: "TECRID not found", description: "No public TEC record was found for this TECRID.", images: [] },
    };
  }
  const title = `${record.credential.identifier} — ${record.credential.sampleName}`;
  const description = `TEC record from ${record.issuer.name}, version ${record.credential.version}, status ${record.credential.status}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article", images: [] },
    twitter: { card: "summary", title, description, images: [] },
  };
}

export default async function RecordPage({ params }: PageProps) {
  const { identifier } = await params;
  if (isSampleTecrid(identifier)) return <SampleRecordPage />;
  const { getCredential, publicCredentialDocument } = await import("../../../lib/tec");
  const record = await getCredential(decodeURIComponent(identifier));
  if (!record) {
    const { getPublicReportReservation } = await import("../../../lib/report-issuance");
    const reservation = await getPublicReportReservation(identifier);
    if (reservation) return <ReservedRecordPage reservation={reservation} />;
    notFound();
  }
  const { credential, issuer, results, versions, integrity } = record;
  const publicDocument = publicCredentialDocument(record);
  const resultsControlled = publicDocument.resultsAccess.state === "controlled";

  return (
    <main className="product-page public-record-page">
      <ProductNav compact />
      <header className="record-page-hero">
        <div>
          <p className="section-kicker light">Public TEC resolver · TECRID</p>
          <h1>{credential.identifier}</h1>
          <p>Canonical version {credential.version} · issued {credential.issuedAt ? new Date(credential.issuedAt).toLocaleString("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) : "—"} UTC</p>
        </div>
        <span className={integrity.issuerSignatureVerified ? "public-verified" : "public-unverified"}><i /> {integrity.issuerSignatureVerified ? "Issuer signature verified" : "Unsigned legacy record"}</span>
      </header>

      <section className="public-record-shell">
        <div className={`record-integrity-bar status-bar-${credential.status}`}><span><i /> {integrity.issuerSignatureVerified && integrity.fingerprintValid && integrity.currentVersionConsistent ? "Issuer signature, fingerprint, and current version verified" : integrity.fingerprintRecorded ? "Integrity proof incomplete or not independently verifiable" : "No integrity proof recorded"}</span><span>Status: {credential.status}</span></div>
        <div className="public-record-summary">
          <article><span>Sample</span><strong>{credential.sampleName}</strong><small>{credential.productSku ? `${credential.productSku} · ` : ""}{credential.lotNumber || "No lot supplied"}</small></article>
          <article><span>Issued by</span><strong><a href={`/issuers/${encodeURIComponent(issuer.issuerCode)}`}>{issuer.name} ↗</a></strong><small>{issuer.issuerCode} · {issuer.issuerStatus.replaceAll("_", " ")}</small></article>
          <article><span>Method</span><strong>{credential.method || "As reported by issuer"}</strong><small>{credential.matrix || "Matrix not supplied"}</small></article>
        </div>
        {resultsControlled ? (
          <div className="controlled-results-gate">
            <div><p className="section-kicker">Controlled findings</p><h2>The TECRID resolves. Its analytical values require a grant.</h2></div>
            <div><p>The issuer, status, fingerprint, and version history remain publicly verifiable. The brand or ingredient supplier controls which named organizations receive the findings for this SKU.</p><a href="/dashboard/evidence-routing">Open evidence routing →</a></div>
          </div>
        ) : (
          <div className="public-results">
            <div className="results-note"><span>Analytical results</span><small>Values shown exactly as issued</small></div>
            <table>
              <thead><tr><th>Analyte</th><th>Result</th><th>Unit</th><th>LOQ</th><th>Status</th></tr></thead>
              <tbody>{results.map((row) => (
                <tr key={row.id}>
                  <td><i className="element-badge">{row.symbol || "—"}</i><strong>{row.analyte}</strong></td>
                  <td className="result-value">{row.resultText}</td>
                  <td>{row.unit}</td>
                  <td>{row.loqText || "—"}</td>
                  <td><span className="reported">As issued</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div className="provenance-register">
          <div><span>Issuer identity</span><strong><a href={`/issuers/${encodeURIComponent(issuer.issuerCode)}`}>{issuer.name} ↗</a></strong><small>TEC issuer code {issuer.issuerCode}</small></div>
          <div><span>Record fingerprint</span><code>{credential.fingerprint ? `sha256:${credential.fingerprint}` : "Not recorded"}</code><small>{integrity.fingerprintValid ? "Recomputed from the canonical current version" : integrity.fingerprintRecorded ? "Recorded but not validated against a canonical version" : "This record has no fingerprint"}</small></div>
          <div><span>Issuer proof</span><strong>{integrity.issuerSignatureVerified ? `${credential.signatureAlgorithm} verified` : "Not present"}</strong><small>{integrity.issuerSignatureVerified ? `Key ${credential.issuerKeyId}` : "A fingerprint alone does not prove laboratory key control"}</small></div>
          <div><span>Machine access</span><a href={`/api/v1/credentials/${encodeURIComponent(credential.identifier)}`}>Open JSON endpoint ↗</a><small>{resultsControlled ? "Public integrity envelope; findings and signed payload withheld" : "Includes exact signed payload, signature, reviewed public key, and live verification state"}</small></div>
        </div>
        {credential.sourceDocumentHash ? (
          <div className="source-document-register">
            <div><span>Issuance basis</span><strong>{credential.issuanceBasis === "legacy_report_confirmation" ? "Laboratory confirmation of a historical report" : credential.issuanceBasis || "Issuer supplied"}</strong><small>The original document remains private unless its owners separately authorize publication</small></div>
            <div><span>Source PDF fingerprint</span><code>sha256:{credential.sourceDocumentHash}</code><small>{credential.sourceDocumentName || "Source filename withheld"}</small></div>
            <div><span>Laboratory reference</span><strong>{credential.laboratoryReportNumber || "Not supplied"}</strong><small>{credential.laboratoryOrderNumber ? `Order ${credential.laboratoryOrderNumber}` : "No order number supplied"}</small></div>
          </div>
        ) : null}
      </section>

      <section className="version-register" aria-labelledby="version-register-title">
        <div className="section-title-row">
          <div><p className="section-kicker">Append-only history</p><h2 id="version-register-title">Version register</h2></div>
          <span className="verified-pill"><i /> {versions.length} recorded</span>
        </div>
        {versions.length ? <ol>{versions.map((version) => (
          <li key={`${version.version}-${version.fingerprint}`}>
            <span>v{version.version}</span>
            <div><strong>{version.changeType.replaceAll("_", " ")}</strong><p>{version.changeReason || "No public reason supplied"}</p></div>
            <div><small>{new Date(version.createdAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</small><code>sha256:{version.fingerprint}</code></div>
          </li>
        ))}</ol> : <div className="empty-registry"><strong>No append-only versions are recorded.</strong><p>The registry does not infer a revision history from a current row.</p></div>}
      </section>

      <section className="record-boundary">
        <p className="section-kicker">Interpretation boundary</p>
        <h2>This record proves provenance, not product safety.</h2>
        <p>{integrity.issuerSignatureVerified ? "TEC confirms that the canonical payload matched the reviewed issuer key when this version was accepted and preserves its registry history." : "This legacy record has a registry fingerprint but no verified laboratory signature; attribution therefore relies on the registry account record."} {credential.sourceDocumentHash ? "For a historical-report confirmation, the signed payload also binds the exact source-document fingerprint; TECRID does not imply that the PDF itself is public." : ""} TEC does not replace representative sampling, method suitability, accreditation, regulatory review, or expert interpretation.</p>
      </section>
      <ProductFooter />
    </main>
  );
}

function ReservedRecordPage({ reservation }: { reservation: NonNullable<Awaited<ReturnType<typeof import("../../../lib/report-issuance").getPublicReportReservation>>> }) {
  const expired = reservation.expired;
  return (
    <main className="product-page public-record-page reserved-record-page">
      <ProductNav compact />
      <header className="record-page-hero">
        <div>
          <p className="section-kicker light">Public TEC resolver · reserved identifier</p>
          <h1>{reservation.tecrid}</h1>
          <p>Reserved {new Date(reservation.reservedAt).toLocaleString("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" })} UTC</p>
        </div>
        <span className="public-unverified"><i /> {expired ? "Reservation expired" : "Reserved · not issued"}</span>
      </header>
      <section className="sample-explainer reserved-explainer">
        <div><p className="section-kicker">Report rendering state</p><h2>The laboratory has the identifier. The registry does not have signed findings yet.</h2></div>
        <p>This state lets a LIMS print the TECRID and resolver link on the final report before the laboratory fingerprints and signs that finished PDF. Until finalization, this page proves only that the identifier was reserved by the named verified laboratory account.</p>
      </section>
      <section className="public-record-shell">
        <div className="record-integrity-bar status-bar-draft"><span><i /> No analytical credential or issuer signature has been accepted</span><span>Status: {expired ? "expired" : reservation.status}</span></div>
        <div className="public-record-summary">
          <article><span>Reserved by</span><strong><a href={`/issuers/${encodeURIComponent(reservation.laboratory.code)}`}>{reservation.laboratory.name} ↗</a></strong><small>{reservation.laboratory.code} · {reservation.laboratory.status.replaceAll("_", " ")}</small></article>
          <article><span>Production authority</span><strong>Not yet established</strong><small>Final PDF fingerprint and laboratory signature pending</small></article>
          <article><span>Reservation expires</span><strong>{new Date(reservation.expiresAt).toLocaleDateString("en", { dateStyle: "long", timeZone: "UTC" })}</strong><small>A new TECRID is required after expiry</small></article>
        </div>
      </section>
      <section className="record-boundary">
        <p className="section-kicker">Interpretation boundary</p>
        <h2>A reserved TECRID is not a laboratory result.</h2>
        <p>Do not use this state as evidence of testing, product status, or report authenticity. A production record appears only after the laboratory submits the final document fingerprint, structured findings, and a signature that verifies against its ICS-reviewed key.</p>
      </section>
      <ProductFooter />
    </main>
  );
}

function SampleRecordPage() {
  const sample = sampleCredentialDocument();
  const displayDate = (value: string) => new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en", { dateStyle: "long", timeZone: "UTC" });
  return (
    <main className="product-page public-record-page sample-resolver-page">
      <ProductNav compact />
      <header className="record-page-hero">
        <div>
          <p className="section-kicker light">Public resolver sample · fictional report</p>
          <h1>{SAMPLE_TECRID}</h1>
          <p>Report {sample.report.reportNumber} · released {displayDate(sample.timeline.releasedAt)} · sample version 1</p>
        </div>
        <span className="public-sample"><i /> Sample · no live authority</span>
      </header>

      <section className="sample-explainer">
        <div><p className="section-kicker">You just resolved a TECRID</p><h2>The report identity comes first.</h2></div>
        <p>This record preserves the product, SKU, lot, sample ID, laboratory references, testing dates, method, findings, approval state, source certificate, and version as one resolvable object. Every party and value is fictional; no real laboratory issued it.</p>
      </section>

      <section className="public-record-shell">
        <div className="record-integrity-bar status-bar-sample"><span><i /> Sample digest and current version are internally consistent</span><span>Status: sample</span></div>
        <div className="sample-identity-grid">
          <article><span>Product</span><strong>{sample.subject.productName}</strong><small>{sample.customer.brandName} · fictional</small></article>
          <article><span>SKU</span><code>{sample.subject.sku}</code><small>{sample.subject.packageFormat}</small></article>
          <article><span>Lot</span><code>{sample.subject.lotNumber}</code><small>Lot reported by submitting party</small></article>
          <article><span>Sample ID</span><code>{sample.subject.sampleId}</code><small>{sample.subject.sampleDescription}</small></article>
        </div>
        <div className="sample-report-grid">
          <div><span>Prepared for</span><strong>{sample.customer.organizationName}</strong><small>Account {sample.customer.accountCode}</small></div>
          <div><span>Assay</span><strong>{sample.report.assay}</strong><small>Test {sample.report.testNumber}</small></div>
          <div><span>Serving size</span><strong>{sample.subject.servingSize}</strong><small>{sample.subject.matrix}</small></div>
          <div><span>Laboratory references</span><strong>{sample.report.reportNumber}</strong><small>Order {sample.report.orderNumber}</small></div>
        </div>
        <div className="sample-timeline-grid" aria-label="Report timeline">
          <div><span>Received</span><strong>{displayDate(sample.timeline.receivedAt)}</strong></div>
          <div><span>Tested</span><strong>{displayDate(sample.timeline.testedAt)}</strong></div>
          <div><span>Released</span><strong>{displayDate(sample.timeline.releasedAt)}</strong></div>
          <div><span>TECRID issued</span><strong>{new Date(sample.timeline.tecridIssuedAt).toLocaleString("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" })} UTC</strong></div>
        </div>
        <div className="public-record-summary">
          <article><span>Example issuer</span><strong><a href="/demo/lab">{sample.issuer.name} ↗</a></strong><small>{sample.issuer.code} · not registered</small></article>
          <article><span>Method</span><strong>{sample.method.code}</strong><small>{sample.method.name}</small></article>
          <article><span>Testing location</span><strong>{sample.report.testingLocation}</strong><small>{sample.method.accreditationScope}</small></article>
        </div>
        <div className="sample-method-register">
          <div><span>Method detail</span><p>{sample.method.reference}</p></div>
          <div><span>Sample notes</span><p>{sample.report.notes}</p></div>
        </div>
        <div className="public-results">
          <div className="results-note"><span>Complete analytical panel · 8 of 8 rows</span><small>Exact fictional result text · limits are fictional customer specifications, not regulatory limits</small></div>
          <table>
            <thead><tr><th>Analyte</th><th>Reported result</th><th>LOQ</th><th>Limit</th><th>Lab status</th></tr></thead>
            <tbody>{sample.results.map((row) => (
              <tr key={row.sequence}>
                <td><i className="element-badge">{row.symbol}</i><span className="sample-analyte-copy"><strong>{row.analyte}</strong><small>{row.basis}</small></span></td>
                <td className="result-value">{row.resultText} <small>{row.unit}</small></td>
                <td>{row.loqText || "—"}</td>
                <td>{row.limitText || "Not reported"}</td>
                <td><span className={`sample-result-label result-${row.qualifier}`}>{row.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="source-document-register sample-source-register">
          <div><span>Source certificate</span><strong><a href={sample.sourceDocument.publicPath} target="_blank" rel="noreferrer">Open fictional source COA ↗</a></strong><small>Public demonstration PDF · {sample.sourceDocument.pageCount} page</small></div>
          <div><span>Source PDF fingerprint</span><code>sha256:{SAMPLE_SOURCE_FINGERPRINT}</code><small>{sample.sourceDocument.filename}</small></div>
          <div><span>Laboratory references</span><strong>{sample.sourceDocument.reportNumber}</strong><small>Order {sample.sourceDocument.orderNumber} · Test {sample.sourceDocument.testNumber}</small></div>
        </div>
        <div className="provenance-register">
          <div><span>Approval</span><strong>{sample.approval.approverName}</strong><small>{sample.approval.approverTitle} · {displayDate(sample.approval.approvedAt)}</small></div>
          <div><span>Record fingerprint</span><code>sha256:{SAMPLE_RECORD_FINGERPRINT}</code><small>Recomputed from the fixed sample document</small></div>
          <div><span>Issuer proof</span><strong>Not present by design</strong><small>A sample must never be confused with a laboratory signature</small></div>
          <div><span>Machine access</span><a href={`/api/v1/credentials/${encodeURIComponent(SAMPLE_TECRID)}`}>Open JSON endpoint ↗</a><small>Returns the same record with sample and productionAuthority flags</small></div>
        </div>
        <div className="sample-visibility-register">
          <div><span>Public in this sample</span><strong>Report, product, dates, method, results, approval state and source COA</strong></div>
          <div><span>Controlled in production</span><strong>Customer contacts, chain of custody and raw instrument data</strong></div>
        </div>
      </section>

      <section className="version-register" aria-labelledby="sample-version-title">
        <div className="section-title-row">
          <div><p className="section-kicker">Append-only history</p><h2 id="sample-version-title">Version register</h2></div>
          <span className="verified-pill demo-pill"><i /> 1 sample version</span>
        </div>
        <ol><li><span>v1</span><div><strong>sample issuance</strong><p>Complete report-shaped fictional record published for resolver evaluation</p></div><div><small>{new Date(SAMPLE_ISSUED_AT).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</small><code>sha256:{SAMPLE_RECORD_FINGERPRINT}</code></div></li></ol>
      </section>

      <section className="record-boundary">
        <p className="section-kicker">Demonstration boundary</p>
        <h2>This record demonstrates resolution. It proves no laboratory claim.</h2>
        <p>Its identifier, complete report identity, JSON document, inspectable source PDF, fingerprints, findings, visibility rules, and version history behave like TECRID public surfaces. The fictional issuer has no reviewed key, legal identity, accreditation, or production issuance authority.</p>
        <div className="sample-next"><a className="button-dark" href="/sandbox">Run the workflow in your own sandbox →</a><a href={sample.sourceDocument.publicPath} target="_blank" rel="noreferrer">Open the fictional source COA ↗</a></div>
      </section>
      <ProductFooter />
    </main>
  );
}
