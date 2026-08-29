import type { Metadata } from "next";
import Link from "next/link";
import { ProductFooter, ProductNav } from "../site-nav";

export const metadata: Metadata = {
  title: "Founding Laboratory Pilot — Apply to Issue TECRIDs",
  description: "Join the free, controlled TECRID laboratory pilot. Review eligibility, verification gates, implementation steps, data boundaries, and what participating laboratories receive.",
  alternates: { canonical: "https://tecrid.com/laboratory-pilot" },
};

const gates = [
  ["Identity", "ICS reviews the laboratory’s legal entity, physical location, website, and the applicant’s authority to bind the laboratory."],
  ["Accreditation or competence", "The laboratory supplies current accreditation and scope evidence, or comparable documented competence when accreditation is not claimed."],
  ["Issuance scope", "Matrices, analyte families, method families, sites, and exclusions are recorded. Approval applies only to that bounded scope."],
  ["Signing-key control", "The laboratory signs a single-use canonical challenge with the private Ed25519 key corresponding to its submitted public key."],
  ["Conformance", "The signature must verify over the exact TECRID UTF-8 payload and encoding format before production issuance is unlocked."],
];

export default function LaboratoryPilotPage() {
  return (
    <main className="product-page pilot-page">
      <ProductNav compact />
      <section className="pilot-hero"><div><p className="section-kicker light">Free founding laboratory pilot</p><h1>Issue the first report that can verify itself.</h1><p>TECRID is accepting a small, controlled cohort of analytical laboratories to prove a simpler workflow for report delivery, authentication, correction, and customer evidence routing.</p><div><Link className="button-mint" href="/join?role=laboratory">Create laboratory workspace →</Link><Link href="/for-laboratories">See the laboratory case →</Link></div></div><aside><span>Cohort design</span><strong>3–5 laboratories</strong><small>One method family · one customer workflow · one successful conformance record</small></aside></section>

      <section className="pilot-clarity"><div><p className="section-kicker">What participating laboratories receive</p><h2>Free verification.<br />A bounded implementation.</h2><p>No laboratory pays to influence verification. The pilot is designed to measure whether TECRID reduces delivery work and verification friction before either party makes larger commitments.</p></div><div className="pilot-inclusions"><article><strong>Issuer workspace</strong><p>Private drafts, API keys, report reservations, signing tools, and a public issuer profile after approval.</p></article><article><strong>First integration</strong><p>Guided setup for the generic API or a supported LIMS connector profile.</p></article><article><strong>Conformance support</strong><p>A real key-control test, one non-production issuance exercise, and clear failure feedback.</p></article><article><strong>Pilot measurement</strong><p>Baseline and follow-up measurement of report delivery, verification contacts, and correction handling.</p></article></div></section>

      <section className="pilot-gates"><div><p className="section-kicker light">Five production gates</p><h2>An account is not an authenticated issuer.</h2><p>Every gate is separately recorded. The final approval control remains disabled until all five pass.</p></div><ol>{gates.map(([title, copy], index) => <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><p>{copy}</p></div></li>)}</ol></section>

      <section className="pilot-fit"><div><p className="section-kicker">Who should apply</p><h2>A narrow first cohort, not a vanity directory.</h2></div><div><article><strong>Best fit</strong><ul><li>Independent or in-house analytical laboratory with an authorized quality contact</li><li>Current accreditation scope or comparable competence evidence</li><li>Ability to generate or control an Ed25519 signing key</li><li>A recurring brand or supplier reporting workflow</li><li>Willingness to compare current and pilot handling time</li></ul></article><article><strong>Not required</strong><ul><li>A paid subscription</li><li>A public customer or report portfolio</li><li>Replacement of the existing LIMS</li><li>Migration of every historical report</li><li>Agreement that TECRID certifies analytical quality</li></ul></article></div></section>

      <section className="pilot-process"><div><p className="section-kicker">Application sequence</p><h2>From account to controlled issuance.</h2></div><ol><li><span>01</span><strong>Create a laboratory workspace</strong><p>Sign in, name the legal laboratory organization, and provide its website.</p></li><li><span>02</span><strong>Submit the issuer application</strong><p>Record location, authority role, accreditation status, scope, methods, contact, and the public signing key.</p></li><li><span>03</span><strong>Upload private evidence</strong><p>Provide legal identity, accreditation certificate, and scope PDFs. Files are private, fingerprinted, and restricted to the laboratory and ICS reviewers.</p></li><li><span>04</span><strong>Pass key conformance</strong><p>Sign a one-use canonical challenge through the browser key file or an external HSM/KMS.</p></li><li><span>05</span><strong>Complete ICS review</strong><p>ICS records each decision basis and approves only the documented scope.</p></li><li><span>06</span><strong>Run the first workflow</strong><p>Reserve, render, sign, finalize, resolve, and deliver one controlled report.</p></li></ol></section>

      <section className="role-cta pilot-final-cta"><div><p className="section-kicker light">Pilot applications are open</p><h2>Start with the laboratory account.</h2><p>Creating the workspace is free. The dashboard makes every remaining verification step—and every boundary—visible.</p></div><Link href="/join?role=laboratory">Create laboratory workspace <span>↗</span></Link></section>
      <ProductFooter />
    </main>
  );
}
