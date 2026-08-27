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
      title: "TEC record not found",
      description: "No public Test Evidence Credential was found for this identifier.",
      openGraph: { title: "TEC record not found", description: "No public Test Evidence Credential was found for this identifier.", images: [] },
      twitter: { title: "TEC record not found", description: "No public Test Evidence Credential was found for this identifier.", images: [] },
    };
  }
  const title = `${record.credential.identifier} — ${record.credential.sampleName}`;
  const description = `Lab-issued analytical evidence from ${record.issuer.name}, version ${record.credential.version}.`;
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
  const { credential, issuer, results } = record;

  return (
    <main className="product-page public-record-page">
      <ProductNav compact />
      <header className="record-page-hero">
        <div>
          <p className="section-kicker light">Public Test Evidence Credential</p>
          <h1>{credential.identifier}</h1>
          <p>Canonical version {credential.version} · issued {credential.issuedAt ? new Date(credential.issuedAt).toLocaleString("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) : "—"} UTC</p>
        </div>
        <span className="public-verified"><i /> Issuer verified</span>
      </header>

      <section className="public-record-shell">
        <div className="record-integrity-bar"><span><i /> Registry integrity check passed</span><span>Status: {credential.status}</span></div>
        <div className="public-record-summary">
          <article><span>Sample</span><strong>{credential.sampleName}</strong><small>{credential.lotNumber || "No lot supplied"}</small></article>
          <article><span>Issued by</span><strong>{issuer.name}</strong><small>{issuer.issuerCode} · {issuer.issuerStatus}</small></article>
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
                <td><span className="reported">Reported</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="provenance-register">
          <div><span>Issuer identity</span><strong>{issuer.name}</strong><small>TEC issuer code {issuer.issuerCode}</small></div>
          <div><span>Record fingerprint</span><code>sha256:{credential.fingerprint}</code><small>Fingerprint of the canonical issued payload</small></div>
          <div><span>Revision history</span><strong>Original issuance</strong><small>No amendments recorded</small></div>
          <div><span>Machine access</span><a href={`/api/v1/credentials/${encodeURIComponent(credential.identifier)}`}>Open JSON endpoint ↗</a><small>Public API representation</small></div>
        </div>
      </section>

      <section className="record-boundary">
        <p className="section-kicker">Interpretation boundary</p>
        <h2>This record proves provenance, not product safety.</h2>
        <p>TEC confirms which registered laboratory issued these values and whether the record changed. It does not replace representative sampling, method suitability, accreditation, regulatory review, or expert interpretation.</p>
      </section>
      <ProductFooter />
    </main>
  );
}
