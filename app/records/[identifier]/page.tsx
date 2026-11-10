import {RecordPage as AtlasSampleRecord} from "../../blue-atlas/record";
import { sampleLabReference } from "../../../lib/sample-lab";
import { SampleLabReferencePage } from "../../sample-lab/reference";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  isSampleTecrid,
  SAMPLE_TECRID,
  sampleCredentialDocument,
} from "../../../lib/sample-tecrid";
import { ProductFooter, ProductNav } from "../../site-nav";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ identifier: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { identifier } = await params;
  if (sampleLabReference(identifier)) return {title: `${identifier}, TEST reference`, robots:{index:false,follow:false}};
  if (isSampleTecrid(identifier)) {
    return {
      title: `${SAMPLE_TECRID}, Resolver sample`,
      description: "A complete fictional laboratory-report TECRID with product, SKU, lot, dates, method, results, source certificate, and provenance.",
      robots: { index: false, follow: true },
      openGraph: { title: `${SAMPLE_TECRID}, Resolver sample`, description: "A fictional public TECRID sample.", images: [] },
      twitter: { title: `${SAMPLE_TECRID}, Resolver sample`, description: "A fictional public TECRID sample.", images: [] },
    };
  }
  const { getCredential } = await import("../../../lib/tec");
  const record = await getCredential(decodeURIComponent(identifier));
  if (!record) {
    const { getPublicReportReservation } = await import("../../../lib/report-issuance");
    const reservation = await getPublicReportReservation(identifier);
    if (reservation) {
      return {
        title: `${reservation.tecrid}, Reserved report identifier`,
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
  const title = `${record.credential.identifier}, ${record.credential.sampleName}`;
  const description = `TEC record from ${record.issuer.name}, version ${record.credential.version}, status ${record.credential.status}.`;
  return {
    title,
    description,
    alternates: { canonical: `https://tecrid.com/records/${encodeURIComponent(record.credential.identifier)}` },
    openGraph: { title, description, type: "article", images: [] },
    twitter: { card: "summary", title, description, images: [] },
  };
}

export default async function RecordPage({ params }: PageProps) {
  const { identifier } = await params;
  if (sampleLabReference(identifier)) return <SampleLabReferencePage identifier={identifier} />;
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
          <p>Canonical version {credential.version} · issued {credential.issuedAt ? new Date(credential.issuedAt).toLocaleString("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) : "Not provided"} UTC</p>
        </div>
        <span className={integrity.issuerSignatureVerified ? "public-verified" : "public-unverified"}><i /> {integrity.issuerSignatureVerified ? "Issuer signature verified" : "Unsigned legacy record"}</span>
      </header>

      <section className="public-record-shell">
        <div className={`record-integrity-bar status-bar-${credential.status}`}><span><i /> {integrity.issuerSignatureVerified && integrity.fingerprintValid && integrity.currentVersionConsistent ? "Issuer signature, fingerprint, and current version verified" : integrity.fingerprintRecorded ? "Integrity proof incomplete or not independently verifiable" : "No integrity proof recorded"}</span><span>Status: {credential.status}</span></div>
        {issuer.issuerStatus === "suspended" || issuer.issuerStatus === "revoked" ? <div className="review-boundary"><strong>Issuing laboratory is {issuer.issuerStatus}.</strong><span>This TECRID still resolves. The laboratory cannot mint another record while it is {issuer.issuerStatus}.</span></div> : null}
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
                  <td><i className="element-badge">{row.symbol || "Not provided"}</i><strong>{row.analyte}</strong></td>
                  <td className="result-value">{row.resultText}</td>
                  <td>{row.unit}</td>
                  <td>{row.loqText || "Not provided"}</td>
                  <td><span className="reported">As issued</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div className="provenance-register">
          <div><span>Issuer identity</span><strong><a href={`/issuers/${encodeURIComponent(issuer.issuerCode)}`}>{issuer.name} ↗</a></strong><small>TEC issuer code {issuer.issuerCode}</small></div>
          <div><span>Record fingerprint</span><code>{publicDocument.integrity.fingerprint ? `sha256:${publicDocument.integrity.fingerprint}` : resultsControlled ? "Not published" : "Not recorded"}</code><small>{resultsControlled ? "The fingerprint commits to withheld findings, so it stays with the granted record." : integrity.fingerprintValid ? "Recomputed from the canonical current version" : integrity.fingerprintRecorded ? "Recorded but not validated against a canonical version" : "This record has no fingerprint"}</small></div>
          <div><span>Issuer proof</span><strong>{integrity.issuerSignatureVerified ? `${credential.signatureAlgorithm} verified` : "Not present"}</strong><small>{resultsControlled ? "TECRID checked the signature. The signature itself is withheld with the findings." : integrity.issuerSignatureVerified ? `Key ${credential.issuerKeyId}` : "A fingerprint alone does not prove laboratory key control"}</small></div>
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
        {publicDocument.versions.length ? <ol>{publicDocument.versions.map((version) => (
          <li key={`${version.version}-${version.createdAt}`}>
            <span>v{version.version}</span>
            <div><strong>{version.changeType.replaceAll("_", " ")}</strong><p>{version.changeReason || "No public reason supplied"}</p></div>
            <div><small>{new Date(version.createdAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</small><code>{version.fingerprint ? `sha256:${version.fingerprint}` : "Fingerprint withheld"}</code></div>
          </li>
        ))}</ol> : <div className="empty-registry"><strong>No append-only versions are recorded.</strong><p>TECRID does not infer a revision history from a current row.</p></div>}
      </section>

      <section className="record-boundary">
        <p className="section-kicker">Interpretation boundary</p>
        <h2>This record proves provenance, not product safety.</h2>
        <p>{integrity.issuerSignatureVerified ? "TEC confirms that the canonical payload matched the reviewed issuer key when this version was accepted and preserves its record history." : "This legacy record has a record fingerprint but no verified laboratory signature; attribution therefore relies on the TECRID account record."} {credential.sourceDocumentHash ? "For a historical-report confirmation, the signed payload also binds the exact source-document fingerprint; TECRID does not imply that the PDF itself is public." : ""} TEC does not replace representative sampling, method suitability, accreditation, regulatory review, or expert interpretation.</p>
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
        <div><p className="section-kicker">Report rendering state</p><h2>The laboratory has the identifier. TECRID does not have signed findings yet.</h2></div>
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

function SampleRecordPage(){return <AtlasSampleRecord document={sampleCredentialDocument()}/>;}
