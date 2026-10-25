"use client";
import { useState, type FormEvent } from "react";
export function WorkspaceDetailsForm({ returnTo }: { returnTo: string }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); const form = new FormData(event.currentTarget);
    try { const response = await fetch("/api/workspace-details", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("name"), website: form.get("website") }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); location.assign(returnTo); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Check your connection and try again."); setBusy(false); }
  }
  return <form className="onboarding-form" onSubmit={save}><label>Organization name<input name="name" required minLength={2} maxLength={160} autoComplete="organization" /></label><label>Website (optional)<input name="website" type="url" maxLength={300} /></label><button className="button-dark" disabled={busy}>{busy ? "Saving..." : "Save and continue"}</button><p role="status">{message}</p><a href="/dashboard">Back to Home</a></form>;
}
