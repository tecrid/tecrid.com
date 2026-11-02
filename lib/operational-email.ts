import { env } from "cloudflare:workers";
import { privateFetch } from "./private-fetch";

// Corrections, revocations, and new access grants are the only events that send mail.
// Every other alert stays in the organization inbox.
export const OPERATIONAL_EMAIL_EVENTS = new Set([
  "credential.corrected",
  "credential.revoked",
  "evidence_access.granted",
]);

export type OperationalNotice = {
  email: string;
  eventType: string;
  title: string;
  body: string;
  url: string;
};

export async function sendOperationalEmail(notice: OperationalNotice, transport: typeof fetch = privateFetch) {
  if (!OPERATIONAL_EMAIL_EVENTS.has(notice.eventType)) return { sent: false as const, reason: "in_app_only" as const };
  const bindings = env as unknown as Record<string, string | undefined>;
  const relayURL = bindings.TECRID_EMAIL_RELAY_URL;
  const relaySecret = bindings.TECRID_EMAIL_RELAY_SECRET;
  if (!relayURL || !relaySecret) return { sent: false as const, reason: "not_configured" as const };
  try {
    const response = await transport(relayURL, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: { authorization: `Bearer ${relaySecret}`, "content-type": "application/json" },
      body: JSON.stringify({
        kind: "tecrid-notice",
        email: notice.email,
        url: notice.url,
        noticeType: notice.eventType,
        subject: notice.title,
        text: notice.body,
      }),
    });
    if (!response.ok) return { sent: false as const, reason: "relay_rejected" as const };
    return { sent: true as const };
  } catch {
    return { sent: false as const, reason: "relay_rejected" as const };
  }
}
