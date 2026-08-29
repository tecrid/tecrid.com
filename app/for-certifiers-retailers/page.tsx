import type { Metadata } from "next";
import { RolePage } from "../role-page";

export const metadata: Metadata = {
  title: "TECRID for Certifiers, Retailers and Regulators — Structured Laboratory Evidence",
  description: "Request and validate laboratory evidence at scale through TECRIDs, scoped sharing, CSV intake, and API integrations—without repeated PDF uploads and OCR.",
  alternates: { canonical: "https://tecrid.com/for-certifiers-retailers" },
  keywords: ["certification evidence intake", "supplier compliance documents", "retailer laboratory data", "COA validation API", "laboratory evidence management"],
};

export default function ForCertifiersRetailersPage() {
  return <RolePage
    kicker="For certifiers, retailers and government programs"
    eyebrow="Request · validate · freeze · monitor"
    title="Receive laboratory evidence as data—not an attachment queue."
    intro="TECRID lets evidence recipients request a defined SKU and result scope, validate laboratory authority automatically, and preserve the exact record versions relied upon—while the brand or supplier controls each grant."
    primaryHref="/join?role=certification_body"
    primaryLabel="Create a free recipient workspace"
    secondaryHref="/sandbox"
    secondaryLabel="Run the multi-party sandbox"
    problemTitle="Document intake makes every recipient repeat the same low-value work."
    problemCopy="Personnel download files, rename them, OCR tables, correct transcription, check laboratory identity, compare versions, and chase missing evidence. TECRID moves those checks upstream and lets recipients apply their own program rules to a consistent evidence envelope."
    proofPoints={[{ value: "CSV", label: "bulk identifier intake" }, { value: "API", label: "procurement integration" }, { value: "SHA-256", label: "frozen package receipt" }]}
    benefits={[
      { label: "Requests", title: "Ask for the exact evidence scope needed.", copy: "Programs request a product, SKU, purpose, access level, analytes, and delivery mode instead of sending an open-ended upload checklist." },
      { label: "Validation", title: "Reject samples and incomplete authority automatically.", copy: "The intake gate confirms production namespace, issuer status, signature proof, current record status, and required identifiers before acceptance." },
      { label: "Reliance", title: "Freeze the version reviewed.", copy: "Each accepted package records the TECRID, version, authorized fields, and fingerprint so later corrections do not rewrite the historical decision basis." },
      { label: "Monitoring", title: "See evidence coverage across suppliers and products.", copy: "Structured delivery supports portfolio views, missing-analyte checks, renewal workflows, and procurement integrations without discarding record-level provenance." },
    ]}
    workflowTitle="A consented route from laboratory to recipient."
    workflow={[
      { title: "The recipient requests", copy: "A certifier, retailer, or government program names the product, SKU, evidence scope, purpose, and delivery mode." },
      { title: "The controller approves", copy: "The brand or supplier grants the recipient equal or narrower access and may revoke future delivery." },
      { title: "The laboratory issues", copy: "A verified laboratory signs the result and uses the controller’s one-laboratory routing authorization." },
      { title: "TECRID delivers", copy: "The registry creates a recipient-specific package and immutable receipt containing only the authorized evidence." },
    ]}
    boundaryTitle="A validated evidence package is not an approval decision."
    boundaries={["TECRID verifies the evidence envelope and authority; the recipient still applies its own technical, legal, procurement, or certification standard.", "Recipient access cannot exceed the scope granted by the brand or supplier.", "Revocation prevents future delivery but does not erase evidence already received and relied upon.", "The same TECRID can support different recipients without exposing one recipient’s private workflow to another."]}
    ctaTitle="Replace one document-heavy application with TECRID intake."
    ctaCopy="Start with a single certification program, retailer category, or regulatory submission and compare handling time, transcription exceptions, verification calls, and evidence completeness against the existing process."
  />;
}
