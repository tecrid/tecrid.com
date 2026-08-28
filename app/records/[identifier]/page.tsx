import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCredential } from "../../../lib/tec";
import { ProductFooter, ProductNav } from "../../site-nav";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ identifier: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { identifier } = await params;
  const record = await getCredential(decodeURIComponent(identifier));
  if (!record) {
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
  const record = await getCredential(decodeURIComponent(identifier));
  if (!record) notFound();
  const { credential, issuer, results, versions, integrity } = record;

  return (
    <main className="product-page public-record-page">
      <ProductNav compact />
      <header className="record-page-hero">
        <div>
          <p className="section-kicker light">Public TEC record · TECRID</p>
          <h1>{credential.identifier}</h1>
          <p>Canonical version {credential.version} · issued {credential.issuedAt ? new Date(credential.issuedAt).toLocaleString("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) : "—"} UTC</p>
        </div>
        <span className={integrity.issuerSignatureVerified ? "public-verified" : "public-unverified"}><i /> {integrity.issuerSignatureVerified ? "Issuer signature verified" : "Unsigned legacy record"}</span>
      </header>

      <section className="public-record-shell">
        <div className={`record-integrity-bar status-bar-${credential.status}`}><span><i /> {integrity.issuerSignatureVerified && integrity.fingerprintValid && integrity.currentVersionConsistent ? "Issuer signature, fingerprint, and current version verified" : integrity.fingerprintRecorded ? "Integrity proof incomplete or not independently verifiable" : "No integrity proof recorded"}</span><span>Status: {credential.status}</span></div>
        <div className="public-record-summary">
          <article><span>Sample</span><strong>{credential.sampleName}</strong><small>{credential.lotNumber || "No lot supplied"}</small></article>
          <article><span>Issued by</span><strong><a href={`/issuers/${encodeURIComponent(issuer.issuerCode)}`}>{issuer.name} ↗</a></strong><small>{issuer.issuerCode} · {issuer.issuerStatus.replaceAll("_", " ")}</small></article>
          <article><span>Method</span><strong>{credential.method || "As reported by issuer"}</strong><small>{credential.matrix || "Matrix not supplied"}</small></article>
        </div>
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
        <div className="provenance-register">
          <div><span>Issuer identity</span><strong><a href={`/issuers/${encodeURIComponent(issuer.issuerCode)}`}>{issuer.name} ↗</a></strong><small>TEC issuer code {issuer.issuerCode}</small></div>
          <div><span>Record fingerprint</span><code>{credential.fingerprint ? `sha256:${credential.fingerprint}` : "Not recorded"}</code><small>{integrity.fingerprintValid ? "Recomputed from the canonical current version" : integrity.fingerprintRecorded ? "Recorded but not validated against a canonical version" : "This record has no fingerprint"}</small></div>
          <div><span>Issuer proof</span><strong>{integrity.issuerSignatureVerified ? `${credential.signatureAlgorithm} verified` : "Not present"}</strong><small>{integrity.issuerSignatureVerified ? `Key ${credential.issuerKeyId}` : "A fingerprint alone does not prove laboratory key control"}</small></div>
          <div><span>Machine access</span><a href={`/api/v1/credentials/${encodeURIComponent(credential.identifier)}`}>Open JSON endpoint ↗</a><small>Includes exact signed payload, signature, reviewed public key, and live verification state</small></div>
        </div>
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
        <p>{integrity.issuerSignatureVerified ? "TEC confirms that the canonical payload matched the reviewed issuer key when this version was accepted and preserves its registry history." : "This legacy record has a registry fingerprint but no verified laboratory signature; attribution therefore relies on the registry account record."} TEC does not replace representative sampling, method suitability, accreditation, regulatory review, or expert interpretation.</p>
      </section>
      <ProductFooter />
    </main>
  );
}
