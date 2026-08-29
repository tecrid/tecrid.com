"use client";

import { useMemo, useState } from "react";

type Program = { id: string; name: string; publicToken: string; apiTokenPrefix: string; apiTokenLastFour: string; active: boolean; createdAt: string };
export function CertificationClient({ programs }: { programs: Program[] }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("Create one program per certification or evidence request. The API secret is shown only once.");
  const [created, setCreated] = useState<{ name: string; publicToken: string; plainTextApiToken: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const origin = useMemo(() => typeof window === "undefined" ? "https://tecrid.com" : window.location.origin, []);

  async function createProgram() {
    setBusy(true); setCreated(null); setMessage("Creating a submission channel and hashing its API secret…");
    try {
      const response = await fetch("/api/certification/programs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
      const body = await response.json() as { result?: { name: string; publicToken: string; plainTextApiToken: string }; error?: string };
      if (!response.ok || !body.result) throw new Error(body.error || "Program creation failed.");
      setCreated(body.result); setMessage("Program created. Copy the API secret now; TECRID stores only its SHA-256 hash.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Program creation failed."); }
    finally { setBusy(false); }
  }

  return <>
    <section className="certification-channel-builder"><div><p className="section-kicker light">New intake channel</p><h2>One program.<br />Two ways to submit.</h2><p>A share link gives brands a signed-in CSV workflow. A program-scoped API token lets their system send TECRIDs directly.</p></div><div className="certification-create-form"><label>Program name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="ICS contaminant evidence review" /></label><button type="button" className="button-mint" disabled={busy || !name.trim()} onClick={() => void createProgram()}>{busy ? "Creating…" : "Create program →"}</button><p aria-live="polite">{message}</p></div></section>
    {created ? <section className="certification-secret-panel"><div><p className="section-kicker">Created · copy now</p><h2>{created.name}</h2></div><dl><div><dt>Applicant submission link</dt><dd><code>{origin}/certify/{created.publicToken}</code></dd></div><div><dt>One-time API secret</dt><dd><code>{created.plainTextApiToken}</code></dd></div></dl><div className="verification-actions"><a className="button-dark" href={`/certify/${created.publicToken}`}>Open submission form ↗</a><button className="button-outline" type="button" onClick={() => void navigator.clipboard.writeText(created.plainTextApiToken)}>Copy API secret</button></div></section> : null}
    <section className="certification-program-grid"><div className="certification-programs"><div className="panel-heading"><div><p className="section-kicker">Submission programs</p><h2>Share links and scoped API access</h2></div></div>{programs.length ? programs.map((program) => <article key={program.id}><div><strong>{program.name}</strong><small>Created {new Date(program.createdAt).toLocaleDateString()} · {program.active ? "active" : "inactive"}</small></div><code>API secret {program.apiTokenPrefix}••••{program.apiTokenLastFour}</code><a href={`/certify/${program.publicToken}`}>Open link ↗</a></article>) : <div className="empty-state"><strong>No programs yet.</strong><p>Create the first intake channel above.</p></div>}</div><aside className="certification-api-card"><p className="section-kicker light">Applicant API</p><h2>POST /api/v1/certification/submissions</h2><pre><code>{`Authorization: Bearer tec_intake_…\nContent-Type: application/json\n\n{\n  "applicantOrganization": "Example Brand",\n  "applicantName": "Quality Lead",\n  "applicantEmail": "quality@example.com",\n  "submissionReference": "CERT-2026-41",\n  "tecrids": ["TECRID·LAB-26-000001"]\n}`}</code></pre><p>The response returns row-level validation and a manifest fingerprint. API tokens are scoped to one receiving program.</p><a href="/developers#certification-intake">Open API reference →</a></aside></section>
  </>;
}
