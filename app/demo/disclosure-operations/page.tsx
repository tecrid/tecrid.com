import type { Metadata } from "next";
import { ProductFooter, ProductNav } from "../../site-nav";

export const metadata: Metadata = {
  title: "Disclosure operations demonstration — TEC Registry",
  description: "A fictional end-to-end demonstration of production-aggregate validation and disclosure reuse.",
  robots: { index: false, follow: true },
};

const outputs = [
  ["Brand disclosure", "A searchable batch page on a stable URL"],
  ["QR destination", "The same canonical record from product packaging"],
  ["Retailer data", "Structured JSON instead of PDF transcription"],
  ["Regulatory retention", "A visible shelf-life-plus-one-month clock"],
  ["Evidence handoff", "A direct laboratory-confirmation path to TECRID"],
];

export default function DisclosureOperationsDemoPage() {
  return (
    <main className="product-page disclosure-demo-page">
      <ProductNav compact />
      <header className="product-hero disclosure-demo-hero">
        <p className="section-kicker light">Fictional operations demonstration</p>
        <h1>One laboratory file.<br />Five reusable surfaces.</h1>
        <p>See how a regulated brand can turn production-aggregate results into validated public disclosure without copying values into a website, QR system, retailer portal, and retention spreadsheet separately.</p>
        <div className="draft-standard-badge"><i /> Fictional brand · invented results · no compliance conclusion</div>
      </header>

      <section className="disclosure-demo-shell">
        <div className="disclosure-demo-boundary"><strong>This demonstrates workflow, not evidence.</strong><p>Harbor &amp; Bloom Baby Foods, its laboratory, products, reports, hashes, and values are invented. No laboratory confirmation or TECRID is asserted.</p></div>

        <div className="disclosure-demo-summary">
          <article><span>Source file</span><strong>1</strong><small>Monthly laboratory CSV</small></article>
          <article><span>Production aggregates</span><strong>12</strong><small>48 required metal results</small></article>
          <article><span>Ready</span><strong>11</strong><small>Complete provenance and analytes</small></article>
          <article className="blocked"><span>Blocked</span><strong>1</strong><small>Mercury result missing</small></article>
        </div>

        <section className="disclosure-demo-workbench">
          <div className="disclosure-demo-source">
            <p className="section-kicker">Input</p><h2>August production aggregates.csv</h2>
            <dl><div><dt>File fingerprint</dt><dd><code>51ad92c3…8f110a</code></dd></div><div><dt>Rows</dt><dd>12</dd></div><div><dt>Required columns</dt><dd>17 / 17</dd></div><div><dt>Imported by</dt><dd>Harbor &amp; Bloom quality team</dd></div></dl>
          </div>
          <div className="disclosure-demo-gate">
            <p className="section-kicker light">Validation gate</p><h2>Nothing incomplete publishes.</h2>
            <div className="demo-gate-checks"><span>✓ Product + UPC</span><span>✓ Batch + dates</span><span>✓ Laboratory + report</span><span>✓ Source SHA-256</span><span>✓ Lead, cadmium, arsenic</span><span className="failed">× Mercury · row 9</span></div>
          </div>
        </section>

        <section className="disclosure-demo-queue">
          <div className="disclosure-panel-heading"><div><p className="section-kicker">Exception-driven review</p><h2>People review the exception, not every cell.</h2></div><span>11 ready · 1 blocked</span></div>
          <div className="demo-queue-row ready"><span>Ready</span><div><strong>Pear &amp; Oat Purée</strong><small>HB-PO-01 · PO-2026-0821</small></div><div><strong>4 / 4 metals</strong><small>Report NS-260821-04</small></div><button type="button">Publish disclosure</button></div>
          <div className="demo-queue-row blocked"><span>Blocked</span><div><strong>Carrot &amp; Sweet Potato</strong><small>HB-CS-02 · CS-2026-0822</small></div><div><strong>Mercury missing</strong><small>Return row 9 to source</small></div><button type="button" disabled>Cannot publish</button></div>
          <p className="demo-action-note">Buttons are illustrative here. The signed-in operator workspace performs the real import and publication gate.</p>
        </section>

        <section className="disclosure-demo-outputs">
          <div><p className="section-kicker light">One approved row becomes</p><h2>Five surfaces, one underlying record.</h2><p>Correct the source once. Every downstream consumer resolves the same version rather than inheriting another copy.</p></div>
          <ol>{outputs.map(([title, description], index) => <li key={title}><span>0{index + 1}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}</ol>
        </section>

        <section className="disclosure-demo-measurement">
          <div><p className="section-kicker">The 10× test</p><h2>Measure duplicate handling eliminated—not prettier pages.</h2></div>
          <div className="disclosure-math"><article><span>Manual model</span><strong>12 × 5 = 60</strong><p>Potential batch-to-surface handling events each month.</p></article><article><span>Registry model</span><strong>12 + 1</strong><p>Twelve validated rows, plus one exception requiring attention.</p></article></div>
          <p className="measurement-boundary">This is workflow math, not a claimed customer result. A pilot should measure preparation time, corrections, publication latency, support contacts, and retailer re-entry before TECRID makes a quantified savings claim.</p>
        </section>

        <section className="disclosure-demo-cta"><div><p className="section-kicker light">Run the real workflow</p><h2>Import your own CSV inside an authenticated organization workspace.</h2><p>Start with the fictional sample. Valid rows persist in D1, exceptions remain attached to their source import, and public brand records stay distinct from laboratory-issued TECRIDs.</p></div><a className="button-mint" href="/dashboard/disclosures">Open operator workspace →</a></section>
      </section>
      <ProductFooter />
    </main>
  );
}
