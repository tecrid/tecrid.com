import {ProtectedResults} from "./protected-results";
import {sampleLabReference, sampleLabReports} from "../../lib/sample-lab";
import {ProductNav,ProductFooter} from "../site-nav";

function date(value:string){return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"});}
export function SampleLabReferencePage({identifier}:{identifier:string}){
 const record=sampleLabReference(identifier)!;
 const detail=record.reportDetails;
 const related=sampleLabReports.filter(r=>r.lotNumber===record.lotNumber&&r.reportNumber!==record.reportNumber);
 return <main className="product-page public-record-page kas-report-page"><ProductNav compact/>
  <header className="record-page-hero"><div><p className="section-kicker light">TEST DIGITAL CARD · ACTUAL SOURCE REPORT</p><h1>{record.testIdentifier}</h1><p>Light Labs report {record.reportNumber} · {detail.assay} · released {date(record.releasedAt)}</p></div><span className="public-unverified">TEST · approval pending</span></header>
  <section className="public-record-shell">
   <div className="kas-test-notice"><strong>Actual report. TEST digital card.</strong><p>This TECRID resolves to a digital card built from the original Light Labs report for Kasandrinos. Light Labs has not approved or signed this TECRID. No production credential or lot qualification has been issued.</p></div>
   <div className="public-record-summary">
    <article><span>Sample as reported</span><strong>{record.sampleName}</strong><small>Prepared for {detail.customer}</small></article>
    <article><span>Lot as reported</span><strong>{record.lotNumber}</strong><small>SKU and separate sample ID not stated in the source</small></article>
    <article><span>Assay</span><strong>{detail.assay}</strong><small>{detail.analytes.length} analyte{detail.analytes.length===1?"":"s"} listed in the source</small></article>
   </div>
   <div className="sample-timeline-grid" aria-label="Original report timeline">
    <div><span>Received</span><strong>{date(detail.receivedAt)}</strong></div><div><span>Tested</span><strong>{date(record.testedAt)}</strong></div><div><span>Report released</span><strong>{date(record.releasedAt)}</strong></div><div><span>Production TECRID issued</span><strong>Not issued</strong></div>
   </div>
   <div className="public-record-summary">
    <article><span>Source laboratory</span><strong><a href={record.sourceProfileUrl}>Light Labs ↗</a></strong><small>TEST profile · TECRID authority pending</small></article>
    <article><span>Laboratory references</span><strong>Report / test {record.reportNumber}</strong><small>Order {detail.orderNumber} · {detail.location}</small></article>
    <article><span>Method as printed</span><strong>{detail.method}</strong><small>Reported serving size: {detail.servingSize}</small></article>
   </div>
   <ProtectedResults identifier={record.testIdentifier} analytes={detail.analytes}/>
   <section className="source-document-register kas-source-register" aria-label="Original report and provenance">
    <div><span>Original certificate of analysis</span><strong><a href="#report-panel-title">Open digital TECRID card ↑</a></strong><small>{detail.sourcePageCount} page · {(detail.sourceBytes/1024).toFixed(0)} KB · unchanged PDF</small><small>{record.sourceFilename}</small></div>
    <div><span>Original PDF fingerprint</span><code>sha256:{record.sourceSha256}</code><small>Exact bytes checked during private import. A matching fingerprint is not a laboratory signature.</small></div>
    <div><span>Digital card access</span><strong>Authorized work-email access</strong><small>Sign in to TECRID to request access. The card service checks your verified email and Kasandrinos permission on every request. Approving a card does not release the original PDF.</small></div>
   </section>
   <div className="provenance-register">
    <div><span>Prepared for</span><strong><a href={record.controllerProfileUrl}>Kasandrinos · TEST profile ↗</a></strong><small>TEST access managed by the Kasandrinos VLE team</small></div>
    <div><span>Source-report approval</span><strong>Lab Director section in original PDF</strong><small>Historical report approval is separate from approval of this TECRID.</small></div>
    <div><span>TECRID issuer proof</span><strong>Not signed by Light Labs</strong><small>Production authority: none · test transport proofs are not issuer signatures</small></div>
    <div><span>Machine-readable reference</span><a href={record.jsonUrl}>Open JSON reference ↗</a><small>TEST status, report metadata and gated digital card link; no analytical values</small></div>
   </div>
  </section>
  <section className="version-register"><div className="section-title-row"><div><p className="section-kicker">Source and registry status</p><h2>Report history, without implied issuance.</h2></div></div><ol><li><span>Source</span><div><strong>Original report released</strong><p>{date(record.releasedAt)} · report {record.reportNumber}, order {detail.orderNumber}. Source revision number is not stated.</p></div></li><li><span>TEST</span><div><strong>Original imported into private storage</strong><p>22 October 2026 · exact source fingerprint preserved. This test view does not create a signed credential version.</p></div></li><li><span>Pending</span><div><strong>Light Labs approval and signing</strong><p>Production issuance remains blocked. No issuance date or verified issuer signature is asserted.</p></div></li></ol></section>
  <section className="record-boundary"><p className="section-kicker">Related evidence</p><h2>More reports for lot {record.lotNumber}.</h2><div className="kas-related-reports">{related.map(r=><a key={r.reportNumber} href={`/records/${encodeURIComponent(r.testIdentifier)}`}>Report {r.reportNumber} · TEST →</a>)}</div><p><a href="https://vle.exchange/suppliers/kasandrinos#tecrid-test-reports">View Kasandrinos on VLE ↗</a> · <a href="/sample-lab">All eight test reports →</a></p><p>Source metadata is transcribed for integration testing and remains subject to laboratory review. This page does not establish product safety, accreditation scope, certification or VLE qualification.</p></section>
  <ProductFooter/>
 </main>;
}
