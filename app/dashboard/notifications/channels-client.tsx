"use client";
import { useState } from "react";

type Channel = { id: string; kind: string; label: string; active: boolean };
export function NotificationChannels({ channels, vapidPublicKey, email }: { channels: Channel[]; vapidPublicKey: string | null; email: string }) {
  const [message, setMessage] = useState("");
  const [secret, setSecret] = useState("");
  const [pending, setPending] = useState(false);
  async function request(input: Record<string, unknown>) {
    const response = await fetch("/api/notification-channels", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "Channel operation failed.");
    return result;
  }
  async function perform(input: Record<string, unknown>) {
    setPending(true); setMessage(""); setSecret("");
    try {
      const result = await request(input);
      if (result.webhookSecret) setSecret(result.webhookSecret);
      setMessage(input.action === "test" ? "Test processed. Refresh the delivery log to see acceptance or retry status." : "Saved. Refresh to update channels and delivery history.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Channel operation failed."); }
    finally { setPending(false); }
  }
  async function addPhone() {
    setPending(true); setMessage(""); setSecret("");
    try {
      if (!vapidPublicKey) throw Error("Web Push is awaiting server configuration.");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw Error("Install TECRID on your phone's home screen, then open it there to enable push.");
      const allowed = await Notification.requestPermission();
      if (allowed !== "granted") throw Error("Allow notifications in your browser or phone settings, then try again.");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const key = Uint8Array.from(atob(vapidPublicKey.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await request({ kind: "push", label: "Phone or browser", subscription: subscription.toJSON() });
      setMessage("Phone push added. Refresh, then send a test to this device.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Phone setup failed."); }
    finally { setPending(false); }
  }
  return <section className="dashboard-panel notification-settings" aria-labelledby="channels-title">
    <h2 id="channels-title">Organization channels</h2>
    <p>An organization owner or administrator can add, test, and disable channels.</p>
    <p>On iPhone, open TECRID in Safari, choose Add to Home Screen, then open the installed app and enable phone alerts. On Android, install TECRID from your browser menu and enable alerts.</p>
    <p>Push and email contain only the event, SKU, and a link to your authenticated workspace.</p>
    <button type="button" disabled={pending} onClick={addPhone}>Add this phone or browser</button>
    <form onSubmit={event => { event.preventDefault(); void perform({ kind: "email", label: "Verified email", email }); }}>
      <label>Verified email<input type="email" value={email} readOnly /></label><button disabled={pending}>Add email</button>
    </form>
    <form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void perform({ kind: "webhook", label: form.get("label"), url: form.get("url") }); }}>
      <label>Webhook label<input name="label" maxLength={80} required /></label>
      <label>Webhook URL<input name="url" type="url" placeholder="https://" required /></label>
      <p>A server administrator must approve the destination host before delivery.</p><button disabled={pending}>Add webhook</button>
    </form>
    <p role="status" aria-live="polite">{message}</p>
    {secret ? <div role="status"><strong>Copy this webhook signing secret now. It is shown once.</strong><pre>{secret}</pre></div> : null}
    <ul>{channels.map(channel => <li key={channel.id}><strong>{channel.label}</strong> ({channel.kind}, {channel.active ? "active" : "disabled"}) {channel.active ? <><button type="button" disabled={pending} onClick={() => perform({ action: "test", id: channel.id })}>Send test</button><button type="button" disabled={pending} onClick={() => perform({ action: "disable", id: channel.id })}>Disable</button></> : null}</li>)}</ul>
  </section>;
}
