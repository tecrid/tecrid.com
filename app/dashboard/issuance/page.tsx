import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getDashboardData } from "../../../lib/tec";
import { ProductNav, ProductFooter } from "../../site-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Laboratory issuance readiness — TECRID", robots: { index: false } };

const gates = [
  ["identity", "Legal identity and authority", "Laboratory owner", "Legal entity, operating site, authorized representative and authority evidence."],
  ["accreditation", "Competence evidence", "Laboratory quality manager", "Current accreditation certificate and scope, or documented comparable competence evidence."],
  ["scope", "Analytical scope", "Laboratory quality manager + ICS reviewer", "Matrices, analytes, methods, performing sites and exclusions for the reports being issued."],
  ["key_control", "Signing key control", "Laboratory signing owner", "Register the public Ed25519 key and sign the single-use challenge locally."],
  ["conformance", "Signing conformance", "Laboratory integration owner", "Sign the canonical test payload exactly; ICS must record conformance before approving issuance."],
] as const;

export default async function IssuanceReadiness() {
  const user = await requireChatGPTUser("/dashboard/issuance");
  const data = await getDashboardData(user.userId);
  if (!data) redirect("/dashboard");
  return <main className="product-page"><ProductNav compact />
    <header className="form-page-header"><div><p className="section-kicker light">Laboratory issuance</p><h1>Review a report. Sign its evidence.</h1><p>{data.organization.name} · {data.organization.issuerStatus === "verified" ? "Issuer authority active" : "Production issuance locked pending issuer approval"}</p></div></header>
    <section className="legacy-intake-shell">
      <div className="dashboard-panel"><h2>Accountability and outstanding inputs</h2><p>Workspace owner: {data.organization.ownerEmail}. Application status: {data.issuerApplication?.status ?? "Not submitted"}. Checks below reflect this workspace only; a workspace name is not proof of laboratory identity.</p>
        {gates.map(([type, title, owner, inputs]) => {
          const check = data.issuerChecks.find(item => item.checkType === type);
          return <article key={type} style={{padding:"18px 0", borderBottom:"1px solid #ddd"}}><h3>{title} · {check?.status ?? "Not started"}</h3><p>Responsible: {owner}</p><p>{inputs}</p>{check ? <p>Reviewer: {check.reviewedByEmail || "Unassigned"}. Review note: {check.evidenceNote || "No note recorded"}</p> : <p>Outstanding: submit evidence and complete this check.</p>}</article>;
        })}
        <p><a className="button-dark" href="/dashboard#laboratory-verification">Open issuer application →</a></p>
      </div>
      <div className="dashboard-panel"><h2>Existing reports, without a LIMS integration</h2><p><a href="/sample-lab">Open the Kasandrinos sample-lab integration →</a></p><ol><li>Import an editable JSON draft and attach the unchanged original PDF. Review sample, lot, dates, units, qualifiers and detection limits.</li><li>Choose the confirmed laboratory contact. The private intake creates a secure review link; it does not contact anyone automatically.</li><li>The invited laboratory signs in, claims the report, checks the original and flags any discrepancy.</li><li>After issuer approval, the laboratory signs locally. This legacy flow publishes findings publicly only with explicit disclosure authorization; the source PDF remains private.</li><li>Share the issued resolver URL with Kasandrinos. The credential issuance date is separate from the historical testing and release dates.</li></ol><a className="button-dark" href="/dashboard/reports/new">Prepare a private report →</a></div>
      <div className="dashboard-panel"><h2>Future reports and restricted findings</h2><p><a className="button-dark" href="/downloads/laboratory-connector.zip" download>Download laboratory connector and installation guide</a></p><p>Use a dedicated laboratory connector key. Reserve with a stable idempotency key, render the TECRID on a new report, fingerprint the final PDF, review and sign locally, then finalize. Restricted findings require the brand-controlled routing authorization and product SKU before reservation.</p><p><a href="/dashboard/settings#api-keys">Create scoped API key</a> · <a href="/dashboard/evidence-routing">Set up controlled routing</a> · <a href="/developers">API reference</a></p><p>Before the first production report: name the lab reviewer and signing owner, confirm the brand account and disclosure authority, and record the report system/export format. Do not reuse historical reports as new tests or invent sampling/custody identifiers.</p></div>
    </section><ProductFooter /></main>;
}
