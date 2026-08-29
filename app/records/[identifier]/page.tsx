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
      description: "A resolver-compatible fictional TECRID showing the complete public record experience.",
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
  return (
    <main className="product-page public-record-page sample-resolver-page">
      <ProductNav compact />
      <header className="record-page-hero">
        <div>
          <p className="section-kicker light">Public resolver sample · fictional report</p>
          <h1>{SAMPLE_TECRID}</h1>
          <p>Sample version 1 · published {new Date(SAMPLE_ISSUED_AT).toLocaleString("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" })} UTC</p>
        </div>
        <span className="public-sample"><i /> Sample · no live authority</span>
      </header>

      <section className="sample-explainer">
        <div><p className="section-kicker">You just resolved a TECRID</p><h2>This is the complete public record experience.</h2></div>
        <p>This identifier uses TECRID’s reserved sample namespace, so anyone can type it into the homepage and inspect the same human record, JSON document, provenance fields, and version history. Every party and value is fictional; no real laboratory issued it.</p>
      </section>

      <section className="public-record-shell">
        <div className="record-integrity-bar status-bar-sample"><span><i /> Sample digest and current version are internally consistent</span><span>Status: sample</span></div>
        <div className="public-record-summary">
          <article><span>Sample</span><strong>{sample.subject.sampleName}</strong><small>{sample.subject.lotNumber}</small></article>
          <article><span>Example issuer</span><strong><a href="/demo/lab">{sample.issuer.name} ↗</a></strong><small>{sample.issuer.code} · not registered</small></article>
          <article><span>Method</span><strong>{sample.subject.method}</strong><small>{sample.subject.matrix}</small></article>
        </div>
        <div className="public-results">
          <div className="results-note"><span>Analytical results</span><small>Invented values shown exactly as sampled</small></div>
          <table>
            <thead><tr><th>Analyte</th><th>Result</th><th>Unit</th><th>LOQ</th><th>Status</th></tr></thead>
            <tbody>{sample.results.map((row) => (
              <tr key={row.sequence}>
                <td><i className="element-badge">{row.symbol}</i><strong>{row.analyte}</strong></td>
                <td className="result-value">{row.resultText}</td>
                <td>{row.unit}</td>
                <td>{row.loqText || "—"}</td>
                <td><span className="reported">Sampled</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="provenance-register">
          <div><span>Example issuer</span><strong><a href="/demo/lab">{sample.issuer.name} ↗</a></strong><small>No legal entity or production authority</small></div>
          <div><span>Record fingerprint</span><code>sha256:{SAMPLE_RECORD_FINGERPRINT}</code><small>Recomputed from the fixed sample document</small></div>
          <div><span>Issuer proof</span><strong>Not present by design</strong><small>A sample must never be confused with a laboratory signature</small></div>
          <div><span>Machine access</span><a href={`/api/v1/credentials/${encodeURIComponent(SAMPLE_TECRID)}`}>Open JSON endpoint ↗</a><small>Returns the same record with sample and productionAuthority flags</small></div>
        </div>
        <div className="source-document-register">
          <div><span>Issuance basis</span><strong>Resolver-compatible sample report</strong><small>Demonstrates the workflow without publishing real evidence</small></div>
          <div><span>Source PDF fingerprint</span><code>sha256:{SAMPLE_SOURCE_FINGERPRINT}</code><small>northstar-demo-heavy-metals-report.pdf</small></div>
          <div><span>Laboratory reference</span><strong>DEMO-NS-260823-01</strong><small>Order DEMO-ORD-0821</small></div>
        </div>
      </section>

      <section className="version-register" aria-labelledby="sample-version-title">
        <div className="section-title-row">
          <div><p className="section-kicker">Append-only history</p><h2 id="sample-version-title">Version register</h2></div>
          <span className="verified-pill demo-pill"><i /> 1 sample version</span>
        </div>
        <ol><li><span>v1</span><div><strong>sample issuance</strong><p>Resolver-compatible fictional record published for evaluation</p></div><div><small>29 Aug 2026 · 00:00 UTC</small><code>sha256:{SAMPLE_RECORD_FINGERPRINT}</code></div></li></ol>
      </section>

      <section className="record-boundary">
        <p className="section-kicker">Demonstration boundary</p>
        <h2>This record demonstrates resolution. It proves no laboratory claim.</h2>
        <p>Its identifier, JSON document, source fingerprint, findings, and version history behave like the public surfaces of a TECRID. The fictional issuer has no reviewed key, no laboratory identity, and no production issuance authority.</p>
        <div className="sample-next"><a className="button-dark" href="/sandbox">Run the workflow in your own sandbox →</a><a href="/demo/heavy-metals">Inspect the underlying fictional report ↗</a></div>
      </section>
      <ProductFooter />
    </main>
  );
}
