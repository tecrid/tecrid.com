import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { isIcsAdmin, listIssuerApplicationsForAdmin } from "../../../lib/tec";
import { ProductFooter, ProductNav } from "../../site-nav";
import { ReviewControls } from "./review-controls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ICS issuer review — TEC Registry", robots: { index: false, follow: false } };

export default async function IssuerReviewPage() {
  const user = await requireChatGPTUser("/admin/issuers");
  if (!isIcsAdmin(user)) notFound();
  const applications = await listIssuerApplicationsForAdmin(user);
  return (
    <main className="product-page admin-page">
      <ProductNav compact />
      <header className="dashboard-header"><div><p className="section-kicker light">ICS restricted operation</p><h1>Issuer applications</h1><p>Identity, scope, accreditation evidence, and signing-key review</p></div><span className="workspace-code">Applications <strong>{applications.length}</strong></span></header>
      <section className="admin-application-list">
        {applications.length ? applications.map(({ application, organizationName, organizationWebsite, issuerCode, issuerStatus }) => (
          <article key={application.id}>
            <header><div><span>{issuerCode}</span><h2>{organizationName}</h2><p>{application.legalName}</p></div><span className={`record-status record-${application.status}`}>{application.status.replaceAll("_", " ")}</span></header>
            <dl>
              <div><dt>Laboratory address</dt><dd>{application.laboratoryAddress}</dd></div>
              <div><dt>Contact</dt><dd>{application.contactName} · {application.contactEmail}</dd></div>
              <div><dt>Website</dt><dd>{organizationWebsite || "Not supplied"}</dd></div>
              <div><dt>Accreditation</dt><dd>{application.accreditationBody || "Not claimed"}{application.accreditationNumber ? ` · ${application.accreditationNumber}` : ""}</dd></div>
              <div><dt>Requested scope</dt><dd>{application.scopeSummary}</dd></div>
              <div><dt>Methods</dt><dd>{application.methodFamilies}</dd></div>
              <div><dt>Signing key</dt><dd>{application.keyId ? <><code>{application.keyId}</code><small>{application.keyAlgorithm} public JWK submitted</small></> : "Not submitted"}</dd></div>
              <div><dt>Current issuer state</dt><dd>{issuerStatus.replaceAll("_", " ")}</dd></div>
            </dl>
            {application.reviewNote ? <p className="admin-review-note"><strong>Review note</strong>{application.reviewNote}</p> : null}
            {application.status === "submitted" ? <ReviewControls applicationId={application.id} /> : null}
          </article>
        )) : <div className="empty-registry"><strong>No issuer applications.</strong><p>Submitted applications will appear here with their complete review record.</p></div>}
      </section>
      <ProductFooter />
    </main>
  );
}
