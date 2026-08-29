"use client";

import { useState } from "react";
import { SAMPLE_TECRID } from "../lib/sample-tecrid";
import { ProductFooter, ProductNav } from "./site-nav";

const results = [
  { analyte: "Lead", symbol: "Pb", result: "42", unit: "µg/kg", loq: "10" },
  { analyte: "Cadmium", symbol: "Cd", result: "312", unit: "µg/kg", loq: "10" },
  { analyte: "Arsenic", symbol: "As", result: "< 10", unit: "µg/kg", loq: "10" },
  { analyte: "Mercury", symbol: "Hg", result: "< 5", unit: "µg/kg", loq: "5" },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "results" | "provenance">("results");
  const [copied, setCopied] = useState(false);

  function lookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = query.trim().toUpperCase();
    const normalized = raw.replace(/^TECRID[:-]/, "TECRID·").replace(/^TEC[:-]/, "TECRID·");
    if (!normalized) return setMessage("Enter a TECRID to look up a record.");
    const identifier = normalized.startsWith("TECRID·") ? normalized : `TECRID·${normalized}`;
    setMessage("Looking up the canonical registry record…");
    window.location.href = `/records/${encodeURIComponent(identifier)}`;
  }

  async function copyTecrid() {
    await navigator.clipboard?.writeText(SAMPLE_TECRID);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main>
      <ProductNav />

      <section className="hero" id="top">
        <div className="eyebrow"><span /> An open initiative of the Institute of Contaminant Standards</div>
        <h1>Lab results that<br />speak for themselves.</h1>
        <p className="hero-copy">
          A <strong>TECRID</strong>—Test Evidence Credential Record Identifier—is a persistent identifier and verification record for laboratory reports. It connects structured test evidence to the laboratory that issued it, its current status, and its version history.
        </p>
        <p className="hero-context">Verifiable laboratory reports · Certificate of Analysis authentication · Contaminant testing records · Secure evidence sharing</p>

        <form className="lookup" onSubmit={lookup}>
          <label htmlFor="tec-lookup">Look up a TECRID</label>
          <div className="lookup-row">
            <input id="tec-lookup" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="TECRID·LAB-00-000000" aria-describedby="lookup-message" autoComplete="off" />
            <button type="submit">View record <span aria-hidden="true">↗</span></button>
          </div>
          <p id="lookup-message" className="lookup-message" aria-live="polite">
            {message || <>See the complete resolution experience. <button type="button" onClick={() => { setQuery(SAMPLE_TECRID); setMessage(`Sample loaded: ${SAMPLE_TECRID}. Select View record.`); }}>Try the sample TECRID</button></>}
          </p>
        </form>

        <div className="hero-proof" aria-label="TECRID principles"><span>Issuer signature required</span><i /><span>Versions preserved</span><i /><span>Visibility controlled</span></div>
      </section>

      <section className="protocol-section home-protocol" id="how-it-works" aria-labelledby="protocol-title">
        <div className="protocol-intro">
          <p className="section-kicker light">How a TECRID works</p>
          <h2 id="protocol-title">The source travels<br />with the result.</h2>
          <p>The laboratory creates the signed evidence record. TECRID verifies and preserves it. Authorized recipients resolve the same source instead of reconciling separate PDFs.</p>
          <a className="text-link-light" href="/what-is-a-tecrid">What is a TECRID? →</a>
        </div>
        <ol className="steps">
          <li><span>01</span><div><strong>The laboratory issues</strong><p>Results, methods, sample identifiers, dates, units, and source-document fingerprints are recorded directly from the issuing laboratory.</p></div></li>
          <li><span>02</span><div><strong>The registry verifies</strong><p>The API verifies the laboratory’s Ed25519 signature against its reviewed key, assigns the TECRID, and preserves the version fingerprint.</p></div></li>
          <li><span>03</span><div><strong>The evidence resolves</strong><p>Brands, certifiers, retailers, regulators, and the public see only the record and fields they are authorized to receive.</p></div></li>
        </ol>
      </section>

      <section className="home-audience-section" aria-labelledby="audience-title">
        <div className="home-audience-intro"><p className="section-kicker">Who TECRID serves</p><h2 id="audience-title">One evidence layer.<br />Four different jobs.</h2><p>TECRID reduces repeated document handling without pretending that every participant needs the same view or authority.</p></div>
        <div className="home-audience-grid">
          <a href="/for-laboratories"><span>Laboratories</span><h3>Issue once. Verify without phone calls.</h3><p>Add a TECRID to the final report, route results to the customer workspace, and preserve corrections.</p><strong>For laboratories →</strong></a>
          <a href="/for-brands"><span>Brands &amp; suppliers</span><h3>Replace scattered COAs with a governed portfolio.</h3><p>Organize laboratory evidence by SKU and lot, review trends, and control who receives private findings.</p><strong>For brands →</strong></a>
          <a href="/for-certifiers-retailers"><span>Certifiers &amp; retailers</span><h3>Receive validated identifiers, not folders of PDFs.</h3><p>Request scoped evidence and automate intake without OCR or manual document reconciliation.</p><strong>For evidence recipients →</strong></a>
          <a href="/developers"><span>Technology teams</span><h3>Connect LIMS, portals, and procurement systems.</h3><p>Canonicalize, sign, issue, resolve, route, and monitor evidence through the implemented API.</p><strong>Build with TECRID →</strong></a>
        </div>
      </section>

      <section className="record-section" id="record" aria-labelledby="record-title">
        <div className="section-title-row"><div><p className="section-kicker">Working resolver sample · fictional data</p><h2 id="record-title">Enter an ID. Resolve its source.</h2></div><span className="verified-pill demo-pill"><i /> Demonstration only</span></div>
        <article className="record-card">
          <header className="record-header"><div><p className="record-label">TECRID sample identifier</p><div className="identifier-row"><h3>{SAMPLE_TECRID}</h3><button type="button" className="copy-button" onClick={copyTecrid} aria-label="Copy demonstration TECRID">{copied ? "Copied" : "Copy demo ID"}</button></div></div><div className="seal demo-seal" aria-label="Resolver sample"><span>TEC</span><strong>·</strong><small>SAMPLE</small></div></header>
          <div className="record-summary"><div><span>Sample</span><strong>Cocoa powder, retail composite</strong><small>Fictional lot DEMO-CP-0826</small></div><div><span>Example issuer</span><strong>Northstar Laboratory Demonstration</strong><small>Not a registered laboratory</small></div><div><span>Record state</span><strong>Sample namespace</strong><small>No production authority</small></div></div>
          <div className="record-body">
            <div className="record-tabs" role="tablist" aria-label="Sample record sections">{(["overview", "results", "provenance"] as const).map((tab) => <button type="button" role="tab" key={tab} aria-selected={activeTab === tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}</div>
            <div className="tab-panel" role="tabpanel">
              {activeTab === "overview" ? <div className="overview-grid"><div><span>SKU</span><strong>ATL-COCOA-340</strong></div><div><span>Lot</span><strong>DEMO-CP-0826</strong></div><div><span>Received</span><strong>21 August 2026</strong></div><div><span>Released</span><strong>23 August 2026</strong></div><div><span>Method family</span><strong>ICP-MS</strong></div><div><span>Authority</span><strong>Sample only</strong></div></div> : null}
              {activeTab === "results" ? <div className="results-wrap"><div className="results-note"><span>Contaminant panel</span><small>Illustrative prototype data · Values shown as issued</small></div><table><thead><tr><th>Analyte</th><th>Result</th><th>Unit</th><th>LOQ</th><th>Lab status</th></tr></thead><tbody>{results.map((row) => <tr key={row.symbol}><td><i className="element-badge">{row.symbol}</i><strong>{row.analyte}</strong></td><td className="result-value">{row.result}</td><td>{row.unit}</td><td>{row.loq} µg/kg</td><td><span className="reported">Reported</span></td></tr>)}</tbody></table></div> : null}
              {activeTab === "provenance" ? <div className="provenance-grid"><div className="signature-block sample-signature-block"><span className="signature-icon">i</span><div><strong>No live signature asserted</strong><small>This reserved sample demonstrates resolution without representing laboratory authority.</small></div></div><dl><div><dt>Issuer</dt><dd>Fictional demonstration lab</dd></div><div><dt>Fingerprint</dt><dd>Sample payload only</dd></div><div><dt>Visibility</dt><dd>Public demonstration</dd></div><div><dt>Version history</dt><dd>Illustrative version 1</dd></div></dl></div> : null}
            </div>
            <footer className="record-footer"><span><i /> Resolver-compatible sample</span><a href={`/records/${encodeURIComponent(SAMPLE_TECRID)}`}>Open the complete sample record ↗</a></footer>
          </div>
        </article>
      </section>

      <section className="boundary-section" aria-labelledby="boundary-title">
        <div><p className="section-kicker">Trust boundaries</p><h2 id="boundary-title">What TECRID proves—and what it does not.</h2><a className="boundary-evidence-link" href="/why">Read the documented case for TECRID →</a></div>
        <div className="boundary-grid"><article><span>TECRID authenticates</span><p>Which registered laboratory signed a record, what that record contained at issuance, its current status, and its visible amendment history.</p></article><article><span>TECRID controls disclosure</span><p>A record may be private, recipient-controlled, or public. A TECRID cannot be compelled into public visibility by another participant.</p></article><article><span>TECRID does not certify safety</span><p>It does not replace accreditation, representative sampling, sound analytical methods, regulatory judgment, or expert interpretation.</p></article></div>
      </section>

      <section className="cta-section founding-pilot-cta">
        <div><p className="section-kicker light">Founding laboratory pilot</p><h2>Help make laboratory evidence easier to trust and reuse.</h2><p>Verification and the controlled pilot are free. Public issuance begins only after identity, scope, key-control, and conformance gates pass.</p></div>
        <div className="pilot-cta-actions"><a href="/laboratory-pilot">Review pilot requirements <span aria-hidden="true">↗</span></a><a href="/join?role=laboratory">Create a laboratory workspace <span aria-hidden="true">↗</span></a></div>
      </section>

      <ProductFooter />
    </main>
  );
}
