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
    primaryHref="/laboratory-pilot"
    primaryLabel="Apply for the free pilot"
    secondaryHref="/laboratory-value"
    secondaryLabel="Read the lab one-pager"
    problemTitle="PDF delivery ends the laboratory’s control over provenance."
    problemCopy="Once a report is downloaded, forwarded, renamed, cropped, or manually transcribed, the laboratory is pulled back into verification calls, disputes, and repeat delivery. TECRID keeps the issuer, exact findings, source fingerprint, status, and correction history attached to the record."
    proofPoints={[{ value: "1", label: "signed canonical record" }, { value: "0", label: "public issuance before verification" }, { value: "∞", label: "authorized resolutions from the same source" }]}
    benefits={[
      { label: "Verification", title: "Answer “did this come from us?” with a resolver.", copy: "A TECRID or source-document fingerprint can be checked against the laboratory-issued record and produce a durable verification receipt." },
      { label: "Delivery", title: "Route issuance to the customer workspace.", copy: "The brand receives the issued TECRID in its portfolio while recipient-specific grants can deliver narrower packages to certifiers, retailers, or government programs." },
      { label: "Corrections", title: "Amend without erasing the past.", copy: "Corrections and revocations append a new signed version. The prior fingerprint and reason remain visible to authorized recipients." },
      { label: "Integration", title: "Add the TECRID to the final laboratory report.", copy: "Reserve an identifier, render it or its resolver URL in the report template, fingerprint the final PDF, sign the canonical payload, and finalize issuance through the API." },
    ]}
    workflowTitle="From LIMS release to customer delivery."
    workflow={[
      { title: "Reserve the TECRID", copy: "The laboratory reserves the identifier before rendering the final report so the report itself can display the TECRID and resolver destination." },
      { title: "Canonicalize and sign", copy: "TECRID returns the exact UTF-8 payload. The laboratory signs it with its verified Ed25519 key." },
      { title: "Finalize the report", copy: "The final PDF fingerprint, structured results, methods, identifiers, dates, and signature become the issued record." },
      { title: "Resolve and route", copy: "The customer receives the record in its workspace; authorized recipients receive only their granted evidence scope." },
    ]}
    boundaryTitle="Registry verification is not blanket technical endorsement."
    boundaries={["ICS verifies the laboratory identity, authority, evidence, approved issuance scope, signing-key control, and TECRID conformance.", "Accreditation and method scope are shown as evidence; TECRID does not expand or replace a laboratory’s accreditation.", "A valid signature proves origin and integrity. It does not prove that sampling was representative or the scientific interpretation was correct.", "Private and controlled records are not made public by joining the registry."]}
    ctaTitle="Pilot one method family and one customer workflow."
    ctaCopy="The founding laboratory pilot is free. Begin with a bounded issuance scope, a successful signing challenge, and one non-production conformance record before any live TECRID is issued."
  />;
}
