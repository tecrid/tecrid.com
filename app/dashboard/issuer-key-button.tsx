"use client";

import { useState } from "react";
import { ISSUER_API_SCOPES } from "../../lib/api-scopes";

export function IssuerKeyButton() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [secret, setSecret] = useState<string | null>(null);

  async function createKey() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "Issuer key", scopes: [...ISSUER_API_SCOPES] }),
      });
      const body = await response.json() as { error?: string; key?: { plainTextKey?: string } };
      if (!response.ok || !body.key?.plainTextKey) throw new Error(body.error || "The issuer key could not be created.");
      setSecret(body.key.plainTextKey);
      setMessage("Copy this key now. It is shown once.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The issuer key could not be created.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="access-form" id="issuer-key">
      <p className="section-kicker">Issuer access</p>
      <h2>Create an issuer API key</h2>
      <p>One click creates a key that can mint TECRIDs, reserve reports, and backfill past reports. Issuing still requires your laboratory signing key.</p>
      {secret ? <div className="new-key-box"><span>New issuer key</span><code>{secret}</code></div> : <button className="button-dark" type="button" disabled={pending} onClick={() => void createKey()}>{pending ? "Creating…" : "Create issuer API key"}</button>}
      {message ? <p className="form-message" role="status">{message}</p> : null}
    </section>
  );
}
