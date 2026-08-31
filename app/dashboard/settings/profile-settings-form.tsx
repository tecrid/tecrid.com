"use client";

import Link from "next/link";
import { useState } from "react";

type Profile = { displayName: string; website: string | null; summary: string; isPublic: boolean } | null;

export function ProfileSettingsForm({ organization, profile }: {
  organization: { name: string; code: string; website: string | null };
  profile: Profile;
}) {
  const [savedProfile, setSavedProfile] = useState(profile);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("Public listing is optional. Registry participation never makes private evidence public.");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("Saving profile settings…");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/participant-profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: form.get("displayName"),
        website: form.get("website"),
        summary: form.get("summary"),
        isPublic: form.get("isPublic") === "on",
      }),
    });
    const body = await response.json() as { error?: string; result: NonNullable<Profile> };
    setPending(false);
    if (!response.ok) return setMessage(body.error || "The profile could not be saved.");
    setSavedProfile(body.result);
    setMessage("Profile settings saved.");
  }

  const profileUrl = `https://tecrid.com/participants/${encodeURIComponent(organization.code)}`;
  return (
    <form className="profile-settings-form" id="public-profile" onSubmit={save}>
      <div className="settings-section-heading"><div><p className="section-kicker">Public participant profile</p><h2>Choose what the network may show.</h2></div><span>{savedProfile?.isPublic ? "Public" : "Private"}</span></div>
      <p>These fields describe the organization, not its private reports. Laboratory verification and participant-directory visibility remain separate statuses.</p>
      <div className="settings-field-grid"><label>Public organization name<input name="displayName" required defaultValue={profile?.displayName ?? organization.name} /></label><label>Website<input name="website" type="url" defaultValue={profile?.website ?? organization.website ?? ""} /></label></div>
      <label>Public description<textarea name="summary" rows={4} defaultValue={profile?.summary ?? ""} placeholder="Describe the organization’s role in the TECRID network." /></label>
      <div className="settings-public-toggle"><input id="profile-is-public" type="checkbox" name="isPublic" defaultChecked={profile?.isPublic ?? false} /><label htmlFor="profile-is-public"><strong>List this organization in the public participant directory.</strong><small>This can be turned off later. It does not publish TECRIDs or report findings.</small></label></div>
      <div className="settings-form-actions"><button className="button-dark" type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile settings →"}</button>{savedProfile?.isPublic ? <Link href={profileUrl}>View public profile ↗</Link> : <Link href="/participants">View participant directory ↗</Link>}</div>
      <p className="form-message" aria-live="polite">{message}</p>
    </form>
  );
}
