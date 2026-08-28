import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import { getLegacyReportForUser } from "../../../../lib/legacy-reports";
import { ProductFooter, ProductNav } from "../../../site-nav";
import { TranscriptionCorrectionForm } from "./transcription-correction-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private report intake — TEC Registry",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ reportId: string }> };

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export default async function LegacyReportPage({ params }: PageProps) {
  const { reportId } = await params;
  const user = await requireChatGPTUser(`/dashboard/reports/${encodeURIComponent(reportId)}`);
  const bundle = await getLegacyReportForUser(user, decodeURIComponent(reportId));
  if (!bundle) notFound();
  const { report, results, events, submitter, issuer } = bundle;
  return (
    <main className="product-page private-report-page">
      <ProductNav compact />
      <header className="record-page-hero private-record-hero">
        <div><p className="section-kicker light">Private evidence intake</p><h1>{report.id}</h1><p>{statusLabel(report.status)} · submitted {new Date(report.createdAt).toLocaleString()}</p></div>
        <span className={`record-status record-${report.status}`}>{statusLabel(report.status)}</span>
      </header>
      <section className="private-report-shell">
        <div className="private-state-banner"><strong>{report.status === "issued" ? "Laboratory-confirmed TECRID issued" : "No public TECRID has been issued"}</strong><span>{report.status === "issued" ? "The source fingerprint is bound into the signed credential." : "This remains a private submission until the named laboratory completes every gate."}</span></div>
        {report.discrepancyNote ? <div className="discrepancy-banner"><strong>Laboratory response</strong><p>{report.discrepancyNote}</p></div> : null}
        <div className="private-report-summary">
          <article><span>Sample</span><strong>{report.sampleName}</strong><small>{report.lotNumber || "No lot supplied"}</small></article>
          <article><span>Submitted by</span><strong>{submitter?.name || "Unavailable"}</strong><small>{report.submittedByUserId === user.userId ? "You submitted this document" : "Submitting organization"}</small></article>
          <article><span>Named laboratory</span><strong>{issuer?.name || report.laboratoryName}</strong><small>{issuer ? `Claimed · ${issuer.issuerStatus.replaceAll("_", " ")}` : `Invited: ${report.confirmationEmail}`}</small></article>
        </div>
        <div className="document-proof-panel">
          <div><span>Private source document</span><strong>{report.sourceFilename}</strong><small>{(report.sourceSize / 1024).toFixed(1)} KB · never publicly rehosted by default</small></div>
          <div><span>Immutable source fingerprint</span><code>sha256:{report.sourceSha256}</code><small>Calculated from the uploaded bytes before the intake record was written</small></div>
          <a href={`/api/legacy-reports/${encodeURIComponent(report.id)}/document`} target="_blank" rel="noreferrer">Open authorized PDF ↗</a>
        </div>
        <div className="report-facts-grid">
          <div><span>Report / test</span><strong>{report.reportNumber || "Not supplied"}</strong></div>
          <div><span>Order</span><strong>{report.orderNumber || "Not supplied"}</strong></div>
          <div><span>Matrix</span><strong>{report.matrix || "Not supplied"}</strong></div>
          <div><span>Method</span><strong>{report.method || "Per finding"}</strong></div>
          <div><span>Received</span><strong>{report.receivedAt || "Not supplied"}</strong></div>
          <div><span>Tested</span><strong>{report.testedAt || "Not supplied"}</strong></div>
        </div>
        <div className="public-results private-results">
          <div className="results-note"><span>Submitted transcription</span><small>Not laboratory-confirmed until signed issuance</small></div>
          <table><thead><tr><th>Analyte</th><th>Exact result</th><th>Unit</th><th>LOQ / LOD</th><th>Method</th></tr></thead>
            <tbody>{results.map((row) => <tr key={row.id}><td><i className="element-badge">{row.symbol || "—"}</i><strong>{row.analyte}</strong></td><td className="result-value">{row.resultText}</td><td>{row.unit}</td><td>{row.loqText || "—"}</td><td>{row.method || report.method || "—"}</td></tr>)}</tbody>
          </table>
        </div>
        {report.issuedCredentialIdentifier ? <div className="issued-link-panel"><div><span>Issued credential</span><strong>{report.issuedCredentialIdentifier}</strong></div><a className="button-dark" href={`/records/${encodeURIComponent(report.issuedCredentialIdentifier)}`}>Resolve public TECRID →</a></div> : null}
        {["awaiting_lab_claim", "needs_submitter_correction"].includes(report.status) && bundle.membership?.organization.id === report.submittingOrganizationId ? (
          <TranscriptionCorrectionForm
            report={{
              id: report.id,
              sampleName: report.sampleName,
              lotNumber: report.lotNumber,
              matrix: report.matrix,
              method: report.method,
              reportNumber: report.reportNumber,
              orderNumber: report.orderNumber,
              collectedAt: report.collectedAt,
              receivedAt: report.receivedAt,
              testedAt: report.testedAt,
              releasedAt: report.releasedAt,
            }}
            initialResults={results.map((row) => ({
              analyte: row.analyte,
              symbol: row.symbol ?? "",
              resultText: row.resultText,
              unit: row.unit,
              loqText: row.loqText ?? "",
              method: row.method ?? "",
            }))}
          />
        ) : null}
      </section>
      <section className="legacy-timeline">
        <div><p className="section-kicker">Append-only activity</p><h2>Custody and confirmation history</h2></div>
        <ol>{events.map((event) => <li key={event.id}><span>{new Date(event.createdAt).toLocaleString()}</span><strong>{event.eventType.replaceAll(".", " · ").replaceAll("_", " ")}</strong></li>)}</ol>
      </section>
      <ProductFooter />
    </main>
  );
}
