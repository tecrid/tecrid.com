import type { Metadata } from "next";
import { RolePage } from "../role-page";

export const metadata: Metadata = {
  title: "TECRID for Laboratories — Issue Verifiable Laboratory Reports",
  description: "Issue authenticated laboratory reports, reduce report-verification calls, preserve corrections, and connect LIMS workflows to a persistent TECRID.",
  alternates: { canonical: "https://tecrid.com/for-laboratories" },
  keywords: ["laboratory report verification", "COA authentication", "verifiable laboratory reports", "LIMS integration", "laboratory report API"],
};

export default function ForLaboratoriesPage() {
  return <RolePage
    kicker="For analytical laboratories"
    eyebrow="Issue once · resolve anywhere"
    title="Stop answering the same report question twice."
    intro="TECRID gives each laboratory-issued report a persistent identifier, a verified issuer signature, and a versioned record that customers and authorized recipients can resolve without asking the laboratory to reconstruct the evidence by email."
    primaryHref="/laboratory-go-time"
    primaryLabel="Open the lab go-time pack"
    secondaryHref="/laboratory-value"
    secondaryLabel="Read the lab one-pager"
    problemTitle="PDF delivery ends the laboratory’s control over provenance."
    problemCopy="A PDF or Certificate of Analysis is a document—not a TECRID. Once that file is downloaded, forwarded, renamed, cropped, or manually transcribed, the laboratory is pulled back into verification calls and disputes. TECRID keeps the verified issuer, structured findings, source fingerprint, status, and correction history attached to a persistent record."
    proofPoints={[{ value: "1", label: "signed canonical record" }, { value: "5", label: "production gates before live issuance" }, { value: "0", label: "public issuance before verification" }]}
    benefits={[
      { label: "Verification", title: "Answer “did this come from us?” with a resolver.", copy: "A TECRID or source-document fingerprint can be checked against the laboratory-issued record and produce a durable verification receipt." },
      { label: "Delivery", title: "Route issuance to the customer workspace.", copy: "The brand receives the issued TECRID in its portfolio while recipient-specific grants can deliver narrower packages to certifiers, retailers, or government programs." },
      { label: "Lifecycle", title: "Correct or revoke without erasing the past.", copy: "Corrections and revocations append a signed status event or version. The prior fingerprint, reason, and verification receipts remain in the authorized audit trail." },
      { label: "Integration", title: "Add the TECRID to the final laboratory report.", copy: "Reserve an identifier, render it or its resolver URL in the report template, fingerprint the final PDF, sign the canonical payload, and finalize issuance through the API." },
    ]}
    workflowTitle="From LIMS release to customer delivery."
    workflow={[
      { title: "Reserve the TECRID", copy: "The laboratory reserves the identifier before rendering the final report so the report itself can display the TECRID and resolver destination." },
      { title: "Canonicalize and sign", copy: "TECRID returns the exact UTF-8 payload. The laboratory signs it with its verified Ed25519 key." },
      { title: "Finalize the report", copy: "The final PDF fingerprint, structured results, methods, identifiers, dates, and signature become the issued record." },
      { title: "Resolve, route, and maintain", copy: "The customer receives the record in its workspace; authorized recipients receive only their granted evidence scope. Corrections and revocations remain traceable." },
    ]}
    boundaryTitle="Registry verification is not blanket technical endorsement."
    boundaries={["ICS verifies the laboratory identity, authority, evidence, approved issuance scope, signing-key control, and TECRID conformance.", "A PDF or COA does not become a TECRID merely because an identifier is printed on it; the record must be finalized by an authenticated issuer.", "Accreditation and method scope are shown as evidence; TECRID does not expand or replace a laboratory’s accreditation.", "A valid signature proves origin and integrity. It does not prove that sampling was representative or the scientific interpretation was correct.", "Private and controlled records are not made public by joining the registry."]}
    ctaTitle="Your laboratory says GO. Use the same-day launch path."
    ctaCopy="Create a sandbox key, issue the fictional test record, call the candidate VLE evidence endpoint, and review the production checklist. Live issuance remains locked until every issuer-verification gate passes."
  />;
}
