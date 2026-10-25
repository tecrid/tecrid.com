"use client";
import { useState } from "react";
type Policy = { termsVersion: string; termsUrl: string; termsRequired: boolean };
export function OrganizationAccessControls({ policy, operator }: { policy: Policy; operator: boolean }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function post(input: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/organization-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      const body = await response.json(); if (!response.ok) throw Error(body.error || "Update failed.");
      setMessage("Saved. Refresh this page to review the current gate.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed."); }
    finally { setBusy(false); }
  }
  return <section className="dashboard-panel notification-settings"><h2>Terms acceptance</h2>
    {policy.termsUrl ? <form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void post({ accepted: form.has("accepted"), termsVersion: policy.termsVersion }); }}><a href={policy.termsUrl} target="_blank" rel="noreferrer">Read terms version {policy.termsVersion}</a><label><input name="accepted" type="checkbox" required />I accept the linked terms for this organization.</label><button disabled={busy}>Record acceptance</button></form> : <p>{policy.termsRequired ? "The required terms document is not configured. Delivery remains gated." : "No terms document is configured. The terms requirement is currently off."}</p>}
    <p role="status" aria-live="polite">{message}</p>
    {operator ? <><h2>ICS operator configuration</h2><form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void post({ action: "configure", termsVersion: form.get("termsVersion"), termsUrl: form.get("termsUrl"), termsRequired: form.has("termsRequired") }); }}><label>Terms version<input name="termsVersion" defaultValue={policy.termsVersion} /></label><label>Existing terms URL<input type="url" name="termsUrl" defaultValue={policy.termsUrl} placeholder="https://" /></label><label><input name="termsRequired" type="checkbox" defaultChecked={policy.termsRequired} />Require current terms acceptance for recipient delivery</label><button disabled={busy}>Save delivery policy</button></form>
    <h2>Identity review</h2><form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void post({ action: "identity", organizationCode: form.get("organizationCode"), verified: form.has("verified"), note: form.get("note") }); }}><label>Organization code<input name="organizationCode" required /></label><label>Identity evidence note<textarea name="note" minLength={10} required /></label><label><input name="verified" type="checkbox" />Identity verified</label><button disabled={busy}>Record identity decision</button></form></> : null}
  </section>;
}
