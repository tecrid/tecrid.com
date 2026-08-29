import type { Metadata } from "next";
import Link from "next/link";
import { SAMPLE_TECRID } from "../../lib/sample-tecrid";
import { ProductFooter, ProductNav } from "../site-nav";

const canonicalUrl = "https://tecrid.com/what-is-a-tecrid";
const definition = "A TECRID is a permanent identifier for a laboratory-issued Test Evidence Credential: a structured digital record of what was tested, what the laboratory reported, who issued it, and whether the record has changed.";

export const metadata: Metadata = {
  title: "What is a TECRID? Meaning, purpose and how it works",
  description: "TECRID stands for Test Evidence Credential Record Identifier. Learn what it identifies, who uses it, how it reduces laboratory-report fraud, and what it does not prove.",
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: "What is a TECRID?",
    description: "The permanent, verifiable identifier for laboratory-issued digital evidence records.",
    type: "article",
    url: canonicalUrl,
    images: [{ url: "https://tecrid.com/og.png", width: 1734, height: 907, alt: "TECRID · verifiable identifiers for laboratory evidence" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "What is a TECRID?",
    description: "The permanent, verifiable identifier for laboratory-issued digital evidence records.",
    images: ["https://tecrid.com/og.png"],
  },
};

const audiences = [
  { role: "Laboratories", purpose: "Issue authenticated, structured records and answer report-verification questions without repeatedly searching archives or confirming emailed PDFs." },
  { role: "Brands and suppliers", purpose: "Receive reports in one evidence portfolio, preserve what the laboratory actually reported, and share only the records and SKUs they authorize." },
  { role: "Retailers, certifiers and government", purpose: "Request and validate evidence at scale through identifiers, scoped sharing, CSV submissions, and APIs instead of collecting folders of PDFs." },
  { role: "Researchers and the public", purpose: "Resolve public TECRIDs, verify their issuer and status, and see corrections without relying on a screenshot or detached document." },
];

const questions = [
  ["What does TECRID stand for?", "TECRID stands for Test Evidence Credential Record Identifier. TEC is the Test Evidence Credential—the digital evidence record. TECRID is the permanent identifier assigned to that record."],
  ["Is every TECRID public?", "No. A TECRID may be private, controlled for named recipients, or public. Assigning an identifier does not itself publish the underlying report or findings."],
  ["Can a brand issue its own laboratory TECRID?", "A brand can place a historical report into private intake and ask the named laboratory to confirm it. A production laboratory-issued TECRID requires a verified laboratory, its reviewed signing key, and its signature over the record."],
  ["Does a TECRID prove that a product is safe or compliant?", "No. It authenticates the evidence record and its history. It does not replace representative sampling, method suitability, accreditation, regulatory criteria, certification review, or expert interpretation."],
  ["How is a TECRID different from a DOI or ORCID?", "A DOI persistently identifies a research output. An ORCID identifies a researcher. A TECRID persistently identifies a laboratory evidence record."],
  ["Who operates TECRID?", "TEC Registry is an initiative of the Institute of Contaminant Standards, which develops the protocol, issuer rules, governance, and public-interest safeguards."],
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "DefinedTerm",
      "@id": `${canonicalUrl}#term`,
      name: "TECRID",
      alternateName: "Test Evidence Credential Record Identifier",
      description: definition,
      url: canonicalUrl,
      inDefinedTermSet: { "@id": "https://tecrid.com/standard" },
    },
    {
      "@type": "WebPage",
      "@id": canonicalUrl,
      url: canonicalUrl,
      name: "What is a TECRID? Meaning, purpose and how it works",
      description: definition,
      dateModified: "2026-08-29",
      about: { "@id": `${canonicalUrl}#term` },
      isPartOf: { "@type": "WebSite", "@id": "https://tecrid.com/#website", name: "TECRID · TEC Registry", url: "https://tecrid.com" },
      publisher: { "@type": "Organization", "@id": "https://tecrid.com/#ics", name: "Institute of Contaminant Standards", url: "https://contaminantstandards.com" },
    },
    {
      "@type": "FAQPage",
      "@id": `${canonicalUrl}#questions`,
      mainEntity: questions.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    },
  ],
};

export default function WhatIsATecridPage() {
  return (
    <main className="product-page explainer-page">
      <ProductNav compact />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }} />

      <header className="explainer-hero">
        <div>
          <p className="section-kicker light">TECRID, explained</p>
          <h1>What is a<br />TECRID?</h1>
          <p><strong>TECRID stands for Test Evidence Credential Record Identifier.</strong> {definition}</p>
          <div className="explainer-actions"><a className="button-mint" href={`/records/${encodeURIComponent(SAMPLE_TECRID)}`}>Resolve a sample TECRID →</a><a className="explainer-text-link" href="/verify">Verify a report →</a></div>
          <p className="explainer-review">Definition maintained by the Institute of Contaminant Standards · Reviewed 29 August 2026</p>
        </div>
        <aside aria-label="TECRID at a glance">
          <div><span>Identifies</span><strong>Laboratory evidence</strong></div>
          <div><span>Persists across</span><strong>Systems and organizations</strong></div>
          <div><span>Visibility</span><strong>Private, controlled or public</strong></div>
          <div><span>Public resolution</span><strong>Free</strong></div>
        </aside>
      </header>

      <section className="identifier-comparison" aria-label="Persistent identifier comparison">
        <article><span>ORCID</span><strong>Identifies a researcher</strong></article>
        <article><span>DOI</span><strong>Identifies a research output</strong></article>
        <article className="active"><span>TECRID</span><strong>Identifies a laboratory evidence record</strong></article>
      </section>

      <section className="explainer-section explainer-function" aria-labelledby="function-title">
        <div><p className="section-kicker">Purpose and function</p><h2 id="function-title">Make the laboratory’s record portable—and still verifiable.</h2></div>
        <ol>
          <li><span>01</span><div><strong>The laboratory issues</strong><p>The record captures results, units, methods, sample context, issuer identity, and the intended visibility.</p></div></li>
          <li><span>02</span><div><strong>TECRID preserves</strong><p>The registry verifies the issuer’s signature, fingerprints the exact record, assigns the identifier, and retains versions and corrections.</p></div></li>
          <li><span>03</span><div><strong>Recipients resolve</strong><p>A person or connected system uses the TECRID to retrieve the authorized current record and determine whether it is authentic, current, corrected, or revoked.</p></div></li>
        </ol>
      </section>

      <section className="explainer-section explainer-audiences" aria-labelledby="audiences-title">
        <div><p className="section-kicker light">Who TECRID is for</p><h2 id="audiences-title">One identifier across the evidence chain.</h2><p>The same record can move from the issuing laboratory to the organizations that manufacture, certify, procure, regulate, research, or evaluate a product—without becoming an uncontrolled public PDF.</p></div>
        <div>{audiences.map((audience, index) => <article key={audience.role}><span>0{index + 1}</span><h3>{audience.role}</h3><p>{audience.purpose}</p></article>)}</div>
      </section>

      <section className="explainer-section fraud-boundary" aria-labelledby="fraud-title">
        <div><p className="section-kicker">Fraud reduction</p><h2 id="fraud-title">TECRID reduces opportunities for evidence fraud. It does not make fraud impossible.</h2><p>Its job is to make a laboratory claim checkable at its source and to preserve the exact record that was issued.</p><Link href="/why">See the documented market problem →</Link></div>
        <div className="fraud-columns">
          <article><span>What it makes harder</span><ul><li>Inventing a laboratory report that the named laboratory never issued</li><li>Changing values, units, methods, or sample context after issuance</li><li>Presenting an obsolete version while hiding a correction or revocation</li><li>Separating results from issuer identity and provenance</li></ul></article>
          <article><span>What it does not prove alone</span><ul><li>That the submitted sample represented the entire lot</li><li>That a method was suitable for every scientific or regulatory purpose</li><li>That a result meets a safety, legal, or certification standard</li><li>That every claim elsewhere in a supply chain is truthful</li></ul></article>
        </div>
      </section>

      <section className="global-transparency" aria-labelledby="global-title">
        <div><p className="section-kicker light">Global transparency</p><h2 id="global-title">Evidence can cross borders without losing its source.</h2></div>
        <p>TECRID provides a common web identifier, structured schema, verification method, and API boundary that do not depend on one laboratory’s PDF format or one buyer’s software. As adoption grows, laboratories can issue once, organizations can reuse authorized evidence, and public records can be checked anywhere without forcing confidential findings into the open.</p>
      </section>

      <section className="explainer-section explainer-faq" aria-labelledby="questions-title">
        <div><p className="section-kicker">Direct answers</p><h2 id="questions-title">Common TECRID questions.</h2></div>
        <div>{questions.map(([question, answer]) => <article key={question}><h3>{question}</h3><p>{answer}</p></article>)}</div>
      </section>

      <section className="explainer-cta"><div><p className="section-kicker light">See the identifier work</p><h2>Resolve the example.<br />Inspect the source trail.</h2></div><a className="button-mint" href={`/records/${encodeURIComponent(SAMPLE_TECRID)}`}>Open sample TECRID →</a></section>
      <ProductFooter />
    </main>
  );
}
