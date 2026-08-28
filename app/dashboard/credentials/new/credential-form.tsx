"use client";

import { useState } from "react";

export function CredentialDraftForm() {
  const [message, setMessage] = useState("");
  const [tecrid, setTecrid] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/credentials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sampleName: form.get("sampleName"),
        lotNumber: form.get("lotNumber"),
        matrix: form.get("matrix"),
        method: form.get("method"),
        collectedAt: form.get("collectedAt"),
        receivedAt: form.get("receivedAt"),
        testedAt: form.get("testedAt"),
        publish: false,
        results: [
          {
            analyte: form.get("analyte"),
            symbol: form.get("symbol"),
            resultText: form.get("resultText"),
            unit: form.get("unit"),
            loqText: form.get("loqText"),
          },
        ],
      }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(body.error ?? "Draft creation failed.");
    setTecrid(body.credential.tecrid ?? body.credential.identifier);
    setMessage("Draft saved. It is private and has not been represented as issued evidence.");
  }

  return (
    <form className="credential-draft-form" onSubmit={submit}>
      <div className="draft-boundary"><strong>Draft only.</strong><span>Browser-created records cannot be publicly issued. Publication requires a verified laboratory API key and an Ed25519 signature over the canonical payload.</span></div>
      <label>Sample name<input name="sampleName" required placeholder="Organic cacao powder" /></label>
      <div className="form-pair">
        <label>Lot number<input name="lotNumber" placeholder="C-240518" /></label>
        <label>Matrix<input name="matrix" placeholder="Food · Powder" /></label>
      </div>
      <label>Method family<input name="method" placeholder="ICP-MS" /></label>
      <div className="form-triplet">
        <label>Collected<input name="collectedAt" type="datetime-local" /></label>
        <label>Received<input name="receivedAt" type="datetime-local" /></label>
        <label>Tested<input name="testedAt" type="datetime-local" /></label>
      </div>
      <fieldset>
        <legend>First analytical result</legend>
        <div className="form-pair">
          <label>Analyte<input name="analyte" required placeholder="Lead" /></label>
          <label>Symbol<input name="symbol" placeholder="Pb" maxLength={12} /></label>
        </div>
        <div className="form-triplet">
          <label>Reported value<input name="resultText" required placeholder="42" /></label>
          <label>Unit<input name="unit" required placeholder="µg/kg" /></label>
          <label>LOQ<input name="loqText" placeholder="10" /></label>
        </div>
      </fieldset>
      <button className="button-dark" type="submit" disabled={pending}>{pending ? "Saving…" : "Save private draft →"}</button>
      {tecrid ? <p className="new-draft-id"><span>Draft TECRID</span><code>{tecrid}</code></p> : null}
      <p className="form-message" role="status">{message}</p>
    </form>
  );
}
