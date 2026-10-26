"use client";

import { useState } from "react";

export function VerificationCheckControl({
  applicationId,
  checkType,
  label,
  status,
  note,
}: {
  applicationId: string;
  checkType: "identity" | "accreditation" | "scope";
  label: string;
  status: string;
  note: string;
}) {
  const [registerUrl, setRegisterUrl] = useState("");
  const [registerResult, setRegisterResult] = useState("");
  const [registerCheckedAt, setRegisterCheckedAt] = useState("");
  const [decision, setDecision] = useState(status || "pending");
  const [evidenceNote, setEvidenceNote] = useState(note || "");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/admin/issuer-applications/${encodeURIComponent(applicationId)}/checks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkType, status: decision, evidenceNote, registerUrl, registerResult, registerCheckedAt }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(body.error ?? "Check review failed.");
    setMessage("Recorded. Reloading…");
    window.location.reload();
  }

  return (
    <article className="verification-check-control">
      <header><div><span>{checkType.replaceAll("_", " ")}</span><strong>{label}</strong></div><i className={`gate-status gate-${status || "pending"}`}>{status || "pending"}</i></header>
      <textarea value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} rows={4} placeholder="Record the source, registry, document, date, scope, and decision basis." />
      {checkType === "accreditation" ? <fieldset><legend>Accreditation body public register lookup</legend><label>Register URL<input type="url" value={registerUrl} onChange={event => setRegisterUrl(event.target.value)}/></label><label>Lookup result<textarea value={registerResult} onChange={event => setRegisterResult(event.target.value)} placeholder="Record certificate match, ISO/IEC 17025 scope and current status."/></label><label>Lookup date<input type="date" value={registerCheckedAt} onChange={event => setRegisterCheckedAt(event.target.value)}/></label></fieldset> : null}
      <div><select value={decision} onChange={(event) => setDecision(event.target.value)}><option value="pending">Pending</option><option value="passed">Passed</option><option value="failed">Failed</option></select><button type="button" disabled={pending || !evidenceNote.trim()} onClick={save}>{pending ? "Saving…" : "Record check"}</button></div>
      <small role="status">{message}</small>
    </article>
  );
}

export function ReviewControls({ applicationId, approvalReady }: { applicationId: string; approvalReady: boolean }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  async function decide(decision: "approve" | "needs_information" | "reject") {
    if (!reviewNote.trim()) return setMessage("Record the final decision basis first.");
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/admin/issuer-applications/${encodeURIComponent(applicationId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, reviewNote }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(body.error ?? "Review failed.");
    setMessage("Decision recorded. Reloading…");
    window.location.reload();
  }

  return (
    <div className="review-controls">
      <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={3} placeholder="Second independent review of identity, accreditation and scope; exclusions and conditions." />
      <button type="button" disabled={pending || !approvalReady} onClick={() => decide("approve")}>Second admin: approve issuer</button>
      <button type="button" disabled={pending} onClick={() => decide("needs_information")}>Needs information</button>
      <button type="button" disabled={pending} onClick={() => decide("reject")}>Reject</button>
      <small role="status">{approvalReady ? message : "Approval remains locked until all five verification gates pass."}</small>
    </div>
  );
}
