// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { createECDH, createHmac } from "node:crypto";
import { createRequire } from "node:module";
import webPush from "web-push";
import { eq } from "drizzle-orm";
import { env } from "./support/cloudflare-env";
import { getDb } from "../db";
import { notificationChannels, notificationDeliveries, notificationOutbox, organizationMembers, organizationNotifications, organizations } from "../db/schema";
import { disableNotificationChannel, notificationDashboard, notificationPayload, processNotificationOutbox, retryDelay, saveNotificationChannel, testNotificationChannel } from "../lib/notification-delivery";
import { openConfig, publicHttpsUrl, pushUrl } from "../lib/notification-security";
const require = createRequire(import.meta.url);
const ece = require("http_ece");
const user = { userId: "notify-owner", email: "notify@example.test", displayName: "Fixture", fullName: "Fixture" };
const stranger = { ...user, userId: "stranger", email: "stranger@example.test" };
let mf: Miniflare;
let webhook: Awaited<ReturnType<typeof saveNotificationChannel>>;
const calls: { url: string; init: RequestInit }[] = [];
const transport: typeof fetch = async (input, init) => { calls.push({ url: String(input), init: init! }); return new Response(null, { status: 202 }); };
async function insert(id: string, body = "SENSITIVE_RESULT_999") {
 await getDb().insert(organizationNotifications).values({ id, organizationId: user.userId, eventType: "laboratory_report.received", title: body, body, entityId: "fixture", entityType: "credential", actionPath: "/dashboard/evidence-routing", createdAt: new Date().toISOString() });
}
beforeAll(async () => {
 mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('test')}}", compatibilityDate: "2026-05-22", d1Databases: ["DB"] });
 env.DB = await mf.getD1Database("DB");
 env.TECRID_CHANNEL_SECRET = Buffer.alloc(32, 7).toString("base64url");
 env.TECRID_WEBHOOK_HOSTS = "recipient.example.org";
 env.TECRID_DELIVERY_ENABLED = "true";
 env.TECRID_NOTIFICATION_EMAIL_RELAY_URL = "https://relay.example.org/send";
 env.TECRID_NOTIFICATION_EMAIL_RELAY_SECRET = "test-only";
 const vapid = webPush.generateVAPIDKeys();
 env.TECRID_VAPID_PUBLIC_KEY = vapid.publicKey; env.TECRID_VAPID_PRIVATE_KEY = vapid.privateKey; env.TECRID_VAPID_SUBJECT = "mailto:fixture@example.org";
 for (const file of readdirSync("drizzle").filter(x => x.endsWith(".sql")).sort()) for (const statement of readFileSync(`drizzle/${file}`, "utf8").split("--> statement-breakpoint").filter(x => x.trim())) await env.DB.prepare(statement).run();
 await getDb().insert(organizations).values({ id: user.userId, name: "Fixture", slug: user.userId, organizationType: "brand", ownerUserId: user.userId, ownerEmail: user.email, issuerCode: "NOTIFY" });
 await getDb().insert(organizationMembers).values({ organizationId: user.userId, userId: user.userId, email: user.email, role: "owner" });
 webhook = await saveNotificationChannel(user, { kind: "webhook", label: "Fixture receiver", url: "https://recipient.example.org/events" });
 await saveNotificationChannel(user, { kind: "email", label: "Mailbox", email: user.email });
}, 60000);
afterAll(async () => { await mf?.dispose(); });

it("captures every notification atomically, redacts findings, signs webhooks, and leases concurrent work", async () => {
 await insert("atomic");
 const [event] = await getDb().select().from(notificationOutbox).where(eq(notificationOutbox.id, "notification:atomic"));
 expect(event).toBeTruthy();
 expect(JSON.stringify(event)).not.toContain("SENSITIVE");
 calls.length = 0;
 await Promise.all([processNotificationOutbox({ transport }), processNotificationOutbox({ transport })]);
 expect(calls).toHaveLength(2);
 const hook = calls.find(x => x.url.startsWith("https://recipient."))!;
 const payload = JSON.parse(String(hook.init.body));
 expect(Object.keys(payload).sort()).toEqual(["event", "eventId", "sku", "url"]);
 const headers = hook.init.headers as Record<string, string>;
 const [t, signature] = headers["x-tecrid-signature"].split(",");
 expect(signature).toBe(`v1=${createHmac("sha256", webhook.webhookSecret!).update(`${t.slice(2)}.${hook.init.body}`).digest("hex")}`);
 expect(headers["x-tecrid-event-id"]).toBe(event.id);
 expect(JSON.stringify(calls)).not.toContain("SENSITIVE_RESULT_999");
 await processNotificationOutbox({ transport });
 expect(calls).toHaveLength(2);
});

it("retries with backoff, preserves event id, and does not follow redirects", async () => {
 await insert("retry");
 const failed: typeof fetch = async () => new Response(null, { status: 503 });
 const at = Date.now();
 await processNotificationOutbox({ transport: failed, at });
 let jobs = await getDb().select().from(notificationDeliveries).where(eq(notificationDeliveries.eventId, "notification:retry"));
 expect(jobs.every(x => x.status === "retry" && x.attempts === 1)).toBe(true);
 expect(jobs[0].nextAttemptAt).toBe(new Date(at + 5000).toISOString());
 await processNotificationOutbox({ transport, at: at + 1000 });
 jobs = await getDb().select().from(notificationDeliveries).where(eq(notificationDeliveries.eventId, "notification:retry"));
 expect(jobs.every(x => x.attempts === 1)).toBe(true);
 await processNotificationOutbox({ transport, at: at + 5001 });
 jobs = await getDb().select().from(notificationDeliveries).where(eq(notificationDeliveries.eventId, "notification:retry"));
 expect(jobs.every(x => x.status === "delivered" && x.attempts === 2)).toBe(true);
 expect(retryDelay(50)).toBe(86400000);
});

it("encrypts channel secrets, scopes management to org owners, and rejects unsafe destinations", async () => {
 const [channel] = await getDb().select().from(notificationChannels).where(eq(notificationChannels.id, webhook.id));
 expect(channel.encryptedConfig).not.toContain(webhook.webhookSecret);
 expect(channel.encryptedConfig).not.toContain("recipient.example.org");
 await expect(openConfig(channel.encryptedConfig, "different-org")).rejects.toThrow();
 await expect(disableNotificationChannel(stranger, webhook.id)).rejects.toThrow();
 await expect(testNotificationChannel(stranger, webhook.id)).rejects.toThrow();
 await expect(saveNotificationChannel(user, { kind: "email", email: "unsolicited@example.org" })).rejects.toThrow();
 for (const url of ["http://example.com", "https://127.0.0.1", "https://[::1]", "https://localhost", "https://internal.local", "https://user:pass@example.org", "https://example.org:8080"]) expect(() => publicHttpsUrl(url)).toThrow();
 expect(() => pushUrl("https://arbitrary.example.org/path")).toThrow();
 expect(JSON.stringify(await notificationDashboard(user))).not.toContain(webhook.webhookSecret);
});

it("creates an encrypted RFC8291 push request with VAPID and only the allowed alert payload", async () => {
 const receiver = createECDH("prime256v1"); receiver.generateKeys();
 const auth = Buffer.alloc(16, 5);
 const channel = await saveNotificationChannel(user, { kind: "push", label: "Fixture phone", subscription: { endpoint: "https://web.push.apple.com/QFixture", keys: { p256dh: receiver.getPublicKey().toString("base64url"), auth: auth.toString("base64url") } } });
 await insert("push"); calls.length = 0;
 await processNotificationOutbox({ transport });
 const push = calls.find(x => x.url.includes("web.push.apple.com"))!;
 expect(push).toBeTruthy();
 const headers = push.init.headers as Record<string, string>;
 expect(headers.Authorization).toMatch(/^vapid /);
 expect(headers["Content-Encoding"]).toBe("aes128gcm");
 const plain = ece.decrypt(Buffer.from(push.init.body as Uint8Array), { version: "aes128gcm", privateKey: receiver, authSecret: auth });
 const payload = JSON.parse(plain.toString());
 expect(payload).toEqual(notificationPayload({ id: "notification:push", eventType: "laboratory_report.received", productSku: null, actionPath: "/dashboard/evidence-routing" }));
 expect(plain.toString()).not.toContain("SENSITIVE");
 console.info("PUSH_PAYLOAD_PROOF " + plain.toString());
 await disableNotificationChannel(user, channel.id);
});

it("leaves credential automation disabled unless explicitly enabled", async () => {
 env.TECRID_DELIVERY_ENABLED = "false";
 await insert("disabled");
 expect(await processNotificationOutbox({ transport })).toEqual({ enabled: false, processed: 0 });
 const jobs = await getDb().select().from(notificationDeliveries).where(eq(notificationDeliveries.eventId, "notification:disabled"));
 expect(jobs).toHaveLength(0);
});
