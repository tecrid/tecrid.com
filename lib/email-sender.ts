import { privateFetch } from "./private-fetch";

// TECRID sends its own mail through its own Resend account and tecrid.com sender.
// There is no relay and no dependency on any other site. Never log provider
// responses, API keys, recipients' links or message bodies.
export type EmailConfig = { apiKey?: string; from?: string };
export type OutboundEmail = { to: string[]; subject: string; text: string; html?: string; idempotencyKey?: string; tags?: { name: string; value: string }[] };

export class EmailNotConfiguredError extends Error {
  constructor() { super("Email delivery is not configured."); }
}

export function emailConfigFrom(bindings: Record<string, unknown>): EmailConfig {
  return {
    apiKey: typeof bindings.RESEND_API_KEY === "string" ? bindings.RESEND_API_KEY : undefined,
    from: typeof bindings.TECRID_EMAIL_FROM === "string" ? bindings.TECRID_EMAIL_FROM : undefined,
  };
}

export function emailConfigured(config: EmailConfig) {
  return !!(config.apiKey && config.from && /@(?:[a-z0-9-]+\.)?tecrid\.com>?$/i.test(config.from.trim()));
}

export async function sendEmail(config: EmailConfig, message: OutboundEmail, transport: typeof fetch = privateFetch) {
  if (!emailConfigured(config)) throw new EmailNotConfiguredError();
  if (!message.to.length || message.to.length > 10) throw new Error("Invalid recipients.");
  const response = await transport("https://api.resend.com/emails", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
      ...(message.idempotencyKey ? { "idempotency-key": message.idempotencyKey } : {}),
    },
    body: JSON.stringify({ from: config.from, to: message.to, subject: message.subject, text: message.text, ...(message.html ? { html: message.html } : {}), ...(message.tags?.length ? { tags: message.tags } : {}) }),
  });
  if (!response.ok) throw new Error("Email delivery failed. Please try again shortly.");
  return true;
}

export async function sha256Hex(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (b) => b.toString(16).padStart(2, "0")).join("");
}
