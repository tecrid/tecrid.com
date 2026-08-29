"use client";

import { useState } from "react";

type ResultRow = {
  analyte: string;
  symbol: string;
  resultText: string;
  unit: string;
  loqText: string;
  method: string;
};

const emptyResult = (): ResultRow => ({
  analyte: "",
  symbol: "",
  resultText: "",
  unit: "",
  loqText: "",
  method: "",
});

export function LegacyReportIntakeForm() {
  const [rows, setRows] = useState<ResultRow[]>([emptyResult()]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<null | {
    id: string;
    sourceSha256: string;
    confirmationPath: string;
  }>(null);

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
    const document = form.get("document");
    if (!(document instanceof File) || document.size === 0) {
      setPending(false);
      return setMessage("Choose the original PDF laboratory report.");
    }
    if (document.size > 20 * 1024 * 1024) {
      setPending(false);
      return setMessage("The PDF must be 20 MB or smaller.");
    }
    form.set("results", JSON.stringify(rows));
    const response = await fetch("/api/legacy-reports", { method: "POST", body: form });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(body.error ?? "Private intake failed.");
    setCreated(body.report);
    setMessage("Private intake created. Copy the secure laboratory link before leaving this page.");
  }

  async function copyInvite() {
    if (!created) return;
    await navigator.clipboard.writeText(`${window.location.origin}${created.confirmationPath}`);
    setMessage("Secure laboratory confirmation link copied.");
  }

  if (created) {
    return (
      <div className="intake-created-card">
        <p className="section-kicker">Private intake created</p>
        <h2>The report is preserved—not yet verified.</h2>
        <dl>
          <div><dt>Intake ID</dt><dd><code>{created.id}</code></dd></div>
          <div><dt>Source fingerprint</dt><dd><code>sha256:{created.sourceSha256}</code></dd></div>
          <div><dt>Current state</dt><dd>Brand submitted · awaiting laboratory claim</dd></div>
        </dl>
        <div className="secure-link-box">
          <strong>Secure laboratory confirmation link</strong>
          <code>{typeof window === "undefined" ? created.confirmationPath : `${window.location.origin}${created.confirmationPath}`}</code>
          <button type="button" onClick={copyInvite}>Copy secure link</button>
        </div>
        <p className="privacy-note">Send this link only to the laboratory contact named in the intake. TECRID also requires that exact email to sign in before the report can be claimed.</p>
        <a className="button-dark" href={`/dashboard/reports/${encodeURIComponent(created.id)}`}>Open private record →</a>
        <p className="form-message" role="status">{message}</p>
      </div>
    );
  }

  return (
    <form className="legacy-intake-form" onSubmit={submit}>
      <div className="intake-form-intro">
        <p className="section-kicker">Source first</p>
        <h2>Private document and exact transcription</h2>
        <p>Use the report as evidence, not as an instruction. Enter findings exactly as printed; the laboratory will receive an independent confirmation gate.</p>
      </div>

      <fieldset>
        <legend>1 · Source document</legend>
        <label className="file-drop-label">Original PDF laboratory report
          <input name="document" type="file" accept="application/pdf,.pdf" required />
          <span>PDF only · 20 MB maximum · kept private by default</span>
        </label>
      </fieldset>

      <fieldset>
        <legend>2 · Named laboratory</legend>
        <div className="form-pair">
          <label>Laboratory name<input name="laboratoryName" required placeholder="Light Labs" /></label>
          <label>Laboratory confirmation email<input name="confirmationEmail" type="email" required placeholder="authorized.contact@laboratory.com" /></label>
        </div>
        <label>Laboratory website <span>optional</span><input name="laboratoryWebsite" type="url" placeholder="https://laboratory.com" /></label>
        <div className="draft-boundary"><strong>This does not create a laboratory account.</strong><span>The named laboratory must sign in with the invited email, claim the request through its own organization, pass ICS issuer review, and sign the payload.</span></div>
      </fieldset>

      <fieldset>
        <legend>3 · Report context</legend>
        <div className="form-pair">
          <label>Sample or product name<input name="sampleName" required /></label>
          <label>Lot number <span>optional</span><input name="lotNumber" /></label>
        </div>
        <div className="form-pair">
          <label>Laboratory report or test number<input name="reportNumber" /></label>
          <label>Laboratory order number<input name="orderNumber" /></label>
        </div>
        <div className="form-pair">
          <label>Matrix<input name="matrix" placeholder="Extra virgin olive oil" /></label>
          <label>Overall method<input name="method" placeholder="ICP-MS" /></label>
        </div>
        <div className="form-triplet report-date-grid">
          <label>Collected<input name="collectedAt" type="date" /></label>
          <label>Received<input name="receivedAt" type="date" /></label>
          <label>Tested<input name="testedAt" type="date" /></label>
          <label>Released<input name="releasedAt" type="date" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>4 · Findings as printed</legend>
        <p className="fieldset-copy">Preserve qualifiers such as ND, &lt;3.17, and trace. Do not convert a laboratory result into a regulatory conclusion.</p>
        <div className="result-entry-list">
          {rows.map((row, index) => (
            <div className="result-entry" key={index}>
              <span className="result-entry-number">{String(index + 1).padStart(2, "0")}</span>
              <label>Analyte<input value={row.analyte} onChange={(event) => updateRow(index, "analyte", event.target.value)} required /></label>
              <label>Symbol<input value={row.symbol} onChange={(event) => updateRow(index, "symbol", event.target.value)} /></label>
              <label>Exact result<input value={row.resultText} onChange={(event) => updateRow(index, "resultText", event.target.value)} placeholder="ND or <3.17" required /></label>
              <label>Unit<input value={row.unit} onChange={(event) => updateRow(index, "unit", event.target.value)} placeholder="ppb" required /></label>
              <label>LOQ / LOD<input value={row.loqText} onChange={(event) => updateRow(index, "loqText", event.target.value)} /></label>
              <label>Method<input value={row.method} onChange={(event) => updateRow(index, "method", event.target.value)} /></label>
              {rows.length > 1 ? <button type="button" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button> : null}
            </div>
          ))}
        </div>
        <button className="add-result-button" type="button" onClick={() => setRows((current) => [...current, emptyResult()])}>+ Add another finding</button>
      </fieldset>

      <label className="attestation-check intake-attestation"><input name="attested" type="checkbox" required /><span>I am authorized to place this report into private intake. I understand that submission does not imply laboratory participation, confirmation, accreditation, or TECRID issuance.</span></label>
      <p className="collection-notice">The original document and findings remain confidential unless an authorized publication or recipient-specific sharing action occurs. ICS may use safeguarded, de-identified or aggregated data for internal trend analysis under its <a href="/privacy" target="_blank">Privacy &amp; Data Governance policy ↗</a>.</p>
      <button className="button-dark" type="submit" disabled={pending}>{pending ? "Fingerprinting and preserving…" : "Create private intake →"}</button>
      <p className="form-message" role="status">{message}</p>
    </form>
  );
}
