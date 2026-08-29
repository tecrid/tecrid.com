import type { DemoRecord } from "../../lib/demo-records";
import { demoLaboratory } from "../../lib/demo-records";
import { ProductFooter, ProductNav } from "../site-nav";

export function DemoRecordPage({ record }: { record: DemoRecord }) {
  const resolverSample = record.slug === "heavy-metals";
  return (
    <main className="product-page public-record-page demo-record-page">
      <ProductNav compact />
      <header className="record-page-hero">
        <div><p className="section-kicker light">{resolverSample ? "Source dataset · reserved resolver sample" : "Demonstration finding · not a production TEC"}</p><h1>{record.demoId}</h1><p>Invented data · fictional issuer · no production authority</p></div>
        <span className="public-unverified"><i /> Demonstration only</span>
      </header>

      <section className="public-record-shell demo-record-shell">
        <div className="record-integrity-bar"><span>{resolverSample ? "Bound to the reserved sample record; no issuer signature asserted" : "No registry fingerprint or issuer signature asserted"}</span><span>Status: fictional</span></div>
        <div className="public-record-summary">
          <article><span>Sample</span><strong>{record.sample}</strong><small>{record.lot}</small></article>
          <article><span>Example laboratory</span><strong><a href="/demo/lab">{demoLaboratory.name} ↗</a></strong><small>{demoLaboratory.status}</small></article>
          <article><span>Method</span><strong>{record.method}</strong><small>{record.matrix}</small></article>
        </div>
        {record.declaration ? <div className="demo-evidence-chain"><div><span>Supplier representation</span><strong>{record.declaration}</strong></div><div><span>Illustrative custody</span><strong>{record.custody}</strong></div></div> : null}
        <div className="demo-finding"><span>Demonstration finding</span><h2>{record.finding}</h2><p>{record.findingDetail}</p></div>
        <div className="public-results">
          <div className="results-note"><span>{record.results.length} illustrative results</span><small>Every value is invented</small></div>
          <table>
            <thead><tr><th>Analyte / marker</th><th>Result</th><th>Unit</th><th>LOQ / context</th><th>Demonstration interpretation</th></tr></thead>
            <tbody>{record.results.map((row) => (
              <tr key={row.analyte}>
                <td><i className="element-badge">{row.symbol}</i><strong>{row.analyte}</strong></td>
                <td className="result-value">{row.result}</td><td>{row.unit}</td><td>{row.loq || row.method || "Illustrative profile"}</td><td><span className="demo-result-status">{row.interpretation}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {record.source ? <div className="demo-source"><span>Real-world reference for the demonstration pattern</span><a href={record.source.href} target="_blank" rel="noreferrer">{record.source.label} ↗</a><p>{record.source.detail}</p></div> : null}
      </section>

      <section className="record-boundary">
        <p className="section-kicker">Demonstration boundary</p><h2>Useful as an interface example. Worthless as evidence.</h2><p>{resolverSample ? "This fictional dataset is mirrored by a TECRID in the reserved DEMO namespace, but it has no verified issuer or production authority." : "This page is not resolvable through the TECRID API and does not represent laboratory work."} It cannot be cited as a finding, certificate, safety assessment, authenticity decision, or supplier allegation.</p>
      </section>
      <ProductFooter />
    </main>
  );
}
