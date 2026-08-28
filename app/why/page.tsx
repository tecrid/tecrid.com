import type { Metadata } from "next";
import { ProductFooter, ProductNav } from "../site-nav";

export const metadata: Metadata = {
  title: "Why TEC exists — TEC Registry",
  description:
    "The documented case for verifiable, machine-readable laboratory evidence—and why TEC Registry is free at the edges.",
};

const sources = [
  {
    date: "2026",
    authority: "University of California, Davis",
    title: "Brands may unknowingly receive adulterated avocado oil",
    detail:
      "UC Davis reported widespread inconsistency in avocado-oil-labeled processed foods and noted that adulteration may originate through upstream suppliers and brokers.",
    href: "https://www.ucdavis.edu/food/news/avocado-oil-chip-youre-eating-may-not-be-made-pure-avocado-oil",
  },
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
      <ProductNav compact />

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
          <small>TEC Registry problem statement · v1.0</small>
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
          <h2 id="naming-title">One mark. Four clear meanings.</h2>
          <p>
            TEC names the evidence credential. TECRID names its permanent record identifier. Registry names the public infrastructure—not a vague membership network.
          </p>
        </div>
        <dl className="name-system">
          <div><dt>TEC Registry</dt><dd>The public resolver and operating platform</dd></div>
          <div><dt>Test Evidence Credential</dt><dd>The lab-issued digital record</dd></div>
          <div><dt>TECRID</dt><dd>The permanent TEC Record Identifier</dd></div>
          <div><dt>TEC Protocol</dt><dd>The open technical and governance standard</dd></div>
          <div><dt>ICS</dt><dd>The standards steward and public-interest home</dd></div>
        </dl>
      </section>

      <section className="free-section" id="free-network" aria-labelledby="free-title">
        <div className="free-intro">
          <p className="section-kicker light">Free at the edges</p>
          <h2 id="free-title">Verification cannot become valuable until it becomes ubiquitous.</h2>
          <p>
            TEC Registry follows a network strategy: remove the tollbooths from verification, then build paid services around the activity the open registry creates.
          </p>
        </div>

        <div className="network-orbit" aria-label="TEC Registry flywheel">
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
              <li>Draft-protocol TEC issuance tooling</li>
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

      <section className="ingredient-integrity-section" aria-labelledby="ingredient-integrity-title">
        <div>
          <p className="section-kicker">Proposed vertical · not yet implemented</p>
          <h2 id="ingredient-integrity-title">Preserve what was claimed.<br />Test what was present.</h2>
          <p>A supplier declaration and a laboratory result answer different questions. This proposed application would link them to the same physical lot without pretending that the declaration itself is analytical proof.</p>
        </div>
        <ol className="integrity-chain">
          <li><span>01</span><div><strong>Supplier declares</strong><p>“Lot AO-1842 is 100% avocado oil.” The named supplier signs and timestamps that representation.</p></div></li>
          <li><span>02</span><div><strong>Custody connects</strong><p>Shipment, containers, seals, receiving, sampling, and laboratory receipt point to the same lot.</p></div></li>
          <li><span>03</span><div><strong>The laboratory issues</strong><p>An authenticity TEC records the method, analytical markers, results, uncertainty, issuer proof, and TECRID.</p></div></li>
          <li><span>04</span><div><strong>A future application compares</strong><p>The resulting state could be consistent, inconsistent, inconclusive, or custody not established—not a marketing badge.</p></div></li>
        </ol>
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
        <a href="/join">Join the registry <span aria-hidden="true">↗</span></a>
      </section>

      <ProductFooter />
    </main>
  );
}
