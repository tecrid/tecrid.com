"use client";

import { useState } from "react";

type ResultRow = {
  analyte: string;
  symbol: string;
  resultText: string;
  unit: string;
  loqText: string;
};

const initialRows: ResultRow[] = [
  { analyte: "Lead", symbol: "Pb", resultText: "", unit: "µg/kg", loqText: "" },
  { analyte: "Cadmium", symbol: "Cd", resultText: "", unit: "µg/kg", loqText: "" },
  { analyte: "Arsenic", symbol: "As", resultText: "", unit: "µg/kg", loqText: "" },
  { analyte: "Mercury", symbol: "Hg", resultText: "", unit: "µg/kg", loqText: "" },
];

export function CredentialForm({ canPublish }: { canPublish: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState<{ identifier: string; status: string } | null>(null);

  function updateRow(index: number, field: keyof ResultRow, value: string) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const results = rows.filter((row) => row.resultText.trim());
    const response = await fetch("/api/credentials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sampleName: form.get("sampleName"),
        lotNumber: form.get("lotNumber"),
        matrix: form.get("matrix"),
        method: form.get("method"),
        submittingParty: form.get("submittingParty"),
        receivedAt: form.get("receivedAt"),
        testedAt: form.get("testedAt"),
        publish: canPublish && form.get("publish") === "on",
        results,
      }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(body.error ?? "Credential creation failed.");
    setCreated(body.credential);
    setMessage(body.credential.status === "issued" ? "The TEC is now publicly resolvable." : "Draft saved. Public issuance remains locked until issuer verification.");
  }

  if (created) {
    return (
      <div className="credential-success">
        <span className="success-seal">✓</span>
        <p className="section-kicker">Credential created</p>
        <h2>{created.identifier}</h2>
        <p>{message}</p>
        <div>
          {created.status === "issued" ? <a className="button-dark" href={`/records/${encodeURIComponent(created.identifier)}`}>Open public record ↗</a> : null}
          <a className="button-outline" href="/dashboard">Return to dashboard →</a>
        </div>
      </div>
    );
  }

  return (
    <form className="credential-form" onSubmit={submit}>
      <section>
        <p className="form-section-number">01</p>
        <div className="form-section-content">
          <h2>Sample context</h2>
          <div className="field-grid">
            <label>Sample name<input name="sampleName" required placeholder="Organic cacao powder" /></label>
            <label>Lot or batch<input name="lotNumber" placeholder="C-240518" /></label>
            <label>Matrix<input name="matrix" placeholder="Food · Powder" /></label>
            <label>Submitting party<input name="submittingParty" placeholder="Optional or withheld" /></label>
            <label>Received date<input name="receivedAt" type="date" /></label>
            <label>Testing completion<input name="testedAt" type="date" /></label>
          </div>
        </div>
      </section>

      <section>
        <p className="form-section-number">02</p>
        <div className="form-section-content">
          <h2>Analytical method</h2>
          <label>Method or method family<input name="method" placeholder="ICP-MS · AOAC 2015.01" /></label>
        </div>
      </section>

      <section>
        <p className="form-section-number">03</p>
        <div className="form-section-content">
          <h2>Results</h2>
          <p>Enter exactly what the laboratory reports. Qualifiers such as “&lt; 10” belong in the result field.</p>
          <div className="result-editor">
            <div className="result-editor-head"><span>Analyte</span><span>Symbol</span><span>Result</span><span>Unit</span><span>LOQ</span></div>
            {rows.map((row, index) => (
              <div className="result-editor-row" key={`${row.analyte}-${index}`}>
                <input aria-label={`Analyte ${index + 1}`} value={row.analyte} onChange={(event) => updateRow(index, "analyte", event.target.value)} />
                <input aria-label={`Symbol ${index + 1}`} value={row.symbol} onChange={(event) => updateRow(index, "symbol", event.target.value)} />
                <input aria-label={`Result ${index + 1}`} value={row.resultText} onChange={(event) => updateRow(index, "resultText", event.target.value)} placeholder="42" />
                <input aria-label={`Unit ${index + 1}`} value={row.unit} onChange={(event) => updateRow(index, "unit", event.target.value)} />
                <input aria-label={`LOQ ${index + 1}`} value={row.loqText} onChange={(event) => updateRow(index, "loqText", event.target.value)} placeholder="10" />
              </div>
            ))}
          </div>
          <button className="add-result" type="button" onClick={() => setRows((current) => [...current, { analyte: "", symbol: "", resultText: "", unit: "µg/kg", loqText: "" }])}>+ Add analyte</button>
        </div>
      </section>

      <section className="issuance-section">
        <p className="form-section-number">04</p>
        <div className="form-section-content">
          <h2>Issuance</h2>
          <div className={`publish-choice ${!canPublish ? "disabled" : ""}`}>
            <input id="publish-credential" name="publish" type="checkbox" disabled={!canPublish} aria-label="Publish as an authoritative TEC" />
            <span><strong>Publish as an authoritative TEC</strong><small>{canPublish ? "The record becomes publicly resolvable and receives a fingerprint." : "Locked until ICS verifies this laboratory issuer."}</small></span>
          </div>
          <p className="issuance-note">Submitting creates an immutable versioned record. Corrections are new revisions, never silent overwrites.</p>
          <button className="button-dark" type="submit" disabled={pending}>{pending ? "Creating credential…" : canPublish ? "Create credential →" : "Save draft credential →"}</button>
          <p className="form-message" role="status">{message}</p>
        </div>
      </section>
    </form>
  );
}
