import { Buffer } from "node:buffer";
import { env } from "cloudflare:workers";
import { and, asc, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import { auditEvents, notificationChannels, notificationDeliveries, notificationOutbox } from "../db/schema";
import { getOrganizationForUser, TecAuthorizationError, TecInputError } from "./tec";
import { base64url, digest, openConfig, publicHttpsUrl, pushUrl, sealConfig, signWebhook } from "./notification-security";
import { privateFetch } from "./private-fetch";

type Channel = typeof notificationChannels.$inferSelect;
type Event = typeof notificationOutbox.$inferSelect;
const settings = () => env as unknown as Record<string, string>;
const origin = () => new URL(settings().TECRID_AUTH_URL || "https://tecrid.com").origin;

async function membership(user: ChatGPTUser, manage = false) {
  const result = await getOrganizationForUser(user.userId);
  if (!result || (manage && !["owner", "admin"].includes(result.role))) throw new TecAuthorizationError("An organization owner or administrator is required.");
  return result;
}

export function notificationPayload(event: Pick<Event, "id" | "eventType" | "productSku" | "actionPath">, channelId?: string) {
  // Explicit allowlist. Never reuse an in-app title, body, audit payload, or
  // signed credential as a push/email body.
  const path = event.actionPath.startsWith("/dashboard") && !event.actionPath.startsWith("//") ? event.actionPath : "/dashboard";
  const url = new URL(path, origin());
  if (channelId) { url.searchParams.set("notificationEvent", event.id); url.searchParams.set("notificationChannel", channelId); }
  return { eventId: event.id, event: event.eventType, sku: event.productSku, url: url.href };
}

export async function saveNotificationChannel(user: ChatGPTUser, input: Record<string, unknown>) {
  const { organization } = await membership(user, true);
  const db = getDb();
  const channels = await db.select({ id: notificationChannels.id }).from(notificationChannels).where(and(eq(notificationChannels.organizationId, organization.id), eq(notificationChannels.active, true)));
  if (channels.length >= 20) throw new TecInputError("An organization can have at most 20 active notification channels.");
  const kind = String(input.kind || "");
  const label = String(input.label || kind).trim().slice(0, 80);
  let config: Record<string, string>;
  let secret: string | undefined;
  if (kind === "email") {
    const email = String(input.email || "").trim().toLowerCase();
    // Until a separate mailbox-verification flow exists, only the signed-in
    // account's verified mailbox may be enrolled. No unsolicited recipients.
    if (!email || email !== user.email.toLowerCase()) throw new TecInputError("Use your signed-in, verified email address.");
    config = { email };
  } else if (kind === "webhook") {
    let url: URL;
    try { url = publicHttpsUrl(input.url); } catch { throw new TecInputError("Use a public HTTPS webhook URL without credentials."); }
    secret = base64url(crypto.getRandomValues(new Uint8Array(32)));
    config = { url: url.href, secret };
  } else if (kind === "push") {
    const subscription = input.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined;
    let endpoint: URL;
    try { endpoint = pushUrl(subscription?.endpoint); } catch { throw new TecInputError("A supported browser push subscription is required."); }
    const p256dh = subscription?.keys?.p256dh || "";
    const auth = subscription?.keys?.auth || "";
    if (!/^[A-Za-z0-9_-]+$/.test(p256dh) || !/^[A-Za-z0-9_-]+$/.test(auth) || Buffer.from(p256dh, "base64url").length !== 65 || Buffer.from(auth, "base64url").length !== 16) throw new TecInputError("The browser push keys are invalid.");
    config = { endpoint: endpoint.href, p256dh, auth };
  } else throw new TecInputError("Choose phone push, email, or webhook.");
  const destinationHash = await digest(config.endpoint || config.email || config.url);
  const existing = await db.select({ id: notificationChannels.id }).from(notificationChannels).where(and(eq(notificationChannels.organizationId, organization.id), eq(notificationChannels.kind, kind), eq(notificationChannels.destinationHash, destinationHash))).limit(1);
  const id = existing[0]?.id || crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.batch([
    db.insert(notificationChannels).values({ id, organizationId: organization.id, kind, label, encryptedConfig: await sealConfig(config, organization.id), destinationHash, createdByUserId: user.userId, createdAt }).onConflictDoUpdate({ target: notificationChannels.id, set: { active: true, label, encryptedConfig: await sealConfig(config, organization.id), createdAt } }),
    db.insert(auditEvents).values({ id: crypto.randomUUID(), organizationId: organization.id, actorUserId: user.userId, eventType: "notification_channel.saved", entityType: "notification_channel", entityId: id, payload: JSON.stringify({ kind }), createdAt }),
  ]);
  return { id, kind, label, ...(secret ? { webhookSecret: secret } : {}) };
}

export async function disableNotificationChannel(user: ChatGPTUser, id: string) {
  const { organization } = await membership(user, true);
  const changed = await getDb().update(notificationChannels).set({ active: false }).where(and(eq(notificationChannels.id, id), eq(notificationChannels.organizationId, organization.id))).returning({ id: notificationChannels.id });
  if (!changed.length) throw new TecAuthorizationError("Channel not found for this organization.");
  await getDb().insert(auditEvents).values({ id: crypto.randomUUID(), organizationId: organization.id, actorUserId: user.userId, eventType: "notification_channel.disabled", entityType: "notification_channel", entityId: id, payload: "{}", createdAt: new Date().toISOString() });
}

export async function testNotificationChannel(user: ChatGPTUser, channelId: string) {
  const { organization } = await membership(user, true);
  const db = getDb();
  const [channel] = await db.select().from(notificationChannels).where(and(eq(notificationChannels.id, channelId), eq(notificationChannels.organizationId, organization.id), eq(notificationChannels.active, true))).limit(1);
  if (!channel) throw new TecAuthorizationError("Active channel not found for this organization.");
  // A minute bucket prevents repeated clicks from generating duplicate tests.
  const id = `test:${channel.id}:${Math.floor(Date.now() / 60_000)}`;
  const occurredAt = new Date().toISOString();
  await db.batch([
    db.insert(notificationOutbox).values({ id, organizationId: organization.id, eventType: "notification.test", productSku: "TEST", entityId: channel.id, actionPath: "/dashboard/notifications", occurredAt, expandedAt: occurredAt }).onConflictDoNothing(),
    db.insert(notificationDeliveries).values({ id: `${id}:${channel.id}`, eventId: id, channelId: channel.id, nextAttemptAt: occurredAt }).onConflictDoNothing(),
  ]);
  // Explicit test of one owned channel. The production automation switch is
  // never bypassed for credential events.
  await processNotificationOutbox({ testEventId: id });
  return { eventId: id };
}

export async function notificationDashboard(user: ChatGPTUser) {
  const { organization } = await membership(user);
  const db = getDb();
  const [channels, deliveries] = await Promise.all([
    db.select({ id: notificationChannels.id, kind: notificationChannels.kind, label: notificationChannels.label, active: notificationChannels.active }).from(notificationChannels).where(eq(notificationChannels.organizationId, organization.id)),
    db.select({ eventId: notificationOutbox.id, event: notificationOutbox.eventType, sku: notificationOutbox.productSku, queuedAt: notificationOutbox.occurredAt, channel: notificationChannels.label, kind: notificationChannels.kind, status: notificationDeliveries.status, attempts: notificationDeliveries.attempts, nextAttemptAt: notificationDeliveries.nextAttemptAt, deliveredAt: notificationDeliveries.deliveredAt, acknowledgedAt: notificationDeliveries.acknowledgedAt, statusCode: notificationDeliveries.lastStatusCode, error: notificationDeliveries.lastError }).from(notificationDeliveries).innerJoin(notificationOutbox, eq(notificationDeliveries.eventId, notificationOutbox.id)).innerJoin(notificationChannels, eq(notificationDeliveries.channelId, notificationChannels.id)).where(eq(notificationOutbox.organizationId, organization.id)).orderBy(desc(notificationOutbox.occurredAt)).limit(100),
  ]);
  return { channels, deliveries, vapidPublicKey: settings().TECRID_VAPID_PUBLIC_KEY || null, automationEnabled: settings().TECRID_DELIVERY_ENABLED === "true" };
}

export function retryDelay(attempt: number) {
  return Math.min(86_400_000, 5_000 * 2 ** Math.max(0, attempt - 1));
}

async function send(channel: Channel, event: Event, transport: typeof fetch) {
  const config = await openConfig(channel.encryptedConfig, channel.organizationId);
  const payload = notificationPayload(event, channel.kind === "push" ? channel.id : undefined);
  const stream = event.eventType === "marketplace.evidence" ? await (await import("./marketplace-stream")).marketplaceEventGate(event,channel.id) : null;
  if(stream && stream.mode !== "allow") throw Error("Marketplace event is not ready.");
  const body = stream?.mode === "allow" ? stream.body : JSON.stringify(channel.kind === "webhook" ? await (await import("./recipient-webhook")).recipientWebhookPayload(event) : payload);
  const common = { method: "POST", signal: AbortSignal.timeout(10_000) };
  if (channel.kind === "webhook") {
    const url = publicHttpsUrl(config.url);
    // Operators explicitly approve recipient hosts before any webhook egress.
    // This also prevents an organization from probing arbitrary destinations.
    const hosts = (settings().TECRID_WEBHOOK_HOSTS || "").split(",").map(x => x.trim()).filter(Boolean);
    if (!hosts.includes(url.hostname)) throw Error("Webhook host has not been approved for delivery.");
    const timestamp = String(Math.floor(Date.now() / 1000));
    return transport(url, { ...common, headers: { "content-type": "application/json", "x-tecrid-event-id": event.id, "x-tecrid-channel-id": channel.id, "x-tecrid-acknowledgment-url": new URL("/api/notification-acknowledgments", origin()).href, "x-tecrid-signature": `t=${timestamp},v1=${await signWebhook(config.secret, timestamp, body)}` }, body });
  }
  if (channel.kind === "email") {
    const relayUrl = settings().TECRID_NOTIFICATION_EMAIL_RELAY_URL;
    const relaySecret = settings().TECRID_NOTIFICATION_EMAIL_RELAY_SECRET;
    if (!relayUrl || !relaySecret) throw Error("Notification email relay is not configured.");
    publicHttpsUrl(relayUrl);
    return transport(relayUrl, { ...common, headers: { "content-type": "application/json", authorization: `Bearer ${relaySecret}`, "idempotency-key": event.id }, body: JSON.stringify({ email: config.email, eventId: event.id, subject: "TECRID event", text: `${payload.event}\nSKU: ${payload.sku || "Not specified"}\n${payload.url}` }) });
  }
  if (channel.kind !== "push") throw Error("Unsupported channel.");
  pushUrl(config.endpoint);
  const e = settings();
  if (!e.TECRID_VAPID_PUBLIC_KEY || !e.TECRID_VAPID_PRIVATE_KEY || !e.TECRID_VAPID_SUBJECT) throw Error("Web Push VAPID is not configured.");
  const { default: webPush } = await import("web-push");
  // Build the standard encrypted Web Push request, then use Workers fetch
  // instead of the library's Node HTTP transport.
  const request = webPush.generateRequestDetails({ endpoint: config.endpoint, keys: { p256dh: config.p256dh, auth: config.auth } }, body, { TTL: 60, urgency: "high", vapidDetails: { subject: e.TECRID_VAPID_SUBJECT, publicKey: e.TECRID_VAPID_PUBLIC_KEY, privateKey: e.TECRID_VAPID_PRIVATE_KEY } });
  return transport(request.endpoint, { ...common, headers: request.headers, body: new Uint8Array(request.body!) });
}

export async function processNotificationOutbox(options: { testEventId?: string; transport?: typeof fetch; at?: number } = {}) {
  if (!options.testEventId && settings().TECRID_DELIVERY_ENABLED !== "true") return { enabled: false, processed: 0 };
  if (!options.testEventId) await (await import("./evidence-routing")).processStandingRoutingJobs();
  if (!options.testEventId) await (await import("./marketplace-stream")).processMarketplaceStreamJobs();
  const db = getDb();
  const at = options.at ?? Date.now();
  const stamp = new Date(at).toISOString();
  if (!options.testEventId) {
    const events = await db.select().from(notificationOutbox).where(isNull(notificationOutbox.expandedAt)).orderBy(asc(notificationOutbox.occurredAt)).limit(50);
    for (const event of events) {
      const candidates = await db.select().from(notificationChannels).where(and(eq(notificationChannels.organizationId, event.organizationId), eq(notificationChannels.active, true), lte(notificationChannels.createdAt, event.occurredAt)));
      const allowed = await Promise.all(candidates.map(async channel => await (await import("./marketplace-stream")).marketplaceChannelFilter(event,channel.kind) ? channel : null));
      const channels = allowed.filter((channel):channel is Channel => channel!==null);
      await db.batch([
        db.update(notificationOutbox).set({ expandedAt: stamp }).where(eq(notificationOutbox.id, event.id)),
        ...channels.map(channel => db.insert(notificationDeliveries).values({ id: `${event.id}:${channel.id}`, eventId: event.id, channelId: channel.id, nextAttemptAt: stamp }).onConflictDoNothing()),
      ]);
    }
  }
  const due = and(lte(notificationDeliveries.nextAttemptAt, stamp), or(eq(notificationDeliveries.status, "queued"), eq(notificationDeliveries.status, "retry"), eq(notificationDeliveries.status, "blocked"), and(eq(notificationDeliveries.status, "sending"), lte(notificationDeliveries.leaseUntil, stamp))), options.testEventId ? eq(notificationDeliveries.eventId, options.testEventId) : undefined);
  const jobs = await db.select().from(notificationDeliveries).where(due).limit(20);
  let processed = 0;
  // Bounded parallel dispatch keeps a slow endpoint from delaying every phone.
  for (let i = 0; i < jobs.length; i += 5) await Promise.all(jobs.slice(i, i + 5).map(async job => {
    const leaseToken = crypto.randomUUID();
    const claimed = await db.update(notificationDeliveries).set({ status: "sending", leaseToken, leaseUntil: new Date(at + 60_000).toISOString(), attempts: sql`${notificationDeliveries.attempts} + 1` }).where(and(eq(notificationDeliveries.id, job.id), due)).returning();
    if (!claimed.length) return;
    const [channel] = await db.select().from(notificationChannels).where(eq(notificationChannels.id, job.channelId)).limit(1);
    const [event] = await db.select().from(notificationOutbox).where(eq(notificationOutbox.id, job.eventId)).limit(1);
    const ownedLease = and(eq(notificationDeliveries.id, job.id), eq(notificationDeliveries.leaseToken, leaseToken));
    if (!channel?.active || !event || channel.organizationId !== event.organizationId) {
      await db.update(notificationDeliveries).set({ status: "canceled", leaseUntil: null, leaseToken: null }).where(ownedLease);
      return;
    }
    const streamGate = event.eventType === "marketplace.evidence" ? await (await import("./marketplace-stream")).marketplaceEventGate(event,channel.id) : null;
    if(streamGate?.mode === "cancel"){
      await db.update(notificationDeliveries).set({status:"canceled",lastError:streamGate.reason,leaseUntil:null,leaseToken:null}).where(ownedLease);return;
    }
    const gate = streamGate ? {ungated:streamGate.mode === "allow",reasons:streamGate.mode === "wait"?[streamGate.reason]:[]} : await (await import("./organization-access")).recipientEventGate(event);
    if (!gate.ungated) {
      await db.update(notificationDeliveries).set({ status: "blocked", attempts: sql`${notificationDeliveries.attempts} - 1`, nextAttemptAt: new Date(at + 15_000).toISOString(), lastError: gate.reasons.join(" "), leaseUntil: null, leaseToken: null }).where(ownedLease);
      return;
    }
    let statusCode: number | null = null;
    try {
      const response = await send(channel, event, options.transport || privateFetch);
      statusCode = response.status;
      await response.body?.cancel();
      if (!response.ok) throw Error("Delivery was not accepted.");
      await db.update(notificationDeliveries).set({ status: "delivered", deliveredAt: new Date().toISOString(), lastStatusCode: statusCode, lastError: null, leaseUntil: null, leaseToken: null }).where(ownedLease);
    } catch {
      const terminal = (channel.kind === "push" && (statusCode === 404 || statusCode === 410)) || claimed[0].attempts >= 10;
      await db.update(notificationDeliveries).set({ status: terminal ? "failed" : "retry", nextAttemptAt: new Date(at + retryDelay(claimed[0].attempts)).toISOString(), lastStatusCode: statusCode, lastError: statusCode ? "Remote endpoint did not accept delivery." : "Channel configuration or transport unavailable.", leaseUntil: null, leaseToken: null }).where(ownedLease);
      if (channel.kind === "push" && (statusCode === 404 || statusCode === 410)) await db.update(notificationChannels).set({ active: false }).where(eq(notificationChannels.id, channel.id));
    }
    processed++;
  }));
  return { enabled: true, processed };
}
