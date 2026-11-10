import { publicCopy } from "../blue-atlas/copy";
import { PublicPage, PageHero } from "../blue-atlas/public-page";
import type { DemoRecord } from "../../lib/demo-records";
import { demoLaboratory } from "../../lib/demo-records";

export function DemoRecordPage({ record }: { record: DemoRecord }) {
  const resolverSample = record.slug === "heavy-metals";
  return (
    <PublicPage className="atlas-public-record-page atlas-demo-record-page">

      <PageHero className="atlas-record-page-hero">
        <div><p className="atlas-kicker">{resolverSample ? "Source dataset · reserved resolver sample" : "Demonstration finding · not a production Test Evidence Credential"}</p><h1>{record.demoId}</h1><p>Invented data · fictional issuer · no production authority</p></div>
        <span className="atlas-public-unverified"><i /> Demonstration only</span>
      </PageHero>

      <section className="atlas-public-record-shell atlas-demo-record-shell">
        <div className="atlas-record-integrity-bar"><span>{resolverSample ? "Bound to the reserved sample record; no issuer signature asserted" : "No record fingerprint or issuer signature asserted"}</span><span>Status: fictional</span></div>
        <div className="atlas-public-record-summary">
          <article><span>Sample</span><strong>{publicCopy(record.sample)}</strong><small>{record.lot}</small></article>
          <article><span>Example laboratory</span><strong><a href="/demo/lab">{demoLaboratory.name} ↗</a></strong><small>{demoLaboratory.status}</small></article>
          <article><span>Method</span><strong>{publicCopy(record.method)}</strong><small>{record.matrix}</small></article>
        </div>
        {record.declaration ? <div className="atlas-demo-evidence-chain"><div><span>Supplier representation</span><strong>{record.declaration}</strong></div><div><span>Illustrative custody</span><strong>{record.custody}</strong></div></div> : null}
        <div className="atlas-demo-finding"><span>Demonstration finding</span><h2>{record.finding}</h2><p>{record.findingDetail}</p></div>
        <div className="atlas-public-results">
          <div className="atlas-results-note"><span>{record.results.length} illustrative results</span><small>Every value is invented</small></div>
          <table>
            <thead><tr><th>Analyte / marker</th><th>Result</th><th>Unit</th><th>LOQ / context</th><th>Demonstration interpretation</th></tr></thead>
            <tbody>{record.results.map((row) => (
              <tr key={row.analyte}>
                <td><i className="atlas-element-badge">{row.symbol}</i><strong>{row.analyte}</strong></td>
                <td className="atlas-result-value">{row.result}</td><td>{row.unit}</td><td>{row.loq || row.method || "Illustrative profile"}</td><td><span className="atlas-demo-result-status">{row.interpretation}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {record.source ? <div className="atlas-demo-source"><span>Real-world reference for the demonstration pattern</span><a href={record.source.href} target="_blank" rel="noreferrer">{record.source.label} ↗</a><p>{record.source.detail}</p></div> : null}
      </section>

      <section className="atlas-record-boundary">
        <p className="atlas-kicker">Demonstration boundary</p><h2>Useful as an interface example. Worthless as evidence.</h2><p>{resolverSample ? "This fictional dataset is mirrored by a TECRID in the reserved DEMO namespace, but it has no verified issuer or production authority." : "This page is not resolvable through the TECRID API and does not represent laboratory work."} It cannot be cited as a finding, certificate, safety assessment, authenticity decision, or supplier allegation.</p>
      </section>

    </PublicPage>
  );
}
