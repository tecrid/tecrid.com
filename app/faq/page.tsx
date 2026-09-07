import type { Metadata } from "next";
import { ICS_ORGANIZATION_ID, TECRID_WEBSITE_ID } from "../../lib/entity-graph";
import { ProductFooter, ProductNav } from "../site-nav";

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
    question: "Can payment buy credibility or issuer approval?",
    answer: "No. The core registry is free. Paid Founding Organization support covers optional white-glove workflow implementation only. Payment cannot approve a laboratory, strengthen a verification result, change record status, or purchase credibility.",
  },
  {
    question: "Who operates TECRID?",
    answer: "Paleo Certified Inc. is the commercial parent. The Institute of Contaminant Standards (ICS) is a registered DBA of Paleo Certified Inc. Paleo Certified Inc. has operated certification programs since January 2010.",
  },
  {
    question: "Where are VLE sampling and diligence questions answered?",
    answer: "Questions about VLE diligence, who selected the sampler, who paid, and VLE procedures belong in the VLE record and governance materials. TECRID authenticates the linked laboratory evidence; it does not supply those VLE facts.",
    href: "https://vle.exchange/faq",
    linkLabel: "Read the VLE FAQ →",
  },
];

export const metadata: Metadata = {
  title: "TECRID FAQ — Evidence authentication, governance and access",
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
    <main className="product-page explainer-page">
      <ProductNav compact />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }} />

      <header className="explainer-hero faq-hero">
        <div>
          <p className="section-kicker light">TECRID FAQ</p>
          <h1>Short answers.<br />Hard boundaries.</h1>
          <p className="explainer-definition"><strong>TECRID authenticates laboratory evidence.</strong> It does not turn a detached document into an issued record, sell credibility, or certify that a product is safe.</p>
          <div className="explainer-actions"><a className="button-mint" href="/laboratory-go-time">Laboratory go-time →</a><a className="explainer-text-link" href="/join">Join the free core →</a></div>
        </div>
        <aside aria-label="TECRID trust boundaries">
          <div><span>Authenticates</span><strong>Evidence provenance</strong></div>
          <div><span>PDF or COA</span><strong>Source, not issuance</strong></div>
          <div><span>Payment</span><strong>Workflow, not credibility</strong></div>
          <div><span>Safety claim</span><strong>Not provided by TECRID</strong></div>
        </aside>
      </header>

      <section className="explainer-section explainer-faq" aria-labelledby="faq-title">
        <div><p className="section-kicker">Direct answers</p><h2 id="faq-title">What TECRID proves—and what it does not.</h2></div>
        <div>
          {questions.map((item) => <article key={item.question}><h3>{item.question}</h3><p>{item.answer}</p>{item.href ? <a className="faq-answer-link" href={item.href}>{item.linkLabel}</a> : null}</article>)}
        </div>
      </section>

      <section className="explainer-cta"><div><p className="section-kicker light">Independent sampling and diligence</p><h2>VLE questions<br />stay with VLE.</h2></div><a className="button-mint" href="https://vle.exchange/faq">Open the VLE FAQ →</a></section>
      <ProductFooter />
    </main>
  );
}
