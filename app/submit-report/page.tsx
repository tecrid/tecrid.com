import type { Metadata } from "next";
import { getChatGPTUser, chatGPTSignInPath } from "../chatgpt-auth";
import { ProductFooter, ProductNav } from "../site-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Submit an existing lab report — TEC Registry",
  description:
    "Place an existing laboratory PDF into private TECRID intake and request confirmation from the laboratory that issued it.",
};

export default async function SubmitReportPage() {
  const user = await getChatGPTUser();
  const intakeHref = user
    ? "/dashboard/reports/new"
    : chatGPTSignInPath("/dashboard/reports/new");
  return (
    <main className="product-page intake-marketing-page">
      <ProductNav compact />
      <section className="product-hero intake-hero">
        <p className="section-kicker light">Existing report intake</p>
        <h1>A PDF can begin the process.<br />It cannot complete it.</h1>
        <p>
          Submit a report privately, preserve its exact fingerprint, transcribe the findings,
          and ask the named laboratory to confirm and sign the canonical record.
        </p>
        <a className="button-mint" href={intakeHref}>Start private intake <span>→</span></a>
      </section>
      <section className="intake-trust-strip" aria-label="Report intake states">
        <article><span>01</span><strong>Brand submitted</strong><p>The original PDF remains private and receives an immutable SHA-256 fingerprint.</p></article>
        <article><span>02</span><strong>Laboratory claimed</strong><p>A specifically invited laboratory account reviews the exact document and transcription.</p></article>
        <article><span>03</span><strong>Laboratory signed</strong><p>Only a verified issuer can sign the canonical payload and create a public TECRID.</p></article>
      </section>
      <section className="intake-boundary-section">
        <div><p className="section-kicker">No premature credibility</p><h2>Submission is not verification.</h2></div>
        <div className="claim-matrix compact-claims">
          <article><span>Private intake establishes</span><p>Which signed-in organization uploaded which exact file, at what time, with what transcription.</p></article>
          <article><span>Laboratory confirmation establishes</span><p>That the verified issuer accepted the document fingerprint and signed structured findings.</p></article>
        </div>
      </section>
      <ProductFooter />
    </main>
  );
}
