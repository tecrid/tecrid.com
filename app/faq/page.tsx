import {TECRID_DEFINITION} from "../../lib/tecrid-definition";
import { PublicPage, PageHero } from "../blue-atlas/public-page";
import type { Metadata } from "next";
import { ICS_ORGANIZATION_ID, TECRID_WEBSITE_ID } from "../../lib/entity-graph";

const canonicalUrl = "https://tecrid.com/faq";

const questions = [
  {
    question: "What does TECRID authenticate?",
    answer: "TECRID authenticates the provenance and integrity of a laboratory evidence record: who issued it, what structured record was signed, its fingerprint, its current status, and its visible correction or revocation history. It does not certify product safety or prove that every scientific conclusion is correct.",
  },
  {
    question: "Is a PDF or Certificate of Analysis already a TECRID?",
    answer: "No. A PDF or COA may be source evidence, but it does not become a TECRID through upload or by printing an identifier on it. A production laboratory-issued TECRID requires an approved issuer, a canonical structured record, a validated signature, and completed issuance.",
  },
  {
    question: "How does a laboratory become a TECRID issuer?",
    answer: "The path is request, sandbox keys, a test call, commercial approval from Karen and counsel, then production issuer credentials. The laboratory bar is ISO 17025 accreditation with scope fit for the evidence. Unpaid or $2,500 white-glove implementation support does not buy credibility or issuer status.",
  },
  {
    question: "How does TECRID stop fake laboratories minting evidence for VLE?",
    answer: "Only an approved issuer can sign a canonical, sample-bound evidence record. TECRID records are revocable, and VLE requires TECRID-linked evidence: qualification fails closed when the evidence is mismatched, revoked, expired, or unverifiable. A website, emailed PDF, or COA alone is not TECRID and cannot create an eligible VLE lot.",
    href: "/for-laboratories",
    linkLabel: "Review the laboratory issuer path →",
  },
  {
    question: "Can payment buy credibility or issuer approval?",
    answer: "No. TECRID is free. Paid Founding Organization support covers optional white-glove workflow implementation only. Payment cannot approve a laboratory, strengthen a verification result, change record status, or purchase credibility.",
  },
  {
    question: "Who operates TECRID?",
    answer: "TECRID is operated by Paleo Certified Inc.",
  },
  {
    question: "Where are VLE sampling and diligence questions answered?",
    answer: "Questions about VLE diligence, who selected the sampler, who paid, and VLE procedures belong in the VLE record and governance materials. TECRID authenticates the linked laboratory evidence; it does not supply those VLE facts.",
    href: "https://vle.exchange/faq",
    linkLabel: "Read the VLE FAQ →",
  },
];

export const metadata: Metadata = {
  title: "TECRID FAQ, Evidence authentication, governance and access",
  description: "Direct answers about what TECRID authenticates, why a PDF or COA is not a TECRID, paid support, governance, laboratory onboarding and VLE diligence.",
  alternates: { canonical: canonicalUrl },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "FAQPage",
      "@id": `${canonicalUrl}#questions`,
      url: canonicalUrl,
      name: "TECRID frequently asked questions",
      isPartOf: { "@type": "WebSite", "@id": TECRID_WEBSITE_ID, url: "https://tecrid.com" },
      publisher: { "@type": "Organization", "@id": ICS_ORGANIZATION_ID, name: "Institute of Contaminant Standards" },
      mainEntity: questions.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

export default function FaqPage() {
  return (
    <PublicPage className="atlas-explainer-page">

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }} />

      <PageHero className="atlas-explainer-hero atlas-faq-hero">
        <div>
          <p className="atlas-kicker">TECRID FAQ</p>
          <h1>Short answers.<br />Hard boundaries.</h1>
          <p className="atlas-explainer-definition">{TECRID_DEFINITION}</p><p><strong>TECRID authenticates laboratory evidence.</strong> It does not turn a detached document into an issued record, sell credibility, or certify that a product is safe.</p>
          <div className="atlas-explainer-actions"><a className="atlas-button" href="/laboratory-go-time">Laboratory go-time →</a><a className="atlas-explainer-text-link" href="/join">Join the free core →</a></div>
        </div>
        <aside aria-label="TECRID trust boundaries">
          <div><span>Authenticates</span><strong>Evidence provenance</strong></div>
          <div><span>PDF or COA</span><strong>Source, not issuance</strong></div>
          <div><span>Payment</span><strong>Workflow, not credibility</strong></div>
          <div><span>Safety claim</span><strong>Not provided by TECRID</strong></div>
        </aside>
      </PageHero>

      <section className="atlas-explainer-section atlas-explainer-faq" aria-labelledby="faq-title">
        <div><p className="atlas-kicker">Direct answers</p><h2 id="faq-title">What TECRID proves and what it does not.</h2></div>
        <div>
          {questions.map((item) => <article key={item.question}><h3>{item.question}</h3><p>{item.answer}</p>{item.href ? <a className="atlas-faq-answer-link" href={item.href}>{item.linkLabel}</a> : null}</article>)}
        </div>
      </section>

      <section className="atlas-explainer-cta"><div><p className="atlas-kicker">Independent sampling and diligence</p><h2>VLE questions<br />stay with VLE.</h2></div><a className="atlas-button" href="https://vle.exchange/faq">Open the VLE FAQ →</a></section>

    </PublicPage>
  );
}
