"use client";

import { useState } from "react";

export function InviteLabForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [mailto, setMailto] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("Preparing the invite.");
    setMailto(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/laboratories/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const body = await response.json() as { error?: string; result?: { mailto?: string; legalName?: string } };
      if (!response.ok || !body.result?.mailto) throw new Error(body.error || "The invite could not be prepared.");
      setMailto(body.result.mailto);
      setMessage(`${body.result.legalName ?? "The laboratory"} is saved and still unverified. Send the invite email. Two different ICS admins approve it later.`);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The invite could not be prepared.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="access-form" onSubmit={(event) => void submit(event)}>
      <label>Laboratory legal name<input name="legalName" required /></label>
      <label>Address<textarea name="laboratoryAddress" required rows={3} /></label>
      <label>Website<input name="laboratoryWebsite" type="url" required placeholder="https://laboratory.example" /></label>
      <label>Owner name<input name="ownerName" required /></label>
      <label>Owner work email<input name="ownerEmail" type="email" required /></label>
      <label>ISO/IEC 17025 body<input name="accreditationBody" required /></label>
      <label>Certificate number<input name="accreditationNumber" required /></label>
      <label>Certificate expiry<input name="accreditationExpiresOn" type="date" required /></label>
      <label>Scope<textarea name="scopeSummary" required rows={4} /></label>
      <label>Sites covered by the certificate<textarea name="accreditedSites" required rows={3} placeholder="One site per line" /></label>
      <label>Analytes on the accredited scope<textarea name="accreditedAnalytes" required rows={3} placeholder="One analyte per line" /></label>
      <button className="button-dark" type="submit" disabled={pending}>{pending ? "Saving…" : "Prepare invite"}</button>
      {message ? <p className="form-message" role="status">{message}</p> : null}
      {mailto ? <p><a className="button-dark" href={mailto}>Send invite email</a></p> : null}
    </form>
  );
}
