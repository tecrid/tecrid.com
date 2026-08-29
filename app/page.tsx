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

  async function copyTec() {
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
          The neutral trust layer between laboratories, suppliers, brands, retailers, and the public—giving laboratory evidence a permanent record anyone can resolve.
        </p>

        <form className="lookup" onSubmit={lookup}>
          <label htmlFor="tec-lookup">Look up a TECRID</label>
          <div className="lookup-row">
            <input
              id="tec-lookup"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="TECRID·LAB-00-000000"
              aria-describedby="lookup-message"
              autoComplete="off"
            />
            <button type="submit">View record <span aria-hidden="true">↗</span></button>
          </div>
          <p id="lookup-message" className="lookup-message" aria-live="polite">
            {message || <>Permanent, public, and versioned. <button type="button" onClick={() => { setQuery(SAMPLE_TECRID); setMessage(`Sample loaded: ${SAMPLE_TECRID}. Select View record.`); }}>Try the sample TECRID</button></>}
          </p>
        </form>

        <div className="hero-proof" aria-label="TEC principles">
          <span>Issuer signature required</span><i />
          <span>Versions preserved</span><i />
          <span>Status publicly resolvable</span>
        </div>
      </section>

      <section className="definition" aria-labelledby="definition-title">
        <p className="section-kicker">The evidence identifier</p>
        <div>
          <h2 id="definition-title"><span>T</span>est <span>E</span>vidence <span>C</span>redential</h2>
          <p>
            A TEC is the structured evidence credential. Its permanent TEC Record Identifier—TECRID—resolves to the canonical record, current status, and complete version history.
          </p>
        </div>
      </section>

      <section className="legacy-entry-section" aria-labelledby="legacy-entry-title">
        <div>
          <p className="section-kicker light">Already have a laboratory PDF?</p>
          <h2 id="legacy-entry-title">Preserve it privately.<br />Send trust back to the laboratory.</h2>
        </div>
        <div>
          <p>TECRID fingerprints the original file, records the brand’s transcription, and creates a restricted laboratory confirmation gate. Submission alone never creates a public credential.</p>
          <a className="button-mint" href="/submit-report">Start legacy-report intake <span>→</span></a>
        </div>
      </section>

      <section className="record-section" id="record" aria-labelledby="record-title">
        <div className="section-title-row">
          <div>
          <p className="section-kicker">Resolver sample · fictional data</p>
            <h2 id="record-title">One result. One source of truth.</h2>
          </div>
          <span className="verified-pill demo-pill"><i /> Demonstration only</span>
        </div>

        <article className="record-card">
          <header className="record-header">
            <div>
              <p className="record-label">TEC Record Identifier</p>
              <div className="identifier-row">
                <h3>{SAMPLE_TECRID}</h3>
                <button type="button" className="copy-button" onClick={copyTec} aria-label="Copy demonstration ID">
                  {copied ? "Copied" : "Copy demo ID"}
                </button>
              </div>
            </div>
            <div className="seal demo-seal" aria-label="Resolver sample"><span>TEC</span><strong>·</strong><small>SAMPLE</small></div>
          </header>

          <div className="record-summary">
            <div><span>Sample</span><strong>Cocoa powder, retail composite</strong><small>Fictional lot DEMO-CP-0826</small></div>
            <div><span>Example issuer</span><strong>Northstar Laboratory Demonstration</strong><small>Fictional demonstration laboratory</small></div>
            <div><span>Example state</span><strong>Version 1</strong><small>Public sample namespace</small></div>
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
                    <div><span>Submitting party</span><strong>Demonstration only</strong></div>
                    <div><span>Record status</span><strong className="status-text">● Example</strong></div>
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
                    <div><strong>No live signature asserted</strong><small>A real issued TEC must verify against the reviewed issuer key</small></div>
                  </div>
                  <dl>
                    <div><dt>Issuer ID</dt><dd>DEMO-NLA</dd></div>
                    <div><dt>Credential</dt><dd>Illustrative</dd></div>
                    <div><dt>Record fingerprint</dt><dd>Not registered</dd></div>
                    <div><dt>Revision history</dt><dd>Example version state</dd></div>
                  </dl>
                </div>
              )}
            </div>

            <footer className="record-footer">
              <span><i /> Resolver-compatible sample</span>
              <a href={`/records/${encodeURIComponent(SAMPLE_TECRID)}`}>Open the full public record ↗</a>
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
          <li><span>02</span><div><strong>The registry verifies and records</strong><p>The API checks the laboratory’s Ed25519 signature against its reviewed public key, records the version fingerprint, and assigns a TECRID.</p></div></li>
          <li><span>03</span><div><strong>Anyone can resolve it</strong><p>Brands share a link or TECRID. Buyers and auditors see the current status, issued values, issuer scope, and append-only version history.</p></div></li>
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
        <a href="/join">Join the registry <span aria-hidden="true">↗</span></a>
      </section>

      <ProductFooter />
    </main>
  );
}
