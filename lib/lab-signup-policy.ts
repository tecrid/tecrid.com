import { sql } from "drizzle-orm";
import { getDb } from "../db";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { TecAuthorizationError, TecInputError } from "./tec";

// Domain matching establishes mailbox control, never laboratory authority.
const WEBMAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "msn.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "icloud.com", "me.com",
  "mac.com", "aol.com", "proton.me", "protonmail.com", "pm.me", "mail.com",
  "gmx.com", "gmx.de", "zoho.com", "yandex.com", "yandex.ru", "qq.com", "163.com",
]);

export function laboratoryMailbox(email: string, website: string) {
  const domain = email.trim().toLowerCase().split("@");
  if (domain.length !== 2 || !domain[0] || !domain[1].includes(".") || WEBMAIL.has(domain[1])) {
    throw new TecInputError("Use a work email on your laboratory's own domain. Free webmail is not accepted.");
  }
  let url: URL;
  try { url = new URL(website); } catch { throw new TecInputError("Enter your laboratory website."); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.hostname.replace(/^www\./, "") !== domain[1]) {
    throw new TecInputError("Your confirmed work email must match the laboratory website domain.");
  }
  return email.trim().toLowerCase();
}

export async function requireConfirmedLaboratoryMailbox(user: ChatGPTUser, website: string, contactEmail = user.email) {
  const email = laboratoryMailbox(user.email, website);
  if (contactEmail.trim().toLowerCase() !== email || !user.userId.startsWith("email:")) {
    throw new TecAuthorizationError("Confirm this laboratory work email using a one-time sign-in link first.");
  }
  const confirmed = await getDb().get(sql`SELECT id FROM auth_user WHERE id=${user.userId.slice(6)} AND lower(email)=${email} AND email_verified=1`);
  if (!confirmed) throw new TecAuthorizationError("Confirm your laboratory work email using a one-time sign-in link first.");
  return email;
}

export async function requireIndependentLabReviewer(user: ChatGPTUser, organizationId: string, contactEmail: string) {
  const association = await getDb().get(sql`SELECT id FROM organizations WHERE id=${organizationId} AND (owner_user_id=${user.userId} OR lower(owner_email)=${user.email.toLowerCase()})
    UNION ALL SELECT organization_id FROM organization_members WHERE organization_id=${organizationId} AND (user_id=${user.userId} OR lower(email)=${user.email.toLowerCase()})
    UNION ALL SELECT entity_id FROM audit_events WHERE organization_id=${organizationId} AND actor_user_id=${user.userId} AND event_type='issuer.application_submitted' LIMIT 1`);
  if (association || user.email.toLowerCase() === contactEmail.toLowerCase()) {
    throw new TecAuthorizationError("An applicant cannot review its own laboratory. Use an independent ICS administrator.");
  }
}

export async function scopePdf(file: unknown) {
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pdf") || file.size < 5 || file.size > 15 * 1024 * 1024) {
    throw new TecInputError("An ISO/IEC 17025 scope PDF is required (up to 15 MB).");
  }
  const bytes = await file.arrayBuffer();
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new TecInputError("Upload a valid scope PDF.");
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
  return { bytes, sha256, filename: file.name.split(/[\\/]/).pop()!.split("").filter(character => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127).join("").slice(0, 240), size: file.size };
}
