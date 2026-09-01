"use client";

import Link from "next/link";
import { useState } from "react";

type Profile = { displayName: string; website: string | null; summary: string; isPublic: boolean } | null;
type SaveResponse = { error?: string; result?: NonNullable<Profile> };
type ProfileDraft = Omit<NonNullable<Profile>, "website"> & { website: string };

export function ProfileSettingsForm({ organization, profile }: {
  organization: { name: string; code: string; website: string | null };
  profile: Profile;
}) {
  const [savedProfile, setSavedProfile] = useState(profile);
  const [draft, setDraft] = useState<ProfileDraft>(() => ({
    displayName: profile?.displayName ?? organization.name,
    website: profile?.website ?? organization.website ?? "",
    summary: profile?.summary ?? "",
    isPublic: profile?.isPublic ?? false,
  }));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("Public listing is optional. Registry participation never makes private evidence public.");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("Saving profile settings…");
    try {
      const response = await fetch("/api/participant-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await response.json().catch(() => null) as SaveResponse | null;
      if (!response.ok) {
        setMessage(body?.error || "The profile could not be saved.");
        return;
      }
      if (!body?.result) {
        setMessage("The profile could not be saved.");
        return;
      }
      setSavedProfile(body.result);
      setDraft({
        displayName: body.result.displayName,
        website: body.result.website ?? "",
        summary: body.result.summary,
        isPublic: body.result.isPublic,
      });
      setMessage("Profile settings saved.");
    } catch {
      setMessage("The profile could not be saved. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const profileUrl = `https://tecrid.com/participants/${encodeURIComponent(organization.code)}`;
  return (
    <form className="profile-settings-form" id="public-profile" onSubmit={save}>
      <div className="settings-section-heading"><div><p className="section-kicker">Public participant profile</p><h2>Choose what the network may show.</h2></div><span>{savedProfile?.isPublic ? "Public" : "Private"}</span></div>
      <p>These fields describe the organization, not its private reports. Laboratory verification and participant-directory visibility remain separate statuses.</p>
      <div className="settings-field-grid"><label>Public organization name<input name="displayName" required value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} /></label><label>Website<input name="website" type="url" value={draft.website} onChange={(event) => setDraft((current) => ({ ...current, website: event.target.value }))} /></label></div>
      <label>Public description<textarea name="summary" rows={4} value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} placeholder="Describe the organization’s role in the TECRID network." /></label>
      <div className="settings-public-toggle"><input id="profile-is-public" type="checkbox" name="isPublic" checked={draft.isPublic} onChange={(event) => setDraft((current) => ({ ...current, isPublic: event.target.checked }))} /><label htmlFor="profile-is-public"><strong>List this organization in the public participant directory.</strong><small>This can be turned off later. It does not publish TECRIDs or report findings.</small></label></div>
      <div className="settings-form-actions"><button className="button-dark" type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile settings →"}</button>{savedProfile?.isPublic ? <Link href={profileUrl}>View public profile ↗</Link> : <Link href="/participants">View participant directory ↗</Link>}</div>
      <p className="form-message" aria-live="polite">{message}</p>
    </form>
  );
}
