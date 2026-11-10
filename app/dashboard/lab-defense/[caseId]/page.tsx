import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import { getDisputeCaseForUser } from "../../../../lib/lab-defense";
import { ProductFooter } from "../../../site-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Evidence case | TEC Registry" };
type RouteContext = { params: Promise<{ caseId: string }> };
type ContextRow = { field?: string; left?: unknown; right?: unknown; state?: string };
type AnalyteRow = { analyte?: string; left?: { resultText?: string; unit?: string } | null; right?: { resultText?: string; unit?: string } | null; unitCompatibility?: string; foldDifference?: number | null };

function readComparison(value: string) {
  try {
    let parsed: unknown = JSON.parse(value);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as { comparison?: unknown; comparisonStatus?: unknown; context?: unknown; analytes?: unknown; missingContext?: unknown; boundary?: unknown };
    const source = record.comparison && typeof record.comparison === "object" ? record.comparison as typeof record : record;
    return {
      comparisonStatus: typeof source.comparisonStatus === "string" ? source.comparisonStatus : "not_comparable",
      context: Array.isArray(source.context) ? source.context as ContextRow[] : [],
      analytes: Array.isArray(source.analytes) ? source.analytes as AnalyteRow[] : [],
      missingContext: Array.isArray(source.missingContext) ? source.missingContext.filter((item): item is string => typeof item === "string") : [],
      boundary: typeof source.boundary === "string" ? source.boundary : "This comparison does not decide which laboratory is correct.",
    };
  } catch {
    return null;
  }
}

function shown(value: unknown) {
  if (value == null || value === "") return "Not recorded";
  return String(value);
}

export default async function DisputeCasePage({ params }: RouteContext) {
  const { caseId } = await params;
  const user = await requireChatGPTUser(`/dashboard/lab-defense/${caseId}`);
  const record = await getDisputeCaseForUser(user, caseId);
  if (!record) notFound();
  const comparison = readComparison(record.comparisonJson);
  if (!comparison) {
    return (
      <main className="product-page app-page">
        <header className="app-heading"><p className="section-kicker">Evidence case</p><h1>{record.title}</h1><p>This case could not be read. The stored comparison is incomplete.</p><Link href="/dashboard/lab-defense">Back to evidence cases</Link></header>
        <ProductFooter />
      </main>
    );
  }
  return (
    <main className="product-page app-page">
      <header className="app-heading">
        <p className="section-kicker">Evidence case</p>
        <h1>{record.title}</h1>
        <p>{record.purpose || "Structured report comparison."} Status: {comparison.comparisonStatus.replaceAll("_", " ")}.</p>
      </header>
      <div className="dispute-detail-shell">
        <section className="dispute-boundary"><strong>No automatic winner</strong><p>{comparison.boundary}</p></section>
        <section className="dispute-identifiers">
          <article><span>Record A</span><a href={`/records/${encodeURIComponent(record.leftCredentialIdentifier)}`}>{record.leftCredentialIdentifier}</a></article>
          <article><span>Record B</span><a href={`/records/${encodeURIComponent(record.rightCredentialIdentifier)}`}>{record.rightCredentialIdentifier}</a></article>
        </section>
        <section className="dispute-table-panel">
          <h2>Context</h2>
          {comparison.context.length ? <div className="dispute-context-table">{comparison.context.map((row) => <div key={row.field ?? shown(row.left)}><strong>{row.field || "Field"}</strong><span>{shown(row.left)}</span><span>{shown(row.right)}</span><i className={`context-${row.state || "review"}`}>{row.state || "review"}</i></div>)}</div> : <p>No context rows were stored with this case.</p>}
        </section>
        <section className="dispute-table-panel">
          <h2>Overlapping analytes</h2>
          {comparison.analytes.length ? <div className="dispute-context-table analyte-table">{comparison.analytes.map((row) => <div key={row.analyte ?? "analyte"}><strong>{row.analyte || "Analyte"}</strong><span>{shown(row.left?.resultText)} {row.left?.unit || ""}</span><span>{shown(row.right?.resultText)} {row.right?.unit || ""}</span><i>{row.unitCompatibility === "normalized_to_ppb" ? (row.foldDifference ? `${row.foldDifference.toFixed(2)}x spread` : "Comparable units") : "Technical review"}</i></div>)}</div> : <p>No overlapping analytes were stored with this case.</p>}
        </section>
        {comparison.missingContext.length ? <section className="dispute-missing"><h2>Still needed for a technical review</h2><ul>{comparison.missingContext.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
        <div className="dispute-download"><p>The download freezes both public records and this comparison. It does not decide safety.</p><a className="button-dark" href={`/api/disputes/${record.id}/manifest`}>Download evidence manifest</a></div>
      </div>
      <ProductFooter />
    </main>
  );
}
