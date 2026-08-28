"use client";

import { useState } from "react";
import Link from "next/link";

type ExistingLaunch = {
  contactName: string;
  contactEmail: string;
  primaryGoal: string;
  pilotProduct: string;
  estimatedReportCount: number;
  primaryLaboratories: string | null;
  targetLaunchDate: string | null;
  notes: string | null;
  status: string;
} | null;

export function FoundingLaunchForm({ email, existing }: { email: string; existing: ExistingLaunch }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(Boolean(existing));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/founding-onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contactName: form.get("contactName"),
        contactEmail: form.get("contactEmail"),
        primaryGoal: form.get("primaryGoal"),
        pilotProduct: form.get("pilotProduct"),
        estimatedReportCount: form.get("estimatedReportCount"),
        primaryLaboratories: form.get("primaryLaboratories"),
        targetLaunchDate: form.get("targetLaunchDate"),
        notes: form.get("notes"),
      }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(body.error ?? "Could not save the launch brief.");
    setSaved(true);
    setMessage("Launch brief submitted to the ICS implementation queue.");
  }

  return (
    <form className="founding-launch-form" onSubmit={submit}>
      <div className="founding-form-intro">
        <p className="section-kicker">Founding implementation brief</p>
        <h2>Define the first outcome.</h2>
        <p>This brief turns membership into a specific pilot. ICS can see it in the restricted implementation queue; laboratory verification remains separate.</p>
      </div>

      <div className="form-pair">
        <label>Launch contact<input name="contactName" defaultValue={existing?.contactName ?? ""} required /></label>
        <label>Contact email<input name="contactEmail" type="email" defaultValue={existing?.contactEmail ?? email} required /></label>
      </div>
      <label>First pilot goal
        <select name="primaryGoal" defaultValue={existing?.primaryGoal ?? "historical_reports"} required>
          <option value="historical_reports">Confirm existing laboratory reports</option>
          <option value="supplier_verification">Create a supplier-verification workflow</option>
          <option value="public_portfolio">Launch a public evidence portfolio</option>
          <option value="retailer_procurement">Build a retailer procurement pilot</option>
          <option value="lims_api">Scope LIMS or API issuance</option>
        </select>
      </label>
      <div className="form-pair">
        <label>Product, ingredient, or program<input name="pilotProduct" defaultValue={existing?.pilotProduct ?? ""} placeholder="Kasandrinos olive oil" required /></label>
        <label>Existing reports in first pilot<input name="estimatedReportCount" type="number" min="1" max="5000" defaultValue={existing?.estimatedReportCount ?? 10} required /></label>
      </div>
      <div className="form-pair">
        <label>Primary laboratories <span>optional</span><input name="primaryLaboratories" defaultValue={existing?.primaryLaboratories ?? ""} placeholder="Light Labs" /></label>
        <label>Target public launch <span>optional</span><input name="targetLaunchDate" type="date" defaultValue={existing?.targetLaunchDate ?? ""} /></label>
      </div>
      <label>Context, risks, or desired integrations <span>optional</span><textarea name="notes" rows={6} defaultValue={existing?.notes ?? ""} placeholder="Describe the reporting problem, stakeholders, and what success should look like." /></label>

      <div className="founding-form-actions">
        <button className="button-dark" type="submit" disabled={pending}>{pending ? "Saving…" : saved ? "Update launch brief →" : "Submit launch brief →"}</button>
        <Link className="button-outline" href="/dashboard/reports/new">Upload first private report</Link>
      </div>
      <p className="form-message founding-form-message" role="status">{message}</p>
    </form>
  );
}
