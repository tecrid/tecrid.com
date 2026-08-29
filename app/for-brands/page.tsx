import type { Metadata } from "next";
import { RolePage } from "../role-page";

export const metadata: Metadata = {
  title: "TECRID for Brands and Ingredient Suppliers — Verifiable COA Portfolios",
  description: "Organize laboratory reports by SKU and lot, verify supplier evidence, control disclosure, and replace repeated PDF uploads with persistent TECRIDs.",
  alternates: { canonical: "https://tecrid.com/for-brands" },
  keywords: ["COA management", "supplier lab report verification", "ingredient testing records", "contaminant test portfolio", "laboratory report sharing"],
};

export default function ForBrandsPage() {
  return <RolePage
    kicker="For brands and ingredient suppliers"
    eyebrow="Portfolio control · evidence provenance"
    title="Know which report belongs to which product, lot, and claim."
    intro="TECRID turns laboratory reports into a governed evidence portfolio: searchable by product and lot, attributable to the issuing laboratory, and shareable with selected certifiers, retailers, regulators, or the public."
    primaryHref="/join?role=brand"
    primaryLabel="Create a free brand workspace"
    secondaryHref="/submit-report"
    secondaryLabel="Start with an existing PDF"
    problemTitle="A folder of PDFs is not a product evidence system."
    problemCopy="Brands receive reports from multiple laboratories, suppliers, and testing cycles. Filenames drift, values are re-entered, source documents become detached from SKUs, and recipients request the same evidence again. TECRID preserves the source while letting the brand control disclosure."
    proofPoints={[{ value: "SKU", label: "portfolio organization" }, { value: "LOT", label: "evidence-level traceability" }, { value: "1:1", label: "recipient-bound sharing" }]}
    benefits={[
      { label: "Portfolio", title: "Find every report by product, lot, laboratory, or analyte.", copy: "Structured fields make evidence review and trend analysis possible without flattening the underlying laboratory record." },
      { label: "Supplier evidence", title: "Distinguish declarations from laboratory findings.", copy: "A supplier statement and an analytical result remain separate signed evidence objects connected to the same physical lot and custody context." },
      { label: "Disclosure", title: "Choose public, controlled, or private visibility.", copy: "A brand can publish a record, grant one recipient a narrow result package, or keep the evidence private. A requester cannot change that choice." },
      { label: "Applications", title: "Submit identifiers instead of re-uploading documents.", copy: "Certification and retailer applications can receive a TECRID list, CSV, API payload, or recipient-bound share code." },
    ]}
    workflowTitle="From laboratory issuance to governed reuse."
    workflow={[
      { title: "The laboratory issues", copy: "The report and structured findings arrive from the verified issuer rather than being recreated by the brand." },
      { title: "The brand organizes", copy: "The TECRID is attached to the correct product, SKU, lot, supplier relationship, and internal review." },
      { title: "The brand authorizes", copy: "The brand selects the recipient, SKU scope, analyte scope, access level, and expiration." },
      { title: "The recipient resolves", copy: "The exact permitted record version arrives with a package fingerprint and immutable receipt." },
    ]}
    boundaryTitle="Control belongs to the evidence owner—not the requester."
    boundaries={["A laboratory-issued record is not rewritten by the brand.", "A private TECRID does not become public because a retailer, certifier, or regulator requests it.", "Trend summaries must preserve links back to the exact underlying TECRIDs.", "TECRID provenance does not turn a passing result into a universal safety or regulatory claim."]}
    ctaTitle="Begin with one product line and its existing reports."
    ctaCopy="Create a free workspace, privately intake historical PDFs, and ask the named laboratory to claim and confirm the reports before any production TECRID is represented as laboratory-issued."
  />;
}
