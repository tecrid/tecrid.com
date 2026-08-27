"use client";

import { useState } from "react";

const SAMPLE_TEC = "TEC·GLP-26-7F3A92";

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
    const normalized = query.trim().toUpperCase().replace("TEC:", "TEC·");
    if (normalized === SAMPLE_TEC || normalized === "GLP-26-7F3A92") {
      setMessage("Certificate found — opening the verified record.");
      document.querySelector("#record")?.scrollIntoView({ behavior: "smooth" });
    } else {
      setMessage("That identifier is not in this prototype. Try TEC·GLP-26-7F3A92");
    }
  }

  async function copyTec() {
    await navigator.clipboard?.writeText(SAMPLE_TEC);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="TEC Network home">
          <span className="brand-mark" aria-hidden="true">T</span>
          <span className="brand-stack"><strong>TEC Network</strong><small>Institute of Contaminant Standards</small></span>
        </a>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="/why">Why TEC</a>
          <a href="#record">Sample record</a>
          <button type="button" className="nav-cta" onClick={() => document.querySelector<HTMLInputElement>("#tec-lookup")?.focus()}>
            Verify a TEC
          </button>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> An open initiative of the Institute of Contaminant Standards</div>
        <h1>Lab results that<br />speak for themselves.</h1>
        <p className="hero-copy">
          TEC turns contaminant reports into persistent, lab-issued digital records—so the data a brand shares is the data the laboratory released.
        </p>

        <form className="lookup" onSubmit={lookup}>
          <label htmlFor="tec-lookup">Verify a TEC identifier</label>
          <div className="lookup-row">
            <input
              id="tec-lookup"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="TEC·LAB-00-000000"
              aria-describedby="lookup-message"
              autoComplete="off"
            />
            <button type="submit">Find record <span aria-hidden="true">↗</span></button>
          </div>
          <p id="lookup-message" className="lookup-message" aria-live="polite">
            {message || <>No PDF. No retyping. <button type="button" onClick={() => setQuery(SAMPLE_TEC)}>Use sample TEC</button></>}
          </p>
        </form>

        <div className="hero-proof" aria-label="TEC principles">
          <span>Lab issued</span><i />
          <span>Tamper evident</span><i />
          <span>Publicly resolvable</span>
        </div>
      </section>

      <section className="definition" aria-labelledby="definition-title">
        <p className="section-kicker">The evidence identifier</p>
        <div>
          <h2 id="definition-title"><span>T</span>est <span>E</span>vidence <span>C</span>redential</h2>
          <p>
            A TEC is a persistent identifier and structured credential for analytical evidence. Like a DOI points to a scholarly work, a TEC resolves to an authoritative lab-issued record.
          </p>
        </div>
      </section>

      <section className="record-section" id="record" aria-labelledby="record-title">
        <div className="section-title-row">
          <div>
            <p className="section-kicker">A resolvable record, not a file</p>
            <h2 id="record-title">One result. One source of truth.</h2>
          </div>
          <span className="verified-pill"><i /> Issuer verified</span>
        </div>

        <article className="record-card">
          <header className="record-header">
            <div>
              <p className="record-label">TEC identifier</p>
              <div className="identifier-row">
                <h3>{SAMPLE_TEC}</h3>
                <button type="button" className="copy-button" onClick={copyTec} aria-label="Copy TEC identifier">
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <div className="seal" aria-label="Authentic lab-issued record"><span>LAB</span><strong>✓</strong><small>ISSUED</small></div>
          </header>

          <div className="record-summary">
            <div><span>Sample</span><strong>Organic cacao powder</strong><small>Lot C-240518</small></div>
            <div><span>Issued by</span><strong>Greenleaf Analytical</strong><small>Accreditation on record</small></div>
            <div><span>Published</span><strong>18 June 2026</strong><small>14:32 UTC · Version 1</small></div>
          </div>

          <div className="record-body">
            <div className="record-tabs" role="tablist" aria-label="Certificate sections">
              {(["overview", "results", "provenance"] as const).map((tab) => (
                <button
                  type="button"
                  role="tab"
                  key={tab}
                  aria-selected={activeTab === tab}
                  className={activeTab === tab ? "active" : ""}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab[0].toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="tab-panel" role="tabpanel">
              {activeTab === "overview" && (
                <div className="overview-grid">
                  <div><span>Matrix</span><strong>Food · Powder</strong></div>
                  <div><span>Received</span><strong>14 June 2026</strong></div>
                  <div><span>Testing window</span><strong>15–17 June 2026</strong></div>
                  <div><span>Method family</span><strong>ICP-MS</strong></div>
                  <div><span>Submitting party</span><strong>Withheld by issuer</strong></div>
                  <div><span>Record status</span><strong className="status-text">● Current</strong></div>
                </div>
              )}

              {activeTab === "results" && (
                <div className="results-wrap">
                  <div className="results-note">
                    <span>Contaminant panel</span>
                    <small>Illustrative prototype data · Values shown as issued</small>
                  </div>
                  <table>
                    <thead><tr><th>Analyte</th><th>Result</th><th>Unit</th><th>LOQ</th><th>Lab status</th></tr></thead>
                    <tbody>
                      {results.map((row) => (
                        <tr key={row.symbol}>
                          <td><i className="element-badge">{row.symbol}</i><strong>{row.analyte}</strong></td>
                          <td className="result-value">{row.result}</td>
                          <td>{row.unit}</td>
                          <td>{row.loq} µg/kg</td>
                          <td><span className="reported">Reported</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "provenance" && (
                <div className="provenance-grid">
                  <div className="signature-block">
                    <span className="signature-icon">✓</span>
                    <div><strong>Digital signature valid</strong><small>Signed by the issuer credential on record</small></div>
                  </div>
                  <dl>
                    <div><dt>Issuer ID</dt><dd>TEC-LAB-GLP</dd></div>
                    <div><dt>Credential</dt><dd>Active</dd></div>
                    <div><dt>Record fingerprint</dt><dd>sha256:8f10…a27e</dd></div>
                    <div><dt>Revision history</dt><dd>Original issuance · no amendments</dd></div>
                  </dl>
                </div>
              )}
            </div>

            <footer className="record-footer">
              <span><i /> Registry integrity check passed</span>
              <span>Machine-readable data available</span>
            </footer>
          </div>
        </article>
      </section>

      <section className="protocol-section" id="how-it-works" aria-labelledby="protocol-title">
        <div className="protocol-intro">
          <p className="section-kicker light">The TEC protocol</p>
          <h2 id="protocol-title">Trust moves upstream<br />to the laboratory.</h2>
          <p>The issuer—not the brand, supplier, or marketplace—creates the canonical digital record.</p>
        </div>
        <ol className="steps">
          <li><span>01</span><div><strong>The lab releases</strong><p>Results, methods, sample context, and units are recorded directly from the laboratory’s system.</p></div></li>
          <li><span>02</span><div><strong>TEC seals the record</strong><p>An authenticated issuer signs a timestamped, tamper-evident version and receives a persistent identifier.</p></div></li>
          <li><span>03</span><div><strong>Anyone can resolve it</strong><p>Brands share a link or TEC. Buyers and auditors see the same authoritative evidence and revision history.</p></div></li>
        </ol>
      </section>

      <section className="why-section" id="why-tec" aria-labelledby="why-title">
        <div className="why-heading">
          <p className="section-kicker">Why TEC</p>
          <h2 id="why-title">A PDF is a picture of evidence.<br />A TEC is evidence with provenance.</h2>
        </div>
        <div className="comparison">
          <div className="compare-card muted">
            <span className="compare-label">The old way</span>
            <h3>Uploaded PDF</h3>
            <ul>
              <li><span>×</span> Detached from the issuing lab</li>
              <li><span>×</span> Easy to edit or selectively crop</li>
              <li><span>×</span> Results trapped in a document</li>
              <li><span>×</span> No visible correction history</li>
            </ul>
          </div>
          <div className="compare-card tec-card">
            <span className="compare-label">The TEC way</span>
            <h3>Lab-issued record</h3>
            <ul>
              <li><span>✓</span> Authenticated issuer identity</li>
              <li><span>✓</span> Tamper-evident data and methods</li>
              <li><span>✓</span> Human- and machine-readable</li>
              <li><span>✓</span> Persistent versions and corrections</li>
            </ul>
          </div>
        </div>
        <a className="evidence-link" href="/why">Read the documented case for TEC <span aria-hidden="true">↗</span></a>
      </section>

      <section className="boundary-section" aria-labelledby="boundary-title">
        <div>
          <p className="section-kicker">Credibility requires boundaries</p>
          <h2 id="boundary-title">What a TEC proves—and what it doesn’t.</h2>
        </div>
        <div className="boundary-grid">
          <article><span>TEC confirms</span><p>Which registered laboratory issued the record, what data it contained at issuance, and whether it has changed.</p></article>
          <article><span>TEC preserves</span><p>The analytical result, units, methods, sample metadata, timestamps, and a visible amendment trail.</p></article>
          <article><span>TEC does not replace</span><p>Accreditation, representative sampling, sound methods, or expert interpretation. Provenance is not the same as product safety.</p></article>
        </div>
      </section>

      <section className="cta-section">
        <div>
          <p className="section-kicker light">Infrastructure for verifiable disclosure</p>
          <h2>Make every contaminant claim resolvable.</h2>
        </div>
        <a href="#record">Explore the sample TEC <span aria-hidden="true">↗</span></a>
      </section>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#top"><span className="brand-mark">T</span><span>TEC Network</span></a>
        <p>Test Evidence Credential · An ICS initiative</p>
        <p>Evidence should travel with its source.</p>
      </footer>
    </main>
  );
}
