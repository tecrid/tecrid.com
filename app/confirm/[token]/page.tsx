import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getLegacyConfirmation } from "../../../lib/legacy-reports";
import { ProductFooter, ProductNav } from "../../site-nav";
import { LegacyConfirmationControls } from "./confirmation-controls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Laboratory confirmation request — TEC Registry",
  description: "Private laboratory confirmation gate for a submitted historical report.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type PageProps = { params: Promise<{ token: string }> };

export default async function ConfirmLegacyReportPage({ params }: PageProps) {
  const { token } = await params;
  const returnTo = `/confirm/${encodeURIComponent(token)}`;
  const user = await requireChatGPTUser(returnTo);
  const bundle = await getLegacyConfirmation(user, decodeURIComponent(token));
  if (!bundle) notFound();
  const { report, results, submitter, issuer, membership } = bundle;
  const isInvitedEmail = user.email.toLowerCase() === report.confirmationEmail.toLowerCase();
  const claimedByCurrentOrganization = Boolean(
    membership && report.issuerOrganizationId === membership.organization.id,
  );
  return (
    <main className="product-page confirmation-page">
      <ProductNav compact />
      <header className="confirmation-hero">
        <div><p className="section-kicker light">Restricted laboratory gate</p><h1>Confirm the source—not the submitter’s story.</h1><p>{submitter?.name || "A submitting organization"} has asked {report.laboratoryName} to review one exact historical report and its transcription.</p></div>
        <span className="workspace-code">State <strong>{report.status.replaceAll("_", " ")}</strong></span>
      </header>
      <section className="confirmation-shell">
        <div className="confirmation-parties">
          <article><span>Submitted by</span><strong>{submitter?.name || "Unavailable"}</strong><small>Cannot issue or edit laboratory findings</small></article>
          <article><span>Named laboratory</span><strong>{issuer?.name || report.laboratoryName}</strong><small>{issuer ? `Claimed · ${issuer.issuerStatus.replaceAll("_", " ")}` : `Invitation restricted to ${report.confirmationEmail}`}</small></article>
          <article><span>Requested capability</span><strong>{report.matrix || "Matrix not supplied"}</strong><small>{report.method || "Method shown per finding"}</small></article>
        </div>
        <div className="document-proof-panel confirmation-document">
          <div><span>Exact private document</span><strong>{report.sourceFilename}</strong><small>Report {report.reportNumber || "number not supplied"} · Order {report.orderNumber || "not supplied"}</small></div>
          <div><span>SHA-256 fingerprint</span><code>{report.sourceSha256}</code><small>This fingerprint will be included in the signed TECRID payload</small></div>
          {claimedByCurrentOrganization || membership?.organization.id === report.submittingOrganizationId ? <a href={`/api/legacy-reports/${encodeURIComponent(report.id)}/document`} target="_blank" rel="noreferrer">Inspect PDF ↗</a> : <small>Claim access before opening the private PDF</small>}
        </div>
        {report.discrepancyNote ? <div className="discrepancy-banner"><strong>Recorded discrepancy</strong><p>{report.discrepancyNote}</p></div> : null}
        <div className="public-results private-results confirmation-results">
          <div className="results-note"><span>Transcription awaiting laboratory decision</span><small>Compare every qualifier, unit, method, and date with the PDF</small></div>
          <table><thead><tr><th>Analyte</th><th>Exact result</th><th>Unit</th><th>LOQ / LOD</th><th>Method</th></tr></thead>
            <tbody>{results.map((row) => <tr key={row.id}><td><i className="element-badge">{row.symbol || "—"}</i><strong>{row.analyte}</strong></td><td className="result-value">{row.resultText}</td><td>{row.unit}</td><td>{row.loqText || "—"}</td><td>{row.method || report.method || "—"}</td></tr>)}</tbody>
          </table>
        </div>
        <LegacyConfirmationControls
          token={token}
          reportId={report.id}
          status={report.status}
          isInvitedEmail={isInvitedEmail}
          claimedByCurrentOrganization={claimedByCurrentOrganization}
          organizationType={membership?.organization.organizationType ?? null}
          issuerStatus={membership?.organization.issuerStatus ?? null}
          issuedCredentialIdentifier={report.issuedCredentialIdentifier}
        />
      </section>
      <ProductFooter />
    </main>
  );
}
