"use client";

import { useMemo, useState } from "react";

export function BadgeBuilder({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [message, setMessage] = useState("Enter your TECRID organization code to generate the linked badge.");
  const normalizedCode = useMemo(() => code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24), [code]);
  const profileUrl = `https://tecrid.com/participants/${encodeURIComponent(normalizedCode || "YOUR-CODE")}`;
  const badgeUrl = "https://tecrid.com/brand/tecrid-profile-badge.png";
  const signatureHtml = `<a href="${profileUrl}" title="View this organization's TECRID registry profile" style="text-decoration:none"><img src="${badgeUrl}" width="224" height="52" alt="View TECRID registry profile" style="display:block;width:224px;height:52px;border:0;outline:none;text-decoration:none"></a>`;

  async function copy(value: string, success: string) {
    await navigator.clipboard.writeText(value);
    setMessage(success);
    window.setTimeout(() => setMessage("Your badge stays linked to the same public profile URL."), 2200);
  }

  return (
    <section className="badge-builder" aria-labelledby="badge-builder-title">
      <div className="badge-builder-intro"><p className="section-kicker">Email signature builder</p><h2 id="badge-builder-title">One badge. One durable organization profile.</h2><p>Use the PNG in email clients for broad compatibility. Use the SVG on websites or in print. The image is only meaningful when its link resolves to the organization&apos;s public TECRID profile.</p><a href="/dashboard/sharing">Publish or manage your participant profile →</a></div>
      <div className="badge-builder-card">
        <label htmlFor="badge-code">TECRID organization code</label>
        <input id="badge-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="PFND" autoComplete="off" />
        <div className="signature-preview"><span>Email signature preview</span><a href={profileUrl} target="_blank" rel="noreferrer"><img src="/brand/tecrid-profile-badge.svg" width="224" height="52" alt="View TECRID registry profile" /></a></div>
        <div className="badge-profile-url"><span>Profile destination</span><code>{profileUrl}</code></div>
        <div className="badge-copy-actions"><button type="button" disabled={!normalizedCode} onClick={() => void copy(signatureHtml, "Email-signature HTML copied.")}>Copy email-signature HTML</button><button type="button" disabled={!normalizedCode} onClick={() => void copy(profileUrl, "Profile link copied.")}>Copy profile link</button></div>
        <p aria-live="polite">{message}</p>
        <div className="badge-downloads"><span>Official artwork</span><a href="/brand/tecrid-profile-badge.png" download>PNG for email ↓</a><a href="/brand/tecrid-profile-badge.svg" download>SVG for web or print ↓</a><a href="/brand/tecrid-id.svg" download>Roundel SVG ↓</a></div>
      </div>
    </section>
  );
}
