import { PublicPage, PageHero } from "../blue-atlas/public-page";
import type { Metadata } from "next";
import { EvidenceValue } from "../evidence-value";

export const metadata: Metadata = {
  alternates: { canonical: "https://tecrid.com/why" },
  title: "Why TECRID exists, TECRID",
  description:
    "Replace PDF trust with checkable, issuer-signed laboratory evidence. Free core verification, with commercial paths through VLE QUALIFIED and HMTc certification.",
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
    <PublicPage className="atlas-why-page">


      <PageHero className="atlas-why-hero">
        <div className="atlas-why-hero-copy">
          <p className="atlas-kicker"><span /> Why TECRID exists</p>
          <h1>A PDF travels.<br />Proof should travel with it.</h1>
          <p>
            An unverifiable COA makes every recipient start again. Counsel and retailers spend time reconciling folders of PDFs, matching lots, chasing the issuing laboratory, and locating corrections. Replace that PDF trust and discovery friction with checkable, issuer-signed evidence whose source, integrity, and current status can be verified.
          </p>
          <div className="atlas-sell-hero-actions"><a href="https://vle.exchange/for-suppliers">Explore VLE QUALIFIED ↗</a><a href="https://heavymetalcertified.com/apply">Apply for HMTc certification ↗</a></div>
        </div>
        <aside className="atlas-problem-statement">
          <span>The infrastructure gap</span>
          <blockquote>
            Organizations lack a universal, authoritative way to exchange and verify laboratory evidence after it leaves the issuing laboratory.
          </blockquote>
          <small>TECRID problem statement · v1.0</small>
        </aside>
      </PageHero>

      <section className="atlas-proof-strip" aria-label="Evidence summary">
        <div><strong>Document fraud</strong><span>Officially recognized</span></div>
        <div><strong>COA reliability</strong><span>Recurring enforcement concern</span></div>
        <div><strong>Digital exchange</strong><span>Active standards work</span></div>
        <div><strong>Market demand</strong><span>To be proven by pilots</span></div>
      </section>

      <EvidenceValue />

      <section className="atlas-lab-value-sell" aria-labelledby="lab-value-sell-title">
        <div><p className="atlas-kicker">For the issuing laboratory</p><h2 id="lab-value-sell-title">Issue once. Fewer phone calls.<br />More sealed volume.</h2></div>
        <div><p>Every “did you issue this?” call puts your team back on a report it already finished. Issue a signed record once, let authorized recipients check it, and keep corrections attached to the same identifier.</p><p>VLE connects laboratory evidence to sealed samples and recorded custody. As buyers request TECRID-linked evidence, your laboratory gains a path to more testing of independently sealed samples. Pilots must establish the actual time saved and volume gained.</p><a href="/for-laboratories">See the laboratory path →</a></div>
      </section>

      <section className="atlas-evidence-section" id="evidence" aria-labelledby="evidence-title">
        <div className="atlas-evidence-intro">
          <p className="atlas-kicker">The documented need</p>
          <h2 id="evidence-title">This is not a hypothetical problem.</h2>
          <p>
            Independent institutions have documented fraudulent certificates, incomplete testing, unreliable supplier evidence, and the need for machine-readable analytical records. No single incident proves a global market, but together they establish a serious, verifiable infrastructure failure.
          </p>
        </div>
        <div className="atlas-source-list">
          {sources.map((source) => (
            <a key={source.title} className="atlas-source-row" href={source.href} target="_blank" rel="noreferrer">
              <span className="atlas-source-date">{source.date}</span>
              <span className="atlas-source-copy">
                <small>{source.authority}</small>
                <strong>{source.title}</strong>
                <p>{source.detail}</p>
              </span>
              <span className="atlas-source-arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </section>

      <section className="atlas-evidence-boundary" aria-labelledby="boundary-evidence-title">
        <div>
          <p className="atlas-kicker">Evidence, with discipline</p>
          <h2 id="boundary-evidence-title">What is established and what remains to prove.</h2>
        </div>
        <div className="atlas-claim-matrix">
          <article>
            <span className="atlas-claim-status atlas-established">Established</span>
            <h3>False and altered laboratory documents exist.</h3>
            <p>Government alerts and prosecutions demonstrate occurrence and potentially severe consequences.</p>
          </article>
          <article>
            <span className="atlas-claim-status atlas-established">Established</span>
            <h3>Supplier COAs cannot simply be trusted.</h3>
            <p>Quality systems must establish supplier reliability, methods, sampling context, and applicability.</p>
          </article>
          <article>
            <span className="atlas-claim-status atlas-established">Established</span>
            <h3>Document-based exchange blocks automation.</h3>
            <p>NIST and industry initiatives are already developing structured, machine-readable certificates.</p>
          </article>
          <article>
            <span className="atlas-claim-status atlas-open">Open question</span>
            <h3>Will buyers require a shared evidence network?</h3>
            <p>TECRID must earn that answer through real laboratory, brand, and retailer pilots, not assertion.</p>
          </article>
        </div>
      </section>

      <section className="atlas-naming-section" aria-labelledby="naming-title">
        <div>
          <p className="atlas-kicker">A durable architecture</p>
          <h2 id="naming-title">One mark. Clear meanings.</h2>
          <p>
            The Test Evidence Credential is the laboratory record. TECRID names its permanent record identifier. TECRID provides the public resolver and operating platform.
          </p>
        </div>
        <dl className="atlas-name-system">
          <div><dt>TECRID</dt><dd>The public resolver and operating platform</dd></div>
          <div><dt>Test Evidence Credential</dt><dd>The lab-issued digital record</dd></div>
          <div><dt>TECRID</dt><dd>The permanent Test Evidence Credential Record Identifier</dd></div>
          <div><dt>TECRID Protocol</dt><dd>The open technical and governance standard</dd></div>
          <div><dt>ICS</dt><dd>The standards steward and public-interest home</dd></div>
        </dl>
      </section>

      <section className="atlas-ingredient-integrity-section" aria-labelledby="ingredient-integrity-title">
        <div>
          <p className="atlas-kicker">Proposed vertical · not yet implemented</p>
          <h2 id="ingredient-integrity-title">Preserve what was claimed.<br />Test what was present.</h2>
          <p>A supplier declaration and a laboratory result answer different questions. This proposed application would link them to the same physical lot without pretending that the declaration itself is analytical proof.</p>
        </div>
        <ol className="atlas-integrity-chain">
          <li><span>01</span><div><strong>Supplier declares</strong><p>“Lot AO-1842 is 100% avocado oil.” The named supplier signs and timestamps that representation.</p></div></li>
          <li><span>02</span><div><strong>Custody connects</strong><p>Shipment, containers, seals, receiving, sampling, and laboratory receipt point to the same lot.</p></div></li>
          <li><span>03</span><div><strong>The laboratory issues</strong><p>An authenticity Test Evidence Credential records the method, analytical markers, results, uncertainty, issuer proof, and TECRID.</p></div></li>
          <li><span>04</span><div><strong>A future application compares</strong><p>The resulting state could be consistent, inconsistent, inconclusive, or custody not established, not a marketing badge.</p></div></li>
        </ol>
      </section>

      <section className="atlas-ics-section" aria-labelledby="ics-title">
        <div className="atlas-ics-monogram" aria-hidden="true">ICS</div>
        <div>
          <p className="atlas-kicker">A natural extension</p>
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

      <section className="atlas-why-cta">
        <div>
          <p className="atlas-kicker">The opportunity</p>
          <h2>Make evidence portable before making it powerful.</h2>
        </div>
        <a href="/join">Join TECRID <span aria-hidden="true">↗</span></a>
      </section>


    </PublicPage>
  );
}
