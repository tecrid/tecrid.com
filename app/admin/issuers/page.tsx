import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { isIcsAdmin, listIssuerApplicationsForAdmin } from "../../../lib/tec";
import { ProductFooter, ProductNav } from "../../site-nav";
import { ReviewControls, VerificationCheckControl } from "./review-controls";

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
        <div className="admin-switcher"><strong>Issuer applications</strong><a href="/admin/reports">Report intake audit</a><a href="/admin/founding">Founding launches</a></div>
        {applications.length ? applications.map(({ application, organizationName, organizationWebsite, issuerCode, issuerStatus, documents, checks }) => {
          const checkByType = new Map(checks.map((check) => [check.checkType, check]));
          const required = ["identity", "accreditation", "scope", "key_control", "conformance"];
          const approvalReady = required.every((checkType) => checkByType.get(checkType)?.status === "passed");
          return (
          <article key={application.id}>
            <header><div><span>{issuerCode}</span><h2>{organizationName}</h2><p>{application.legalName}</p></div><span className={`record-status record-${application.status}`}>{application.status.replaceAll("_", " ")}</span></header>
            <dl>
              <div><dt>Laboratory address</dt><dd>{application.laboratoryAddress}</dd></div>
              <div><dt>Contact</dt><dd>{application.contactName} · {application.contactEmail}</dd></div>
              <div><dt>Website</dt><dd>{application.laboratoryWebsite || organizationWebsite || "Not supplied"}</dd></div>
              <div><dt>Authority role</dt><dd>{application.authorityRole || "Not supplied"}</dd></div>
              <div><dt>Accreditation</dt><dd>{application.accreditationStatus.replaceAll("_", " ")} · {application.accreditationBody || "No body claimed"}{application.accreditationNumber ? ` · ${application.accreditationNumber}` : ""}{application.accreditationUrl ? <small><a href={application.accreditationUrl} target="_blank" rel="noreferrer">Open public accreditation record ↗</a></small> : null}</dd></div>
              <div><dt>Requested scope</dt><dd>{application.scopeSummary}</dd></div>
              <div><dt>Methods</dt><dd>{application.methodFamilies}</dd></div>
              <div><dt>Signing key</dt><dd>{application.keyId ? <><code>{application.keyId}</code><small>{application.keyAlgorithm} public JWK submitted</small></> : "Not submitted"}</dd></div>
              <div><dt>Current issuer state</dt><dd>{issuerStatus.replaceAll("_", " ")}</dd></div>
            </dl>
            <section className="admin-evidence-register">
              <div><span>Private evidence</span><strong>{documents.length} document{documents.length === 1 ? "" : "s"}</strong></div>
              {documents.map((document) => <a key={document.id} href={`/api/issuer-application/evidence/${encodeURIComponent(document.id)}`} target="_blank" rel="noreferrer"><strong>{document.documentType.replaceAll("_", " ")}</strong><span>{document.filename}</span><code>{document.sha256.slice(0, 12)}…{document.sha256.slice(-8)}</code></a>)}
            </section>
            <section className="admin-verification-checks">
              <VerificationCheckControl applicationId={application.id} checkType="identity" label="Legal entity, website and authorized representative" status={checkByType.get("identity")?.status ?? "pending"} note={checkByType.get("identity")?.evidenceNote ?? ""} />
              <VerificationCheckControl applicationId={application.id} checkType="accreditation" label="Accreditation or comparable competence evidence" status={checkByType.get("accreditation")?.status ?? "pending"} note={checkByType.get("accreditation")?.evidenceNote ?? ""} />
              <VerificationCheckControl applicationId={application.id} checkType="scope" label="Approved matrices, analytes, methods and exclusions" status={checkByType.get("scope")?.status ?? "pending"} note={checkByType.get("scope")?.evidenceNote ?? ""} />
              {(["key_control", "conformance"] as const).map((checkType) => <article className="verification-check-control system-check" key={checkType}><header><div><span>system verified</span><strong>{checkType === "key_control" ? "Issuer signing-key control" : "Canonical signing conformance"}</strong></div><i className={`gate-status gate-${checkByType.get(checkType)?.status ?? "pending"}`}>{checkByType.get(checkType)?.status ?? "pending"}</i></header><p>{checkByType.get(checkType)?.evidenceNote || "Awaiting a valid single-use signing challenge from the laboratory."}</p></article>)}
            </section>
            {application.reviewNote ? <p className="admin-review-note"><strong>Review note</strong>{application.reviewNote}</p> : null}
            {application.status === "submitted" ? <ReviewControls applicationId={application.id} approvalReady={approvalReady} /> : null}
          </article>
          );
        }) : <div className="empty-registry"><strong>No issuer applications.</strong><p>Submitted applications will appear here with their complete review record.</p></div>}
      </section>
      <ProductFooter />
    </main>
  );
}
