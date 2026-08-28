"use client";

import { useState } from "react";

export function ReviewControls({ applicationId }: { applicationId: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function decide(decision: "approve" | "needs_information" | "reject") {
    const reviewNote = window.prompt(
      decision === "approve"
        ? "Record the scope/key review basis. This note is required."
        : "Record what the laboratory must address. This note is required.",
    );
    if (!reviewNote) return;
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
      <button type="button" disabled={pending} onClick={() => decide("approve")}>Approve scope + key</button>
      <button type="button" disabled={pending} onClick={() => decide("needs_information")}>Needs information</button>
      <button type="button" disabled={pending} onClick={() => decide("reject")}>Reject</button>
      <small role="status">{message}</small>
    </div>
  );
}
