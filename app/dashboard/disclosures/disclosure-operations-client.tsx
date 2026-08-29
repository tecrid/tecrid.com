"use client";

import { useMemo, useRef, useState } from "react";

type Organization = {
  id: string;
  name: string;
  slug: string;
  organizationType: string;
};

type ImportRecord = {
  id: string;
  sourceName: string;
  sourceSha256: string;
  status: string;
  rowCount: number;
  readyRows: number;
  blockedRows: number;
  createdAt: string;
};

type BatchRecord = {
  batch: {
    id: string;
    batchCode: string;
    status: string;
    productionDate: string;
    laboratoryName: string;
    labReportNumber: string;
    sourceSha256: string;
    labConfirmed: boolean;
    linkedTecrid: string | null;
    publishedAt: string | null;
  };
  product: { name: string; sku: string; upc: string | null };
};

type ExceptionRecord = {
  row: {
    id: string;
    rowNumber: number;
    productName: string | null;
    batchCode: string | null;
    errors: string | null;
    createdAt: string;
  };
  sourceName: string;
};

const SAMPLE_CSV = `product_name,product_sku,upc,batch_code,production_date,shelf_life_end,laboratory_name,lab_report_number,source_sha256,lead_ppb,lead_loq_ppb,cadmium_ppb,cadmium_loq_ppb,arsenic_ppb,arsenic_loq_ppb,mercury_ppb,mercury_loq_ppb
Pear & Oat Purée,HB-PO-01,012345678901,PO-2026-0821,2026-08-21,2027-08-21,Northstar Laboratory Demonstration,NS-260821-04,4a1f32ce264560dffe6c22f2f58a78ce9c2aa4a2f7c8b0d1e2f3a4b5c6d7e8f9,3.2,1,0.8,0.5,5.4,2,0.4,0.2
Carrot & Sweet Potato,HB-CS-02,012345678918,CS-2026-0822,2026-08-22,2027-08-22,Northstar Laboratory Demonstration,NS-260822-02,8b7e6d5c4a3928171605f4e3d2c1b0a99887766554433221100ffeeddccbbaa9,4.1,1,1.0,0.5,6.8,2,,0.2`;

function errorsFor(record: ExceptionRecord) {
  try {
    return JSON.parse(record.row.errors || "[]") as string[];
  } catch {
    return ["The validation detail could not be read."];
  }
}

export function DisclosureOperationsClient({
  organization,
  imports,
  batches,
  exceptions,
}: {
  organization: Organization;
  imports: ImportRecord[];
  batches: BatchRecord[];
  exceptions: ExceptionRecord[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const counts = useMemo(() => ({
    ready: batches.filter((record) => record.batch.status === "ready_for_review").length,
    published: batches.filter((record) => record.batch.status === "published").length,
    exceptions: exceptions.length,
  }), [batches, exceptions]);

  async function selectFile(file?: File) {
    if (!file) return;
    setSourceName(file.name);
    setCsv(await file.text());
    setMessage(`${file.name} loaded. Run validation when ready.`);
  }

  function loadSample() {
    setCsv(SAMPLE_CSV);
    setSourceName("fictional-ab899-sample.csv");
    setMessage("Fictional sample loaded: one valid row and one blocked row missing mercury.");
  }

  async function runImport() {
    if (!csv) return setMessage("Choose a CSV or load the fictional sample first.");
    setBusy(true);
    setMessage("Validating rows and preserving the import fingerprint…");
    try {
      const response = await fetch("/api/disclosures/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv, sourceName }),
      });
      const body = await response.json() as {
        error?: string;
        result?: { readyRows: number; blockedRows: number };
      };
      if (!response.ok || !body.result) throw new Error(body.error || "Import failed.");
      setMessage(`${body.result.readyRows} row${body.result.readyRows === 1 ? "" : "s"} ready; ${body.result.blockedRows} blocked. Refreshing the operation log…`);
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
      setBusy(false);
    }
  }

  async function publish(batchId: string) {
    setPublishing(batchId);
    setMessage("Running the publication gate…");
    try {
      const response = await fetch(`/api/disclosures/${encodeURIComponent(batchId)}/publish`, {
        method: "POST",
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Publication failed.");
      setMessage("Brand disclosure published. This did not create a laboratory-issued TECRID.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publication failed.");
      setPublishing(null);
    }
  }

  return (
    <div className="disclosure-ops-shell">
      <section className="disclosure-ops-summary" aria-label="Disclosure operation summary">
        <article><span>Source imports</span><strong>{imports.length}</strong><small>Fingerprinted operation logs</small></article>
        <article><span>Ready to review</span><strong>{counts.ready}</strong><small>All required fields present</small></article>
        <article><span>Published</span><strong>{counts.published}</strong><small>Brand disclosure records</small></article>
        <article><span>Exceptions</span><strong>{counts.exceptions}</strong><small>Never silently discarded</small></article>
      </section>

      <section className="disclosure-import-panel">
        <div className="disclosure-panel-heading">
          <div><p className="section-kicker">Production-aggregate intake</p><h2>Import one structured laboratory file.</h2><p>The validation gate checks identity, dates, provenance, SHA-256, and lead, cadmium, arsenic, and mercury before anything can publish.</p></div>
          <a className="button-outline" href="/templates/ab899-production-aggregate-template.csv" download>Download template ↓</a>
        </div>
        <div className="disclosure-import-controls">
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(event) => void selectFile(event.target.files?.[0])} />
          <button type="button" className="button-dark" onClick={() => fileRef.current?.click()}>Choose CSV</button>
          <button type="button" className="button-outline" onClick={loadSample}>Load fictional sample</button>
          <button type="button" className="button-mint" onClick={() => void runImport()} disabled={busy}>{busy ? "Validating…" : "Validate and stage"}</button>
        </div>
        <div className="disclosure-source-state">
          <span>{sourceName || "No source selected"}</span>
          <p aria-live="polite">{message || "Up to 250 production aggregates per import. CSV content is capped at 1 MB."}</p>
        </div>
      </section>

      <section className="disclosure-two-column">
        <div className="disclosure-batch-panel">
          <div className="disclosure-panel-heading compact"><div><p className="section-kicker">Publication queue</p><h2>Validated aggregates</h2></div></div>
          <div className="disclosure-batch-list">
            {batches.length ? batches.map(({ batch, product }) => (
              <article key={batch.id}>
                <div className="disclosure-row-state"><span className={`record-status record-${batch.status}`}>{batch.status.replaceAll("_", " ")}</span><small>{batch.labConfirmed ? "Laboratory confirmed" : "Brand-reported · lab confirmation pending"}</small></div>
                <div><strong>{product.name}</strong><code>{product.sku} · {batch.batchCode}</code><small>{batch.laboratoryName} · {batch.labReportNumber}</small></div>
                <div className="disclosure-row-action">
                  {batch.status === "published" ? <a href={`/disclosures/${organization.slug}/${batch.id}`}>Open public record ↗</a> : <button type="button" onClick={() => void publish(batch.id)} disabled={publishing === batch.id}>{publishing === batch.id ? "Checking…" : "Publish disclosure"}</button>}
                </div>
              </article>
            )) : <div className="empty-state"><strong>No validated aggregates yet.</strong><p>Use the fictional sample to see one row advance and one row stop at the exception gate.</p></div>}
          </div>
        </div>

        <aside className="disclosure-exception-panel">
          <div className="disclosure-panel-heading compact"><div><p className="section-kicker light">Exception inbox</p><h2>Fix what would have disappeared.</h2></div></div>
          <div className="disclosure-exception-list">
            {exceptions.length ? exceptions.map((record) => (
              <article key={record.row.id}>
                <span>Row {record.row.rowNumber} · {record.sourceName}</span>
                <strong>{record.row.productName || "Unnamed product"} · {record.row.batchCode || "No batch"}</strong>
                <ul>{errorsFor(record).map((error) => <li key={error}>{error}</li>)}</ul>
              </article>
            )) : <div className="empty-state dark"><strong>No blocked rows.</strong><p>Validation exceptions will remain here with their source row and reason.</p></div>}
          </div>
        </aside>
      </section>

      <section className="disclosure-output-strip">
        <div><span>01</span><strong>Brand page</strong><small>Human-readable batch record</small></div>
        <div><span>02</span><strong>QR destination</strong><small>Stable canonical URL</small></div>
        <div><span>03</span><strong>JSON endpoint</strong><small>Retailer and procurement reuse</small></div>
        <div><span>04</span><strong>Retention clock</strong><small>Shelf life plus one month</small></div>
        <div><span>05</span><strong>TECRID link</strong><small>Only after laboratory confirmation</small></div>
      </section>
      {counts.published ? <div className="disclosure-feed-actions operator"><span>Portfolio outputs are live</span><a href={`/api/public/disclosures/${organization.slug}`}>Open JSON feed ↗</a><a href={`/api/public/disclosures/${organization.slug}?format=csv`}>Download regulator-ready CSV ↓</a></div> : null}
    </div>
  );
}
