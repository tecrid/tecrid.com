import { env } from "cloudflare:workers";
import { privateFetch } from "./private-fetch";
import { emailConfigFrom, emailConfigured, sendEmail, sha256Hex } from "./email-sender";

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
  const config = emailConfigFrom(env as unknown as Record<string, unknown>);
  if (!emailConfigured(config)) return { sent: false as const, reason: "not_configured" as const };
  let link: URL;
  try { link = new URL(notice.url, "https://tecrid.com"); } catch { return { sent: false as const, reason: "rejected" as const }; }
  if (link.origin !== "https://tecrid.com") return { sent: false as const, reason: "rejected" as const };
  try {
    await sendEmail(config, {
      to: [notice.email],
      subject: notice.title.slice(0, 200),
      text: `${notice.body}\n\n${link.href}\n\nYou receive this because you belong to a TECRID organization involved in this record.`,
      tags: [{ name: "event", value: notice.eventType.replace(/[^A-Za-z0-9_]/g, "-") }],
      idempotencyKey: "tecrid-notice-" + await sha256Hex(`${notice.eventType}\n${notice.email.toLowerCase()}\n${link.href}\n${notice.title}`),
    }, transport);
    return { sent: true as const };
  } catch {
    return { sent: false as const, reason: "rejected" as const };
  }
}
