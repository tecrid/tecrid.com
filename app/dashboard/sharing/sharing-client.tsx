"use client";

import { useState } from "react";

type CodeRecord = {
  id: string; label: string; purpose: string; scopeMode: string; scopeValues: string[];
  accessLevel: string; analytes: string[]; tokenPrefix: string; tokenLastFour: string;
  status: string; createdAt: string; expiresAt: string; redeemedAt: string | null;
  recipientName: string; controllerName: string; isController: boolean;
};
type RedemptionRecord = {
  id: string; label: string; purpose: string; accessLevel: string; controllerName: string;
  recipientName: string; recordCount: number; packageFingerprint: string; redeemedAt: string;
  records: Array<{ tecrid: string; sku: string }>;
};
type InvitationRecord = { id: string; laboratoryName: string; laboratoryEmail: string; status: string; createdAt: string; skus: string[] };
type ProfileRecord = { displayName: string; website: string | null; summary: string; isPublic: boolean; participationStatus: string } | null;

export function SharingClient({ organization, codes, redemptions, invitations, profile }: {
  organization: { name: string; code: string; type: string; website: string | null };
  codes: CodeRecord[];
  redemptions: RedemptionRecord[];
  invitations: InvitationRecord[];
  profile: ProfileRecord;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("A code is a one-time bearer credential addressed to one receiving organization. It never grants onward sharing or raw report files by default.");
  const [newCode, setNewCode] = useState<{ plainTextCode: string; recipient: string; expiresAt: string } | null>(null);
  const [mailto, setMailto] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState(false);
  const controller = ["brand", "supplier"].includes(organization.type);
  const recipient = ["certification_body", "retailer", "government"].includes(organization.type);
  const profileUrl = `https://tecrid.com/participants/${encodeURIComponent(organization.code)}`;
  const signatureHtml = `<a href="${profileUrl}" title="View TECRID registry profile" style="text-decoration:none"><img src="https://tecrid.com/brand/tecrid-profile-badge.png" width="224" height="52" alt="View TECRID registry profile" style="display:block;width:224px;height:52px;border:0;outline:none;text-decoration:none"></a>`;

  async function submit(event: React.FormEvent<HTMLFormElement>, endpoint: string) {
    event.preventDefault(); setBusy(true); setMessage("Saving the governed share decision…");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { result?: Record<string, unknown>; error?: string | { message?: string }; receipt?: Record<string, unknown> };
      const errorMessage = typeof body.error === "string" ? body.error : body.error?.message;
      if (!response.ok) throw new Error(errorMessage || "The operation failed.");
      if (body.result?.plainTextCode) setNewCode(body.result as { plainTextCode: string; recipient: string; expiresAt: string });
      if (body.result?.mailto) setMailto(String(body.result.mailto));
      setMessage(body.receipt ? `Redeemed. ${String(body.receipt.recordCount)} scoped record(s) were received with a frozen package fingerprint.` : "Saved. The audit ledger has been updated.");
      if (!body.result?.plainTextCode && !body.result?.mailto) window.setTimeout(() => window.location.reload(), 700);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The operation failed."); }
    finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/evidence-sharing/codes/${id}/revoke`, { method: "POST" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "The code could not be revoked.");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The code could not be revoked."); setBusy(false); }
  }

  async function copyBadge() {
    await navigator.clipboard.writeText(signatureHtml);
    setMessage("Email-signature HTML copied. Paste it into an HTML-capable signature editor.");
  }

  return <div className="sharing-shell">
    <section className="sharing-rule"><p>{message}</p><a href="/participants">Browse public participants →</a></section>

    <section className="sharing-action-grid">
      <form className="sharing-form" onSubmit={(event) => void submit(event, "/api/evidence-sharing/codes")}>
        <div><p className="section-kicker">For brands and ingredient suppliers</p><h2>Create a scoped share code.</h2><p>{controller ? "Name the exact receiving organization, choose the evidence boundary, and set an expiry. The code becomes unusable after its first successful redemption." : "Only a brand or ingredient supplier workspace can create a code. Your account can redeem packages addressed to it."}</p></div>
        <label>Receiving organization code<input name="recipientOrganizationCode" placeholder="HMTC" required /></label>
        <div className="form-pair"><label>Package name<input name="label" placeholder="2026 cacao certification" required /></label><label>Purpose<input name="purpose" placeholder="Initial certification review" required /></label></div>
        <div className="form-pair"><label>Evidence scope<select name="scopeMode" defaultValue="sku_set" onChange={(event) => setPortfolio(event.target.value === "portfolio")}><option value="sku_set">Selected SKUs</option><option value="tecrid_set">Selected TECRIDs</option><option value="portfolio">Entire current portfolio</option></select></label><label>Result access<select name="accessLevel" defaultValue="selected_analytes"><option value="status_only">Status only</option><option value="selected_analytes">Selected analytes</option><option value="full_record">Full structured record</option></select></label></div>
        {!portfolio ? <label>SKUs or TECRIDs <span>one per line or comma-separated</span><textarea name="scopeValues" rows={3} placeholder="CACAO-12OZ&#10;CACAO-2LB" required /></label> : <label className="sharing-confirm"><input type="checkbox" name="confirmPortfolio" value="yes" required /><span>I understand this includes every current TECRID receipt in this workspace. The code expires in no more than 30 days.</span></label>}
        <label>Analytes <span>used only for selected-analyte access</span><input name="analytes" defaultValue="Lead, Cadmium, Arsenic, Mercury" /></label>
        <label>Expires in days<input name="expiresInDays" type="number" min="1" max={portfolio ? 30 : 90} defaultValue="14" /></label>
        <button className="button-dark" type="submit" disabled={busy || !controller}>{controller ? "Create one-time code →" : "Controller workspace required"}</button>
        {newCode ? <div className="sharing-secret"><span>Shown once</span><strong>{newCode.recipient}</strong><code>{newCode.plainTextCode}</code><small>Expires {new Date(newCode.expiresAt).toLocaleDateString()}</small><button type="button" onClick={() => void navigator.clipboard.writeText(newCode.plainTextCode)}>Copy code</button></div> : null}
      </form>

      <div className="sharing-side-stack">
        <form className="sharing-form sharing-redeem" onSubmit={(event) => void submit(event, "/api/v1/share-codes/redeem")}>
          <div><p className="section-kicker light">For certifiers, retailers, and government</p><h2>Redeem evidence without uploading PDFs.</h2><p>{recipient ? `Codes addressed to ${organization.name} resolve into a frozen structured package and receipt.` : "A recipient workspace redeems the code provided by the brand or supplier."}</p></div>
          <input type="hidden" name="recipientOrganizationCode" value={organization.code} />
          <label>TECRID share code<input name="code" type="password" autoComplete="off" placeholder="tec_share_…" required /></label>
          <button className="button-mint" type="submit" disabled={busy || !recipient}>{recipient ? "Redeem package →" : "Recipient workspace required"}</button>
        </form>

        <form className="sharing-form sharing-invite" onSubmit={(event) => void submit(event, "/api/laboratory-invitations")}>
          <div><p className="section-kicker">Lab adoption</p><h2>Ask your lab to issue TECRIDs.</h2><p>Prepare a plain-language email with your organization code and the public integration guide. You review and send it from your own email.</p></div>
          <div className="form-pair"><label>Laboratory name<input name="laboratoryName" required /></label><label>Laboratory email<input name="laboratoryEmail" type="email" required /></label></div>
          <label>Relevant SKUs<input name="productSkus" placeholder="CACAO-12OZ, CACAO-2LB" /></label>
          <label>Message<textarea name="message" rows={3} defaultValue={`${organization.name} would like future laboratory reports delivered as laboratory-issued TECRIDs.`} /></label>
          <button type="submit" disabled={busy || !controller}>{controller ? "Prepare email →" : "Controller workspace required"}</button>
          {mailto ? <a className="button-dark sharing-mailto" href={mailto}>Review in email app →</a> : null}
        </form>
      </div>
    </section>

    <section className="sharing-ledger-grid">
      <div className="sharing-ledger"><div><p className="section-kicker">Share-code ledger</p><h2>Every boundary stays visible.</h2></div>{codes.length ? codes.map((code) => <article key={code.id}><span className={`record-status record-${code.status}`}>{code.status}</span><div><strong>{code.label}</strong><small>{code.controllerName} → {code.recipientName}</small><p>{code.scopeMode.replaceAll("_", " ")} · {code.accessLevel.replaceAll("_", " ")}</p>{code.scopeValues.length ? <code>{code.scopeValues.join(", ")}</code> : <code>Entire current portfolio</code>}</div><div><code>{code.tokenPrefix}••••{code.tokenLastFour}</code><small>Expires {new Date(code.expiresAt).toLocaleDateString()}</small>{code.isController && code.status === "active" ? <button type="button" disabled={busy} onClick={() => void revoke(code.id)}>Revoke</button> : null}</div></article>) : <div className="empty-state"><strong>No share codes yet.</strong><p>Create one only when a recipient and purpose are known.</p></div>}</div>
      <div className="sharing-ledger redemption-ledger"><div><p className="section-kicker light">Redemption receipts</p><h2>What moved, and when.</h2></div>{redemptions.length ? redemptions.map((item) => <article key={item.id}><span className="record-status record-issued">received</span><div><strong>{item.label}</strong><small>{item.controllerName} → {item.recipientName}</small><p>{item.recordCount} record{item.recordCount === 1 ? "" : "s"} · {item.accessLevel.replaceAll("_", " ")}</p>{item.records.map((record) => <code key={record.tecrid}>{record.tecrid} · {record.sku}</code>)}</div><div><small>{new Date(item.redeemedAt).toLocaleString()}</small><code>{item.packageFingerprint.slice(0, 12)}…{item.packageFingerprint.slice(-8)}</code></div></article>) : <div className="empty-state dark"><strong>No redemptions yet.</strong><p>Successful recipient intake creates an immutable package receipt.</p></div>}</div>
    </section>

    <section className="sharing-directory-settings">
      <form className="sharing-form" id="directory-profile" onSubmit={(event) => void submit(event, "/api/participant-profile")}>
        <div><p className="section-kicker">Opt-in network directory</p><h2>Be discoverable on your terms.</h2><p>Public listing is optional. A participant listing describes the organization&apos;s role; it does not imply laboratory verification or endorsement.</p></div>
        <div className="form-pair"><label>Public name<input name="displayName" defaultValue={profile?.displayName ?? organization.name} required /></label><label>Website<input name="website" type="url" defaultValue={profile?.website ?? organization.website ?? ""} /></label></div>
        <label>Public description<textarea name="summary" rows={3} defaultValue={profile?.summary ?? ""} /></label>
        <label className="sharing-confirm"><input type="checkbox" name="isPublic" defaultChecked={profile?.isPublic ?? false} /><span>List this organization in the public TECRID participant directory.</span></label>
        <button type="submit" disabled={busy}>Save directory preference →</button>
      </form>
      <div className="sharing-profile-card">
        <p className="section-kicker light">Portable organization profile</p>
        <h2>Put TECRID in your signature.</h2>
        <p>{profile?.isPublic ? "Your public profile is ready to receive visitors from email signatures, proposals, and your website." : "Publish the optional participant profile before using the badge. Private evidence remains private."}</p>
        <a className="sharing-badge-preview" href={profile?.isPublic ? profileUrl : "/badge"}><img src="/brand/tecrid-profile-badge.svg" width="224" height="52" alt="View TECRID registry profile" /></a>
        {profile?.isPublic ? <><code>{profileUrl}</code><button type="button" onClick={() => void copyBadge()}>Copy email-signature HTML →</button><a href={`/badge?code=${encodeURIComponent(organization.code)}`}>Badge downloads and instructions →</a></> : <a href="#directory-profile">Publish your profile above →</a>}
      </div>
      <div className="sharing-invitation-history"><p className="section-kicker light">Prepared lab requests</p><h2>Adoption history</h2>{invitations.length ? invitations.map((invite) => <article key={invite.id}><strong>{invite.laboratoryName}</strong><span>{invite.laboratoryEmail}</span><small>{invite.skus.join(", ") || "No SKU limit"} · {new Date(invite.createdAt).toLocaleDateString()}</small></article>) : <p>No laboratory invitation drafts yet.</p>}</div>
    </section>
  </div>;
}
