import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Why TEC exists — TEC Network",
  description:
    "The documented case for verifiable, machine-readable laboratory evidence—and why the TEC Network is free at the edges.",
};

const sources = [
  {
    date: "2025",
    authority: "UK National Food Crime Unit",
    title: "A national alert about fraud in laboratory certificates",
    detail:
      "The NFCU reported issuing a specific food-crime alert to industry about document fraud in laboratory certificates.",
    href: "https://www.gov.uk/government/publications/fsa-25-12-06-national-food-crime-unit-annual-update/national-food-crime-unit-annual-update",
  },
  {
    date: "$46M",
    authority: "U.S. Department of Justice",
    title: "A testing company admitted a decades-long reporting fraud",
    detail:
      "Customers received reports representing that specified testing had occurred when materially fewer panelists had actually been tested.",
    href: "https://www.justice.gov/usao-sdny/pr/owner-consumer-products-testing-company-pleads-guilty-46-million-fraud-scheme-involving",
  },
  {
    date: "COAs",
    authority: "U.S. Department of Justice",
    title: "A manufacturer created false certificates for adulterated products",
    detail:
      "The prosecuted scheme included omitted fillers, false certifications, and an altered document supplied during an FDA inspection.",
    href: "https://www.justice.gov/usao-nj/pr/owner-dietary-supplement-company-pleads-guilty-multimillion-dollar-scheme-adulterate",
  },
  {
    date: "2024",
    authority: "U.S. Food and Drug Administration",
    title: "Heavy-metal evidence required verification after a recall",
    detail:
      "FDA discussed external testing to verify supplier-reported heavy metals and identified missing sampling and method assurances.",
    href: "https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/austrofood-sas-679052-08092024",
  },
  {
    date: "FAIR",
    authority: "National Institute of Standards and Technology",
    title: "NIST is already piloting digital Certificates of Analysis",
    detail:
      "Its work targets machine-readable certificates that are findable, accessible, interoperable, and reusable.",
    href: "https://www.nist.gov/news-events/news/2022/06/digital-nist-stakeholder-workshop",
  },
];

export default function WhyTec() {
  return (
    <main className="why-page">
      <nav className="nav why-nav" aria-label="Primary navigation">
        <a className="brand" href="/" aria-label="TEC Network home">
          <span className="brand-mark" aria-hidden="true">T</span>
          <span className="brand-stack"><strong>TEC Network</strong><small>Institute of Contaminant Standards</small></span>
        </a>
        <div className="nav-links">
          <a href="#evidence">The evidence</a>
          <a href="#free-network">The free model</a>
          <a className="nav-cta" href="/#record">Verify a TEC</a>
        </div>
      </nav>

      <header className="why-hero">
        <div className="why-hero-copy">
          <p className="eyebrow"><span /> Why TEC exists</p>
          <h1>The result travels.<br />Its provenance should too.</h1>
          <p>
            Laboratory evidence routinely crosses organizational boundaries as a PDF. The documented problem is not simply that a file can be forged. It is that the receiver cannot reliably establish its source, integrity, context, or current status without doing the verification again.
          </p>
        </div>
        <aside className="problem-statement">
          <span>The infrastructure gap</span>
          <blockquote>
            Organizations lack a universal, authoritative way to exchange and verify laboratory evidence after it leaves the issuing laboratory.
          </blockquote>
          <small>TEC Network problem statement · v1.0</small>
        </aside>
      </header>

      <section className="proof-strip" aria-label="Evidence summary">
        <div><strong>Document fraud</strong><span>Officially recognized</span></div>
        <div><strong>COA reliability</strong><span>Recurring enforcement concern</span></div>
        <div><strong>Digital exchange</strong><span>Active standards work</span></div>
        <div><strong>Market demand</strong><span>To be proven by pilots</span></div>
      </section>

      <section className="evidence-section" id="evidence" aria-labelledby="evidence-title">
        <div className="evidence-intro">
          <p className="section-kicker">The documented need</p>
          <h2 id="evidence-title">This is not a hypothetical problem.</h2>
          <p>
            Independent institutions have documented fraudulent certificates, incomplete testing, unreliable supplier evidence, and the need for machine-readable analytical records. No single incident proves a global market—but together they establish a serious, verifiable infrastructure failure.
          </p>
        </div>
        <div className="source-list">
          {sources.map((source) => (
            <a key={source.title} className="source-row" href={source.href} target="_blank" rel="noreferrer">
              <span className="source-date">{source.date}</span>
              <span className="source-copy">
                <small>{source.authority}</small>
                <strong>{source.title}</strong>
                <p>{source.detail}</p>
              </span>
              <span className="source-arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </section>

      <section className="evidence-boundary" aria-labelledby="boundary-evidence-title">
        <div>
          <p className="section-kicker light">Evidence, with discipline</p>
          <h2 id="boundary-evidence-title">What is established—and what remains to prove.</h2>
        </div>
        <div className="claim-matrix">
          <article>
            <span className="claim-status established">Established</span>
            <h3>False and altered laboratory documents exist.</h3>
            <p>Government alerts and prosecutions demonstrate occurrence and potentially severe consequences.</p>
          </article>
          <article>
            <span className="claim-status established">Established</span>
            <h3>Supplier COAs cannot simply be trusted.</h3>
            <p>Quality systems must establish supplier reliability, methods, sampling context, and applicability.</p>
          </article>
          <article>
            <span className="claim-status established">Established</span>
            <h3>Document-based exchange blocks automation.</h3>
            <p>NIST and industry initiatives are already developing structured, machine-readable certificates.</p>
          </article>
          <article>
            <span className="claim-status open">Open question</span>
            <h3>Will buyers require a shared evidence network?</h3>
            <p>TEC must earn that answer through real laboratory, brand, and retailer pilots—not assertion.</p>
          </article>
        </div>
      </section>

      <section className="naming-section" aria-labelledby="naming-title">
        <div>
          <p className="section-kicker">A durable architecture</p>
          <h2 id="naming-title">One mark. Three clear meanings.</h2>
          <p>
            TEC is distinctive enough to own and broad enough to grow. The generic alternatives are crowded; the acronym becomes intuitive through consistent use.
          </p>
        </div>
        <dl className="name-system">
          <div><dt>TEC Network</dt><dd>The open global evidence network</dd></div>
          <div><dt>Test Evidence Credential</dt><dd>The lab-issued digital record</dd></div>
          <div><dt>TEC Registry</dt><dd>The persistent public resolver</dd></div>
          <div><dt>ICS</dt><dd>The standards steward and public-interest home</dd></div>
        </dl>
      </section>

      <section className="free-section" id="free-network" aria-labelledby="free-title">
        <div className="free-intro">
          <p className="section-kicker light">Free at the edges</p>
          <h2 id="free-title">Verification cannot become valuable until it becomes ubiquitous.</h2>
          <p>
            TEC follows a network strategy: remove the tollbooths from participation, then build paid services around the activity the open network creates.
          </p>
        </div>

        <div className="network-orbit" aria-label="TEC Network flywheel">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
          <span className="orbit-node node-labs">Labs issue</span>
          <span className="orbit-node node-brands">Brands share</span>
          <span className="orbit-node node-buyers">Buyers require</span>
          <span className="orbit-node node-data">Evidence improves</span>
          <div className="orbit-core"><strong>TEC</strong><small>Free verification</small></div>
        </div>

        <div className="economics-grid">
          <article className="free-card">
            <p>Free, by principle</p>
            <h3>The network utility</h3>
            <ul>
              <li>Public resolution and verification</li>
              <li>Standards-compliant TEC issuance</li>
              <li>The open credential specification</li>
              <li>Basic issuer and correction history</li>
              <li>A reasonable public API</li>
            </ul>
          </article>
          <article className="paid-card">
            <p>Paid, by value</p>
            <h3>The enterprise operating layer</h3>
            <ul>
              <li>Laboratory and LIMS integrations</li>
              <li>Supplier and testing-program management</li>
              <li>Retailer procurement policy engines</li>
              <li>Monitoring, alerts, and private workflows</li>
              <li>Bulk APIs, analytics, and service guarantees</li>
            </ul>
          </article>
        </div>

        <blockquote className="free-principle">
          <span>Founding principle 01</span>
          <p>Evidence may be confidential. Verification must never be paywalled.</p>
        </blockquote>
      </section>

      <section className="ics-section" aria-labelledby="ics-title">
        <div className="ics-monogram" aria-hidden="true">ICS</div>
        <div>
          <p className="section-kicker">A natural extension</p>
          <h2 id="ics-title">Built for the Institute of Contaminant Standards.</h2>
          <p>
            ICS is positioned to define the contaminant evidence schema, convene laboratories and buyers, maintain the public-interest rules, and make the boundary between authentic evidence and safety interpretation unmistakable.
          </p>
          <ul>
            <li>Open technical specification</li>
            <li>Transparent issuer eligibility</li>
            <li>Public corrections and governance</li>
            <li>Outcome-neutral economics</li>
          </ul>
        </div>
      </section>

      <section className="why-cta">
        <div>
          <p className="section-kicker light">The opportunity</p>
          <h2>Make evidence portable before making it powerful.</h2>
        </div>
        <a href="/#record">Open the sample credential <span aria-hidden="true">↗</span></a>
      </section>

      <footer className="site-footer why-footer">
        <a className="brand footer-brand" href="/"><span className="brand-mark">T</span><span>TEC Network</span></a>
        <p>Test Evidence Credential · An ICS initiative</p>
        <p>Evidence should travel with its source.</p>
      </footer>
    </main>
  );
}
