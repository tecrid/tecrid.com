import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getEvidenceInsightsForUser } from "../../../lib/insights";
import { ProductFooter, ProductNav } from "../../site-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Evidence insights — TEC Registry" };

export default async function InsightsPage() {
  const user = await requireChatGPTUser("/dashboard/insights");
  const { membership, insights } = await getEvidenceInsightsForUser(user);
  return (
    <main className="product-page insights-page">
      <ProductNav compact />
      <header className="dashboard-header insights-hero">
        <div><p className="section-kicker light">Evidence intelligence</p><h1>See the portfolio.<br />Keep every source intact.</h1><p>Deterministic summaries across TECRIDs your organization issued or was authorized to receive. No OCR merge and no silent pass/fail assumptions.</p></div>
        <span className="workspace-code">Workspace <strong>{membership.organization.name}</strong></span>
      </header>
      <div className="insights-shell">
        <section className="dashboard-summary" aria-label="Evidence summary">
          <article><span>TECRIDs</span><strong>{insights.summary.tecrids}</strong><small>Distinct records in scope</small></article>
          <article><span>Result rows</span><strong>{insights.summary.resultRows}</strong><small>Exactly as issued or delivered</small></article>
          <article><span>SKUs</span><strong>{insights.summary.skus}</strong><small>Structured portfolio coverage</small></article>
          <article><span>Scope exceptions</span><strong>{insights.summary.scopeExceptions}</strong><small>Missing requested analytes</small></article>
        </section>
        <section className="insights-grid">
          <div className="insight-panel"><div className="panel-heading"><div><p className="section-kicker">Analyte index</p><h2>What has been measured.</h2></div><span>{insights.summary.analytes} analytes</span></div>{insights.analytes.length ? <div className="insight-table">{insights.analytes.map((item) => <article key={item.name}><div><strong>{item.name}</strong><small>{item.count} result row{item.count === 1 ? "" : "s"} · {item.units.join(", ") || "unit unavailable"}</small></div><div><span>Latest reported</span><strong>{item.latestResult} {item.latestUnit}</strong></div><a href={`/records/${encodeURIComponent(item.latestTecrid)}`}>Resolve ↗</a></article>)}</div> : <div className="empty-state"><strong>No structured findings yet.</strong><p>Issued or routed TECRIDs will populate this index.</p></div>}</div>
          <aside className="insight-panel insight-sku-panel"><p className="section-kicker light">Portfolio map</p><h2>Reports by SKU.</h2>{insights.skus.length ? <ol>{insights.skus.map((item) => <li key={item.sku}><span>{item.sku}</span><strong>{item.count}</strong></li>)}</ol> : <p>No product SKUs are in this workspace yet.</p>}{insights.missingAnalytes.length ? <div className="insight-exception"><strong>Human review</strong><p>Requested but missing somewhere in the delivered scope: {insights.missingAnalytes.join(", ")}.</p></div> : null}</aside>
        </section>
        <section className="insight-panel insight-records"><div className="panel-heading"><div><p className="section-kicker">Evidence register</p><h2>Every source remains resolvable.</h2></div><a href="/dashboard/evidence-routing">Open routing →</a></div>{insights.evidence.length ? <div>{insights.evidence.map((record) => <article key={record.tecrid}><span className="record-status record-issued">{record.source.replaceAll("_", " ")}</span><div><strong>{record.sampleName}</strong><small>{record.productSku || "No SKU"} · {record.results.length} result rows</small></div><code>{record.tecrid}</code><a href={`/records/${encodeURIComponent(record.tecrid)}`}>Resolve ↗</a></article>)}</div> : <div className="empty-state"><strong>No evidence in scope.</strong><p>Laboratory issuance, a controller receipt, or an accepted recipient delivery will appear here.</p></div>}</section>
        <section className="insight-panel insight-records insight-notifications"><div className="panel-heading"><div><p className="section-kicker">Notification center</p><h2>Report and routing events.</h2></div><span>{insights.summary.unreadNotifications} unread</span></div>{insights.notifications.length ? <div>{insights.notifications.map((item) => <article key={item.id}><span className={`record-status record-${item.status === "unread" ? "pending" : "issued"}`}>{item.status}</span><div><strong>{item.title}</strong><small>{item.body}</small></div><code>{new Date(item.createdAt).toLocaleString()}</code>{item.actionPath ? <a href={item.actionPath}>Open ↗</a> : <span />}</article>)}</div> : <div className="empty-state"><strong>No report events yet.</strong><p>Reserved, issued, and routed TECRIDs will create durable in-product notifications here.</p></div>}</section>
        <section className="record-boundary insight-boundary"><p className="section-kicker">Interpretation boundary</p><h2>Portfolio visibility is not a safety decision.</h2><p>{insights.interpretationBoundary}</p></section>
      </div>
      <ProductFooter />
    </main>
  );
}
