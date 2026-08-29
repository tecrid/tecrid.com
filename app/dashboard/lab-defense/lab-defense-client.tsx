"use client";

import { useState } from "react";

export function LabDefenseClient() {
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [leftIdentifier, setLeftIdentifier] = useState("");
  const [rightIdentifier, setRightIdentifier] = useState("");
  const [message, setMessage] = useState("Use two public TECRIDs. The system compares context and freezes both records into one evidence manifest.");
  const [busy, setBusy] = useState(false);

  async function createCase() {
    setBusy(true);
    setMessage("Resolving both records and building the evidence manifest…");
    try {
      const response = await fetch("/api/disputes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, purpose, leftIdentifier, rightIdentifier }) });
      const body = await response.json() as { result?: { id: string }; error?: string };
      if (!response.ok || !body.result) throw new Error(body.error || "Case creation failed.");
      window.location.assign(`/dashboard/lab-defense/${body.result.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Case creation failed.");
      setBusy(false);
    }
  }

  return (
    <section className="lab-case-builder">
      <div className="lab-case-builder-copy"><p className="section-kicker light">New evidence case</p><h2>Compare what is comparable.<br />Expose what is missing.</h2><p>TECRID normalizes compatible units and lines up report context. A qualified reviewer—not this workflow—interprets method effects, uncertainty, sample representativeness, and compliance.</p><a href="/demo/lab-defense">See a fictional worked example →</a></div>
      <div className="lab-case-form">
        <label>Case title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Lot 24-08 interlaboratory review" /></label>
        <label>Purpose<textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Document the context needed for a technical review." /></label>
        <div className="form-pair"><label>First TECRID<input value={leftIdentifier} onChange={(event) => setLeftIdentifier(event.target.value)} placeholder="TECRID·LABA-26-…" /></label><label>Second TECRID<input value={rightIdentifier} onChange={(event) => setRightIdentifier(event.target.value)} placeholder="TECRID·LABB-26-…" /></label></div>
        <button className="button-mint" type="button" disabled={busy} onClick={() => void createCase()}>{busy ? "Building case…" : "Create evidence case →"}</button>
        <p aria-live="polite">{message}</p>
      </div>
    </section>
  );
}
