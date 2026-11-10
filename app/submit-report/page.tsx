import { PublicPage, PageHero } from "../blue-atlas/public-page";
import type { Metadata } from "next";
import { getChatGPTUser, chatGPTSignInPath } from "../chatgpt-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  alternates: { canonical: "https://tecrid.com/submit-report" },
  title: "Submit an existing lab report, TECRID",
  description:
    "Place an existing laboratory PDF into private TECRID intake and request confirmation from the laboratory that issued it.",
};

export default async function SubmitReportPage() {
  const user = await getChatGPTUser();
  const intakeHref = user
    ? "/dashboard/reports/new"
    : chatGPTSignInPath("/dashboard/reports/new");
  return (
    <PublicPage className="atlas-intake-marketing-page">

      <PageHero className="atlas-intake-hero">
        <p className="atlas-kicker">Existing report intake</p>
        <h1>A PDF can begin the process.<br />It cannot complete it.</h1>
        <p>
          Submit a report privately, preserve its exact fingerprint, transcribe the findings,
          and ask the named laboratory to confirm and sign the canonical record.
        </p>
        <a className="atlas-button" href={intakeHref}>Start private intake <span>→</span></a>
      </PageHero>
      <section className="atlas-intake-trust-strip" aria-label="Report intake states">
        <article><span>01</span><strong>Brand submitted</strong><p>The original PDF remains private and receives an immutable SHA-256 fingerprint.</p></article>
        <article><span>02</span><strong>Laboratory claimed</strong><p>A specifically invited laboratory account reviews the exact document and transcription.</p></article>
        <article><span>03</span><strong>Laboratory signed</strong><p>Only a verified issuer can sign the canonical payload and create a public TECRID.</p></article>
      </section>
      <section className="atlas-intake-boundary-section">
        <div><p className="atlas-kicker">No premature credibility</p><h2>Submission is not verification.</h2></div>
        <div className="atlas-claim-matrix atlas-compact-claims">
          <article><span>Private intake establishes</span><p>Which signed-in organization uploaded which exact file, at what time, with what transcription.</p></article>
          <article><span>Laboratory confirmation establishes</span><p>That the verified issuer accepted the document fingerprint and signed structured findings.</p></article>
        </div>
      </section>

    </PublicPage>
  );
}
