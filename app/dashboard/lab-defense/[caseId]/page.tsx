import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import { getDisputeCaseForUser } from "../../../../lib/lab-defense";
import { ProductFooter, ProductNav } from "../../../site-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dispute evidence case — TEC Registry" };
type RouteContext = { params: Promise<{ caseId: string }> };
type Comparison = { comparisonStatus: string; context: Array<{ field: string; left: unknown; right: unknown; state: string }>; analytes: Array<{ analyte: string; left: { resultText: string; unit: string }; right: { resultText: string; unit: string }; unitCompatibility: string; foldDifference: number | null }>; missingContext: string[]; boundary: string };

export default async function DisputeCasePage({ params }: RouteContext) {
  const { caseId } = await params;
  const user = await requireChatGPTUser(`/dashboard/lab-defense/${caseId}`);
  const record = await getDisputeCaseForUser(user, caseId);
  if (!record) notFound();
  const comparison = JSON.parse(record.comparisonJson) as Comparison;
  return (
    <main className="product-page dispute-detail-page"><ProductNav compact /><header className="record-page-hero dispute-detail-hero"><div><p className="section-kicker light">Dispute evidence case</p><h1>{record.title}</h1><p>{record.purpose || "Structured report comparison and evidence handoff"}</p></div><span className="workspace-code">Status <strong>{comparison.comparisonStatus.replaceAll("_", " ")}</strong></span></header>
      <div className="dispute-detail-shell">
        <section className="dispute-boundary"><strong>No automatic winner</strong><p>{comparison.boundary}</p></section>
        <section className="dispute-identifiers"><article><span>Record A</span><a href={`/records/${encodeURIComponent(record.leftCredentialIdentifier)}`}>{record.leftCredentialIdentifier} ↗</a></article><article><span>Record B</span><a href={`/records/${encodeURIComponent(record.rightCredentialIdentifier)}`}>{record.rightCredentialIdentifier} ↗</a></article><article><span>Evidence fingerprint</span><code>{record.evidenceFingerprint}</code></article></section>
        <section className="dispute-table-panel"><div className="panel-heading"><div><p className="section-kicker">Context alignment</p><h2>Are these reports describing the same thing?</h2></div></div><div className="dispute-context-table">{comparison.context.map((row) => <div key={row.field}><strong>{row.field}</strong><span>{String(row.left || "Not recorded")}</span><span>{String(row.right || "Not recorded")}</span><i className={`context-${row.state}`}>{row.state}</i></div>)}</div></section>
        <section className="dispute-table-panel"><div className="panel-heading"><div><p className="section-kicker">Overlapping analytes</p><h2>Values side by side</h2></div></div><div className="dispute-context-table analyte-table"><div className="table-head"><strong>Analyte</strong><span>Record A</span><span>Record B</span><i>Review</i></div>{comparison.analytes.length ? comparison.analytes.map((row) => <div key={row.analyte}><strong>{row.analyte}</strong><span>{row.left.resultText} {row.left.unit}</span><span>{row.right.resultText} {row.right.unit}</span><i>{row.unitCompatibility === "normalized_to_ppb" ? (row.foldDifference ? `${row.foldDifference.toFixed(2)}× spread` : "Comparable units") : "Technical review"}</i></div>) : <div><strong>No overlapping analytes</strong><span>—</span><span>—</span><i>Not comparable</i></div>}</div></section>
        <section className="dispute-missing"><div><p className="section-kicker light">Required technical context</p><h2>A defensible review still needs these records.</h2></div><ul>{comparison.missingContext.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <div className="dispute-download"><p>The downloadable JSON freezes both public records, the comparison output, and this evidence fingerprint. It does not freeze unpublished raw data or laboratory QC files.</p><a className="button-dark" href={`/api/disputes/${record.id}/manifest`}>Download evidence manifest ↓</a></div>
      </div><ProductFooter /></main>
  );
}
