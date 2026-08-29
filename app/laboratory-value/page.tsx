/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { ProductFooter, ProductNav } from "../site-nav";
import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "Why Laboratories Join TECRID — Laboratory Business Case",
  description: "A concise laboratory one-pager explaining how TECRID protects report provenance, reduces verification work, improves delivery, and creates measurable customer value.",
  alternates: { canonical: "https://tecrid.com/laboratory-value" },
  keywords: ["laboratory business case", "laboratory report authentication", "reduce COA verification calls", "LIMS report delivery", "verifiable laboratory reports"],
};

export default function LaboratoryValuePage() {
  return (
    <main className="lab-value-page">
      <ProductNav compact />
      <article className="lab-value-sheet">
        <header className="lab-value-toolbar"><div><img src="/brand/tecrid-logo.png" alt="" width="30" height="30" /><span>Laboratory business case · one-pager</span></div><PrintButton /></header>

        <section className="lab-value-hero">
          <div><p className="section-kicker light">Why a laboratory joins TECRID</p><h1>Protect the report after it leaves the laboratory.</h1><p>A PDF can be renamed, cropped, altered, separated from its correction history, or presented by someone the laboratory never authorized. A TECRID keeps the issuer, exact findings, final-document fingerprint, status, and version history attached to the evidence.</p></div>
          <aside><span>The commercial proposition</span><strong>Issue once.</strong><strong>Verify without callbacks.</strong><strong>Deliver with control.</strong></aside>
        </section>

        <section className="lab-value-problem">
          <div><p className="section-kicker">The cost today</p><h2>The laboratory keeps paying for a report it already finished.</h2><p>When a customer, retailer, certifier, regulator, or attorney questions a forwarded document, laboratory staff must search the LIMS, compare files, confirm authenticity, explain amendments, and resend evidence. That work is usually unpriced, interruptive, and difficult to measure.</p></div>
          <div className="lab-value-shift"><article><span>01</span><strong>Authorship survives forwarding</strong><p>A resolver and signed canonical record answer whether the evidence came from the registered issuer.</p></article><article><span>02</span><strong>Delivery becomes reusable</strong><p>The brand receives its record once; separately authorized recipients receive their scoped packages automatically.</p></article><article><span>03</span><strong>Corrections remain legible</strong><p>Revisions and revocations append to the history rather than relying on every recipient to replace a file.</p></article></div>
        </section>

        <section className="lab-value-benefits">
          <article><span>Reputation</span><h3>Separate authentic reports from altered or fabricated copies.</h3></article>
          <article><span>Operations</span><h3>Reduce repeat delivery, manual verification, and document reconciliation.</h3></article>
          <article><span>Revenue</span><h3>Become easier for serious brands, retailers, and certification programs to rely on.</h3></article>
          <article><span>Integration</span><h3>Keep the LIMS as system of record and add TECRID at the controlled release boundary.</h3></article>
        </section>

        <section className="lab-value-investment">
          <div><p className="section-kicker light">A bounded investment</p><h2>Start with one method family and one customer workflow.</h2><p>Laboratory verification and the founding pilot are free. TECRID does not require a new LIMS, a public report portfolio, or migration of every historical document.</p></div>
          <ol><li><span>01</span><strong>Verify the issuer</strong><small>Identity · competence evidence · scope · key control · conformance</small></li><li><span>02</span><strong>Connect final release</strong><small>Reserve · render · fingerprint · sign · finalize</small></li><li><span>03</span><strong>Measure the result</strong><small>Delivery minutes · verification contacts · corrections · exceptions</small></li></ol>
        </section>

        <section className="lab-value-proof-boundary"><div><span>What TECRID proves</span><p>Which reviewed laboratory signed the record, what it contained, the final-document fingerprint, its current status, and its visible version history.</p></div><div><span>What it does not prove</span><p>TECRID does not replace accreditation, representative sampling, analytical competence, regulatory judgment, or interpretation—and it makes no product-safety or certification claim.</p></div></section>

        <footer className="lab-value-cta"><div><p className="section-kicker">Free founding laboratory pilot</p><h2>Make authentic laboratory evidence easier to verify—and harder to impersonate.</h2></div><div><a href="/laboratory-pilot">Review the pilot →</a><a href="/join?role=laboratory">Create a laboratory workspace →</a><a href="/integrate">See one-word integration →</a></div></footer>
      </article>
      <ProductFooter />
    </main>
  );
}
