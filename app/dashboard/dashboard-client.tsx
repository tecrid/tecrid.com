"use client";

import { useState } from "react";
import { RolePicker } from "../role-picker";

export function OrganizationOnboarding(_props: { email: string }) { return <RolePicker onboarding />; }

type KeySummary = { id: string; label: string; scopes?: string; keyPrefix: string; lastFour: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

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
      body: JSON.stringify({ label: form.get("label"), scopes: JSON.parse(String(form.get("scopes"))) }),
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

  async function revokeKey(id: string) {
    if (!window.confirm("Revoke this API key? Existing integrations using it will stop working.")) return;
    setPending(true);
    setMessage("");
    const response = await fetch("/api/keys", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(body.error ?? "Could not revoke API key.");
    setMessage("API key revoked. Reloading…");
    window.location.reload();
  }

  return (
    <section className="dashboard-panel api-panel" id="api-keys">
        <div className="panel-heading">
        <div><p className="section-kicker">API access</p><h2>API keys</h2></div>
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
        <select name="scopes" aria-label="API key permissions" defaultValue='["read"]'>
          <option value='["read"]'>Read only</option>
          <option value='["read","reports:write","credentials:write"]'>Laboratory report connector</option>
          <option value='["read","legacy:write"]'>Private report intake</option>
          <option value='["*"]'>All organization operations</option>
        </select>
        <button type="submit" disabled={pending}>{pending ? "Creating…" : "Create API key"}</button>
      </form>
      <p className="form-message" role="status">{message}</p>
      <div className="key-list">
        {keys.length ? keys.map((key) => (
          <div key={key.id}>
            <span className={`key-state ${key.revokedAt ? "revoked" : ""}`}>{key.revokedAt ? "Revoked" : "Active"}</span>
            <strong>{key.label} · {key.scopes ? JSON.parse(key.scopes).join(", ") : "Legacy access"}</strong>
            <code>{key.keyPrefix}••••••{key.lastFour}</code>
            <small>Created {new Date(key.createdAt).toLocaleDateString()} · {key.lastUsedAt ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : "Never used"}</small>
            {!key.revokedAt ? <button type="button" disabled={pending} onClick={() => revokeKey(key.id)}>Revoke</button> : <span />}
          </div>
        )) : <p className="empty-state">No API keys yet.</p>}
      </div>
    </section>
  );
}
