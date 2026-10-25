import { env } from "cloudflare:workers";
import { Buffer } from "node:buffer";

export const base64url = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString("base64url");
export async function digest(value: string) {
  return base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
async function encryptionKey() {
  const key = (env as unknown as Record<string, string>).TECRID_CHANNEL_SECRET;
  if (!key || Buffer.from(key, "base64url").length !== 32) throw Error("Notification channel encryption is not configured.");
  return crypto.subtle.importKey("raw", Buffer.from(key, "base64url"), "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function sealConfig(value: unknown, organizationId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(organizationId) }, await encryptionKey(), new TextEncoder().encode(JSON.stringify(value)));
  return `${base64url(iv)}.${base64url(data)}`;
}
export async function openConfig(value: string, organizationId: string): Promise<Record<string, string>> {
  const [iv, data] = value.split(".");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64url"), additionalData: new TextEncoder().encode(organizationId) }, await encryptionKey(), Buffer.from(data, "base64url"));
  return JSON.parse(new TextDecoder().decode(plain));
}
export function publicHttpsUrl(value: unknown) {
  const url = new URL(typeof value === "string" ? value : "");
  // Use DNS hostnames only. Never accept credentials, IP literals, local names,
  // non-TLS destinations, unusual ports, or redirects with secrets attached.
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || url.hash || url.hostname.endsWith(".") || !url.hostname.includes(".") || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(":") || /\.(?:localhost|local|internal|test|invalid|onion)$/.test(url.hostname)) throw Error("Use a public HTTPS URL on port 443.");
  return url;
}
export function pushUrl(value: unknown) {
  const url = publicHttpsUrl(value);
  if (!["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com", "notify.windows.com"].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw Error("Unsupported browser push service.");
  return url;
}
export async function signWebhook(secret: string, timestamp: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, "0")).join("");
}
