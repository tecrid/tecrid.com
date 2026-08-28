import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { isIcsAdmin } from "../../../lib/tec";
import { listAllLegacyReportsForAdmin } from "../../../lib/legacy-reports";
import { ProductFooter, ProductNav } from "../../site-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ICS private intake audit — TEC Registry",
  robots: { index: false, follow: false },
};

export default async function LegacyReportAdminPage() {
  const user = await requireChatGPTUser("/admin/reports");
  if (!isIcsAdmin(user)) notFound();
  const reports = await listAllLegacyReportsForAdmin(user);
  return (
    <main className="product-page admin-page">
      <ProductNav compact />
      <header className="dashboard-header"><div><p className="section-kicker light">ICS restricted operation</p><h1>Legacy-report intake audit</h1><p>Private source custody, laboratory claims, discrepancies, and signed issuance</p></div><span className="workspace-code">Intakes <strong>{reports.length}</strong></span></header>
      <section className="admin-application-list legacy-admin-list">
        <div className="admin-switcher"><a href="/admin/issuers">Issuer applications</a><strong>Report intake audit</strong></div>
        {reports.length ? reports.map((report) => (
          <article key={report.id}>
            <header><div><span>{report.id}</span><h2>{report.sampleName}</h2><p>{report.laboratoryName} · {report.reportNumber || "No report number"}</p></div><span className={`record-status record-${report.status}`}>{report.status.replaceAll("_", " ")}</span></header>
            <dl>
              <div><dt>Source fingerprint</dt><dd><code>sha256:{report.sourceSha256}</code><small>{report.sourceFilename} · {(report.sourceSize / 1024).toFixed(1)} KB</small></dd></div>
              <div><dt>Private custody</dt><dd>{report.documentVisibility}<small>R2 object is never exposed without an authenticated authorization check</small></dd></div>
              <div><dt>Laboratory request</dt><dd>{report.confirmationEmail}<small>Secure-token suffix ····{report.confirmationTokenLastFour}</small></dd></div>
              <div><dt>Issuer organization</dt><dd>{report.issuerOrganizationId || "Not claimed"}<small>{report.claimedAt ? `Claimed ${new Date(report.claimedAt).toLocaleString()}` : "Awaiting laboratory claim"}</small></dd></div>
              <div><dt>Discrepancy</dt><dd>{report.discrepancyNote || "None recorded"}</dd></div>
              <div><dt>Issued TECRID</dt><dd>{report.issuedCredentialIdentifier || "Not issued"}<small>{report.confirmedAt ? `Confirmed ${new Date(report.confirmedAt).toLocaleString()}` : "No signed confirmation"}</small></dd></div>
            </dl>
          </article>
        )) : <div className="empty-registry"><strong>No private report intakes.</strong><p>New submissions will appear here without exposing their PDFs publicly.</p></div>}
      </section>
      <ProductFooter />
    </main>
  );
}
