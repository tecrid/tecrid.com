import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicDisclosureBatch } from "../../../../lib/disclosures";
import { ProductFooter, ProductNav } from "../../../site-nav";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ organizationSlug: string; batchId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { organizationSlug, batchId } = await params;
  const record = await getPublicDisclosureBatch(decodeURIComponent(organizationSlug), decodeURIComponent(batchId));
  if (!record) return { title: "Disclosure not found — TEC Registry" };
  return {
    title: `${record.product.name} · ${record.batch.batchCode} — Analytical disclosure`,
    description: `Published production-aggregate results for ${record.product.name}, ${record.batch.batchCode}.`,
  };
}

export default async function PublicDisclosurePage({ params }: PageProps) {
  const { organizationSlug, batchId } = await params;
  const record = await getPublicDisclosureBatch(decodeURIComponent(organizationSlug), decodeURIComponent(batchId));
  if (!record) notFound();
  const authority = record.batch.labConfirmed
    ? record.batch.linkedTecrid ? "Laboratory-confirmed · TECRID linked" : "Laboratory-confirmed disclosure"
    : "Brand disclosure · laboratory confirmation pending";
  const citation = `${record.organization.name}. “${record.product.name}: production aggregate ${record.batch.batchCode}.” TEC Registry analytical disclosure, published ${record.batch.publishedAt?.slice(0, 10) || "date unavailable"}. https://tecrid.com/disclosures/${record.organization.slug}/${record.batch.id}`;

  return (
    <main className="product-page public-disclosure-page">
      <ProductNav compact />
      <header className="record-page-hero disclosure-detail-hero">
        <div><p className="section-kicker light">Production-aggregate analytical disclosure</p><h1>{record.product.name}</h1><p>{record.organization.name} · {record.product.sku} · batch {record.batch.batchCode}</p></div>
        <span className={record.batch.labConfirmed ? "public-verified" : "public-unverified"}><i /> {authority}</span>
      </header>

      <section className="public-record-shell disclosure-public-record">
        <div className="disclosure-authority-banner">
          <span>Authority</span>
          <strong>{authority}</strong>
          <p>{record.batch.labConfirmed ? "The named laboratory has confirmed this disclosed data." : "The publishing brand attributes these values to the named report. The laboratory has not yet confirmed this registry record."}</p>
        </div>

        <div className="public-record-summary disclosure-record-summary">
          <article><span>Production date</span><strong>{record.batch.productionDate}</strong><small>Aggregate {record.batch.batchCode}</small></article>
          <article><span>Laboratory</span><strong>{record.batch.laboratoryName}</strong><small>Report {record.batch.labReportNumber}</small></article>
          <article><span>Retention through</span><strong>{record.batch.retentionUntil}</strong><small>Shelf life plus one calendar month</small></article>
          <article><span>Credential</span><strong>{record.batch.linkedTecrid || "No TECRID"}</strong><small>{record.batch.linkedTecrid ? "Resolve linked laboratory credential" : "Brand disclosure is not a TECRID"}</small></article>
        </div>

        <div className="disclosure-results-panel">
          <div><p className="section-kicker">Reported analytes</p><h2>Monthly analytical results</h2><p>Values are shown exactly as staged from the source file. No pass/fail or safety conclusion is calculated here.</p></div>
          <div className="results-wrap">
            <table>
              <thead><tr><th>Analyte</th><th>Result</th><th>Unit</th><th>LOQ</th></tr></thead>
              <tbody>{record.results.map((result) => (
                <tr key={result.id}><td><i className="element-badge">{result.symbol}</i><strong>{result.analyte}</strong></td><td className="result-value">{result.resultText}</td><td>{result.unit}</td><td>{result.loqText || "Not provided"}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>

        <div className="provenance-register disclosure-provenance">
          <div><span>Source SHA-256</span><code>{record.batch.sourceSha256}</code></div>
          <div><span>Public JSON</span><a href={`/api/public/disclosures/${record.organization.slug}/${record.batch.id}`}>Open machine-readable record ↗</a></div>
          <div><span>Published</span><strong>{record.batch.publishedAt ? new Date(record.batch.publishedAt).toLocaleDateString() : "Unavailable"}</strong></div>
        </div>

        <div className="disclosure-citation">
          <span>Suggested citation</span><p>{citation}</p>
        </div>
      </section>
      <section className="record-boundary"><p className="section-kicker">Interpretation boundary</p><h2>Disclosure is not a compliance verdict.</h2><p>This record preserves reported analytical data and provenance. It does not determine product safety, regulatory compliance, representative sampling, method suitability, or laboratory competence.</p></section>
      <ProductFooter />
    </main>
  );
}
