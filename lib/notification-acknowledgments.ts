import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "../db";
import { auditEvents, notificationChannels, notificationDeliveries, notificationOutbox } from "../db/schema";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { getOrganizationForUser, TecAuthorizationError, TecInputError } from "./tec";
import { openConfig, signWebhook } from "./notification-security";

async function acknowledge(channelId: string, eventId: string, actorUserId: string | null) {
  const db = getDb(); const acknowledgedAt = new Date().toISOString();
  const [job] = await db.select({ delivery: notificationDeliveries, channel: notificationChannels, event: notificationOutbox }).from(notificationDeliveries)
    .innerJoin(notificationChannels, eq(notificationDeliveries.channelId, notificationChannels.id)).innerJoin(notificationOutbox, eq(notificationDeliveries.eventId, notificationOutbox.id))
    .where(and(eq(notificationDeliveries.channelId, channelId), eq(notificationDeliveries.eventId, eventId))).limit(1);
  if (!job || job.channel.organizationId !== job.event.organizationId || !["delivered", "sending"].includes(job.delivery.status)) throw new TecInputError("No dispatched delivery matches this acknowledgment.");
  const changed = await db.update(notificationDeliveries).set({ acknowledgedAt }).where(and(eq(notificationDeliveries.id, job.delivery.id), isNull(notificationDeliveries.acknowledgedAt))).returning({ id: notificationDeliveries.id });
  if (changed.length) await db.insert(auditEvents).values({ id: crypto.randomUUID(), organizationId: job.event.organizationId, actorUserId, eventType: "notification.acknowledged", entityType: "notification_delivery", entityId: job.delivery.id, payload: JSON.stringify({ eventId, kind: job.channel.kind }), createdAt: acknowledgedAt });
  const [saved] = await db.select({ acknowledgedAt: notificationDeliveries.acknowledgedAt }).from(notificationDeliveries).where(eq(notificationDeliveries.id, job.delivery.id));
  return { eventId, acknowledgedAt: saved.acknowledgedAt };
}
export async function acknowledgeOwnedNotification(user: ChatGPTUser, input: Record<string, unknown>) {
  const membership = await getOrganizationForUser(user.userId);
  const channelId = String(input.channelId || ""), eventId = String(input.eventId || "");
  const [channel] = await getDb().select().from(notificationChannels).where(and(eq(notificationChannels.id, channelId), eq(notificationChannels.organizationId, membership?.organization.id || ""), or(eq(notificationChannels.kind, "push"), eq(notificationChannels.kind, "email")))).limit(1);
  if (!membership || !channel) throw new TecAuthorizationError("This notification does not belong to your organization.");
  return acknowledge(channelId, eventId, user.userId);
}
export async function acknowledgeSignedWebhook(request: Request, raw: string) {
  if (Buffer.byteLength(raw) > 4096) throw new TecInputError("Acknowledgment body is too large.");
  const input = JSON.parse(raw) as Record<string, unknown>;
  const channelId = String(input.channelId || ""), eventId = String(input.eventId || "");
  const signature = request.headers.get("x-tecrid-signature") || "";
  const match = /^t=(\d{10}),v1=([a-f0-9]{64})$/.exec(signature);
  if (!match || Math.abs(Date.now() / 1000 - Number(match[1])) > 300) throw new TecAuthorizationError("A fresh signed acknowledgment is required.");
  const [channel] = await getDb().select().from(notificationChannels).where(and(eq(notificationChannels.id, channelId), eq(notificationChannels.kind, "webhook"), eq(notificationChannels.active, true))).limit(1);
  if (!channel) throw new TecAuthorizationError("A fresh signed acknowledgment is required.");
  const config = await openConfig(channel.encryptedConfig, channel.organizationId);
  const expected = await signWebhook(config.secret, match[1], raw);
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(match[2]))) throw new TecAuthorizationError("A fresh signed acknowledgment is required.");
  return acknowledge(channelId, eventId, null);
}
