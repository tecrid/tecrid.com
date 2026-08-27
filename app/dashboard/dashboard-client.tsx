"use client";

import { useState } from "react";

export function OrganizationOnboarding({ email }: { email: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        organizationType: form.get("organizationType"),
        website: form.get("website"),
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error ?? "Organization setup failed.");
      setPending(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form className="onboarding-form" onSubmit={submit}>
      <div className="form-intro">
        <p className="section-kicker">Organization account</p>
        <h2>Create your TEC workspace.</h2>
        <p>Your sign-in identity is <strong>{email}</strong>. Tell us which organization owns this workspace.</p>
      </div>
      <label>Organization name<input name="name" required minLength={2} placeholder="Greenleaf Analytical" /></label>
      <label>Organization type
        <select name="organizationType" defaultValue="laboratory" required>
          <option value="laboratory">Testing laboratory</option>
          <option value="brand">Brand or manufacturer</option>
          <option value="retailer">Retailer or marketplace</option>
          <option value="consultant">Consultant or auditor</option>
          <option value="research">Research organization</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>Website <span>optional</span><input name="website" type="url" placeholder="https://example.com" /></label>
      <div className="form-notice">
        <strong>Laboratory accounts start unverified.</strong>
        <p>You can build draft credentials immediately. Public issuance begins only after ICS verifies the laboratory identity and authority.</p>
      </div>
      <button className="button-dark" type="submit" disabled={pending}>{pending ? "Creating workspace…" : "Create workspace →"}</button>
      <p className="form-message" role="status">{message}</p>
    </form>
  );
}

type KeySummary = {
  id: string;
  label: string;
  keyPrefix: string;
  lastFour: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function ApiKeyPanel({ keys }: { keys: KeySummary[] }) {
  const [newKey, setNewKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: form.get("label") }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(body.error ?? "Could not create API key.");
    setNewKey(body.key.plainTextKey);
    setMessage("Copy this key now. TEC stores only its cryptographic hash.");
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setMessage("Copied. Store it in your secret manager.");
  }

  return (
    <section className="dashboard-panel api-panel" id="api-keys">
      <div className="panel-heading">
        <div><p className="section-kicker">API access</p><h2>Issuer keys</h2></div>
        <a href="/developers">Read API docs ↗</a>
      </div>
      <p className="panel-copy">Keys authenticate your LIMS or reporting workflow. They are displayed once and stored as a one-way hash.</p>
      {newKey ? (
        <div className="new-key-box">
          <span>New live key</span>
          <code>{newKey}</code>
          <button type="button" onClick={copyKey}>Copy key</button>
        </div>
      ) : null}
      <form className="key-form" onSubmit={createKey}>
        <input name="label" aria-label="API key label" placeholder="Production LIMS" maxLength={60} />
        <button type="submit" disabled={pending}>{pending ? "Creating…" : "Create API key"}</button>
      </form>
      <p className="form-message" role="status">{message}</p>
      <div className="key-list">
        {keys.length ? keys.map((key) => (
          <div key={key.id}>
            <span className={`key-state ${key.revokedAt ? "revoked" : ""}`}>{key.revokedAt ? "Revoked" : "Active"}</span>
            <strong>{key.label}</strong>
            <code>{key.keyPrefix}••••••{key.lastFour}</code>
            <small>Created {new Date(key.createdAt).toLocaleDateString()} · {key.lastUsedAt ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : "Never used"}</small>
          </div>
        )) : <p className="empty-state">No API keys yet.</p>}
      </div>
    </section>
  );
}
