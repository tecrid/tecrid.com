import type { Metadata } from "next";
import { ProductFooter, ProductNav } from "../site-nav";

export const metadata: Metadata = {
  title: "Demonstration record — TEC Registry",
  description: "A clearly labeled interface demonstration showing how a public TECRID resolves.",
  robots: { index: false, follow: true },
  openGraph: { images: [] },
  twitter: { images: [] },
};

const results = [
  ["Pb", "Lead", "42", "µg/kg", "10"],
  ["Cd", "Cadmium", "312", "µg/kg", "10"],
  ["As", "Arsenic", "< 10", "µg/kg", "10"],
  ["Hg", "Mercury", "< 5", "µg/kg", "5"],
];

export default function DemoRecordPage() {
  return (
    <main className="product-page public-record-page">
      <ProductNav compact />
      <header className="record-page-hero">
        <div>
          <p className="section-kicker light">Interface demonstration · not a public TEC</p>
          <h1>TECRID·GLP-26-7F3A92</h1>
          <p>Fictional data · no laboratory issuance, registry entry, or live signature</p>
        </div>
        <span className="public-unverified"><i /> Demonstration only</span>
      </header>

      <section className="public-record-shell">
        <div className="record-integrity-bar"><span>Not registered · no integrity proof asserted</span><span>Status: example</span></div>
        <div className="public-record-summary">
          <article><span>Sample</span><strong>Organic cacao powder</strong><small>Fictional lot C-240518</small></article>
          <article><span>Example issuer</span><strong>Greenleaf Analytical</strong><small>Fictional demonstration laboratory</small></article>
          <article><span>Method family</span><strong>ICP-MS</strong><small>Illustrative interface content</small></article>
        </div>
        <div className="public-results">
          <div className="results-note"><span>Illustrative contaminant panel</span><small>Values are not evidence and must not be cited</small></div>
          <table>
            <thead><tr><th>Analyte</th><th>Result</th><th>Unit</th><th>LOQ</th><th>Status</th></tr></thead>
            <tbody>{results.map(([symbol, analyte, value, unit, loq]) => (
              <tr key={symbol}>
                <td><i className="element-badge">{symbol}</i><strong>{analyte}</strong></td>
                <td className="result-value">{value}</td><td>{unit}</td><td>{loq}</td><td>Example</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="provenance-register">
          <div><span>Issuer identity</span><strong>Not registered</strong><small>The laboratory name is fictional.</small></div>
          <div><span>Record fingerprint</span><code>Not recorded</code><small>No canonical payload exists in the live registry.</small></div>
          <div><span>Issuer proof</span><strong>Not present</strong><small>No signature or key-control claim is made.</small></div>
          <div><span>Machine access</span><strong>Not available</strong><small>Real public TECRIDs expose a JSON representation.</small></div>
        </div>
      </section>

      <section className="record-boundary">
        <p className="section-kicker">Demonstration boundary</p>
        <h2>A realistic interface must not become a counterfeit claim.</h2>
        <p>This page exists only to show the resolution experience. It is deliberately excluded from search indexing and the live credential API. A real record will display its current status, reviewed issuer, verified proof state, fingerprint, and append-only versions.</p>
      </section>
      <ProductFooter />
    </main>
  );
}
