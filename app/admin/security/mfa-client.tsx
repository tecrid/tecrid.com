"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export function AdminMfaClient({ enrolled }: { enrolled: boolean }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function post(body: Record<string, string>) {
    setPending(true);
    setMessage("");
    const response = await fetch("/api/admin/mfa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(payload.error ?? "Second factor failed.");
      return null;
    }
    return payload;
  }

  return (
    <section className="dashboard-panel">
      <p className="section-kicker">Admin second factor</p>
      <h2>{enrolled ? "Enter your authentication code." : "Add an authenticator before using admin tools."}</h2>
      <p>ICS admin accounts need the email link and a second factor. Use an authenticator app, or a one-time recovery code.</p>
      {!enrolled && !secret ? <button className="button-dark" type="button" disabled={pending} onClick={() => void post({ action: "enroll" }).then((result) => { if (!result) return; setSecret(result.secret); setOtpauthUrl(result.otpauthUrl); })}>Create authenticator setup</button> : null}
      {secret ? <div className="admin-mfa-setup">{otpauthUrl ? <QRCodeSVG value={otpauthUrl} size={224} marginSize={4} level="M" role="img" title="Scan to set up your TECRID authenticator" /> : null}<div><p>Scan the QR code with your authenticator, or enter this setup key. It is shown once.</p><code>{secret}</code>{otpauthUrl ? <p><a href={otpauthUrl}>Open authenticator setup</a></p> : null}</div></div> : null}
      <form onSubmit={(event) => {
        event.preventDefault();
        const code = String(new FormData(event.currentTarget).get("code") ?? "");
        void post({ action: enrolled ? "verify" : "confirm", code }).then((result) => {
          if (!result) return;
          if (result.recoveryCodes) setRecoveryCodes(result.recoveryCodes);
          else window.location.href = "/admin/issuers";
        });
      }}>
        <label>Authentication or recovery code<input name="code" autoComplete="one-time-code" required /></label>
        <button className="button-dark" type="submit" disabled={pending}>{enrolled ? "Continue" : "Confirm and save recovery codes"}</button>
      </form>
      {recoveryCodes ? <div><p>Save these recovery codes now. Each one works once.</p><ul>{recoveryCodes.map((code) => <li key={code}><code>{code}</code></li>)}</ul><a href="/admin/issuers">Continue to admin tools</a></div> : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
