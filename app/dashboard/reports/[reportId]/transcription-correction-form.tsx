"use client";

import { useState } from "react";

type InitialReport = {
  id: string;
  sampleName: string;
  lotNumber: string | null;
  matrix: string | null;
  method: string | null;
  reportNumber: string | null;
  orderNumber: string | null;
  collectedAt: string | null;
  receivedAt: string | null;
  testedAt: string | null;
  releasedAt: string | null;
};

type ResultRow = {
  analyte: string;
  symbol: string;
  resultText: string;
  unit: string;
  loqText: string;
  method: string;
};

export function TranscriptionCorrectionForm({ report, initialResults }: {
  report: InitialReport;
  initialResults: ResultRow[];
}) {
  const [rows, setRows] = useState(initialResults);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  function updateRow(index: number, field: keyof ResultRow, value: string) {
    setRows((current) => current.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [field]: value } : row,
    ));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    const response = await fetch(`/api/legacy-reports/${encodeURIComponent(report.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, results: rows }),
    });
    const result = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(result.error ?? "Correction failed.");
    setMessage("Correction recorded. Returning the report to laboratory review…");
    window.location.reload();
  }

  return (
    <section className="transcription-correction-panel">
      <p className="section-kicker">Submitter correction gate</p>
      <h2>Correct the transcription—never the source file.</h2>
      <p>The PDF fingerprint remains immutable. Every corrected field is recorded as a new activity event and returned to the laboratory for another decision.</p>
      <form onSubmit={submit}>
        <div className="form-pair">
          <label>Sample name<input name="sampleName" defaultValue={report.sampleName} required /></label>
          <label>Lot number<input name="lotNumber" defaultValue={report.lotNumber ?? ""} /></label>
        </div>
        <div className="form-pair">
          <label>Report / test number<input name="reportNumber" defaultValue={report.reportNumber ?? ""} /></label>
          <label>Order number<input name="orderNumber" defaultValue={report.orderNumber ?? ""} /></label>
        </div>
        <div className="form-pair">
          <label>Matrix<input name="matrix" defaultValue={report.matrix ?? ""} /></label>
          <label>Overall method<input name="method" defaultValue={report.method ?? ""} /></label>
        </div>
        <div className="form-triplet report-date-grid">
          <label>Collected<input name="collectedAt" type="date" defaultValue={report.collectedAt ?? ""} /></label>
          <label>Received<input name="receivedAt" type="date" defaultValue={report.receivedAt ?? ""} /></label>
          <label>Tested<input name="testedAt" type="date" defaultValue={report.testedAt ?? ""} /></label>
          <label>Released<input name="releasedAt" type="date" defaultValue={report.releasedAt ?? ""} /></label>
        </div>
        <div className="result-entry-list">
          {rows.map((row, index) => (
            <div className="result-entry" key={index}>
              <span className="result-entry-number">{String(index + 1).padStart(2, "0")}</span>
              <label>Analyte<input value={row.analyte} onChange={(event) => updateRow(index, "analyte", event.target.value)} required /></label>
              <label>Symbol<input value={row.symbol} onChange={(event) => updateRow(index, "symbol", event.target.value)} /></label>
              <label>Exact result<input value={row.resultText} onChange={(event) => updateRow(index, "resultText", event.target.value)} required /></label>
              <label>Unit<input value={row.unit} onChange={(event) => updateRow(index, "unit", event.target.value)} required /></label>
              <label>LOQ / LOD<input value={row.loqText} onChange={(event) => updateRow(index, "loqText", event.target.value)} /></label>
              <label>Method<input value={row.method} onChange={(event) => updateRow(index, "method", event.target.value)} /></label>
              {rows.length > 1 ? <button type="button" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button> : null}
            </div>
          ))}
        </div>
        <button className="add-result-button" type="button" onClick={() => setRows((current) => [...current, { analyte: "", symbol: "", resultText: "", unit: "", loqText: "", method: "" }])}>+ Add finding</button>
        <button className="button-dark" type="submit" disabled={pending}>{pending ? "Recording correction…" : "Return corrected transcription to laboratory →"}</button>
        <p className="form-message" role="status">{message}</p>
      </form>
    </section>
  );
}
