import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { controllerEvidenceReceipts, credentials, evidenceDeliveries, marketplaceStreamEvents, notificationChannels, notificationDeliveries, notificationOutbox, organizations } from "../db/schema";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { getOrganizationForUser, TecAuthorizationError } from "./tec";

export type TimelineEvent = { eventId: string; event: string; destination: string; kind: string; status: string; queuedAt: string; deliveredAt: string | null; acknowledgedAt: string | null; latencyMs: number | null; target: string };
export type TimelineRecord = { tecrid: string; sku: string | null; mintedAt: string | null; events: TimelineEvent[] };
export async function brandDeliveryTimeline(user: ChatGPTUser): Promise<TimelineRecord[]> {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership || !["brand", "supplier"].includes(membership.organization.organizationType)) throw new TecAuthorizationError("A controlling brand or supplier workspace is required.");
  const db = getDb(), controllerId = membership.organization.id;
  const receipts = await db.select({ credential: credentials }).from(controllerEvidenceReceipts).innerJoin(credentials, eq(controllerEvidenceReceipts.credentialIdentifier, credentials.identifier)).where(eq(controllerEvidenceReceipts.controllerOrganizationId, controllerId)).orderBy(desc(controllerEvidenceReceipts.deliveredAt)).limit(20);
  if (!receipts.length) return [];
  const identifiers = receipts.map(row => row.credential.identifier);
  const deliveries = (await db.select().from(evidenceDeliveries).where(eq(evidenceDeliveries.controllerOrganizationId, controllerId)).orderBy(desc(evidenceDeliveries.deliveredAt)).limit(60)).filter(row => identifiers.includes(row.credentialIdentifier));
  const streams = deliveries.length ? await db.select({id:marketplaceStreamEvents.id,tecrid:marketplaceStreamEvents.credentialIdentifier,recipientId:marketplaceStreamEvents.recipientOrganizationId,event:sql<string>`json_extract(${marketplaceStreamEvents.bodyJson}, '$.event')`}).from(marketplaceStreamEvents).where(inArray(marketplaceStreamEvents.deliveryId,deliveries.map(row=>row.id))).orderBy(desc(marketplaceStreamEvents.sequence)).limit(120) : [];
  const events = await db.select().from(notificationOutbox).where(inArray(notificationOutbox.entityId, [...identifiers, ...deliveries.map(row => row.id), ...streams.map(row=>row.id)])).orderBy(desc(notificationOutbox.occurredAt)).limit(120);
  const allowed = events.filter(event => event.organizationId === controllerId || streams.some(stream=>stream.id===event.entityId&&stream.recipientId===event.organizationId) || deliveries.some(delivery => delivery.recipientOrganizationId === event.organizationId && (delivery.id === event.entityId || delivery.credentialIdentifier === event.entityId)));
  const jobs = allowed.length ? await db.select({ job: notificationDeliveries, kind: notificationChannels.kind }).from(notificationDeliveries).innerJoin(notificationChannels, eq(notificationDeliveries.channelId, notificationChannels.id)).where(inArray(notificationDeliveries.eventId, allowed.map(event => event.id))) : [];
  const destinations = [...new Set([controllerId, ...deliveries.map(delivery => delivery.recipientOrganizationId)])];
  const names = new Map((await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, destinations))).map(row => [row.id, row.name]));
  return receipts.map(({ credential }) => ({
    tecrid: credential.identifier, sku: credential.productSku, mintedAt: credential.issuedAt,
    events: allowed.filter(event => event.entityId === credential.identifier || streams.some(stream=>stream.id===event.entityId&&stream.tecrid===credential.identifier) || deliveries.some(delivery => delivery.id === event.entityId && delivery.credentialIdentifier === credential.identifier)).flatMap(event => {
      const matching = jobs.filter(row => row.job.eventId === event.id);
      const eventType=streams.find(stream=>stream.id===event.entityId)?.event || event.eventType;
      const start = ["credential.corrected", "credential.revoked", "grant.revoked"].includes(eventType) ? event.occurredAt : credential.issuedAt || event.occurredAt;
      const rows = matching.length ? matching : [{ job: null, kind: "No active channel" }];
      return rows.map(({ job, kind }) => {
        const latencyMs = job?.deliveredAt ? Math.max(0, Date.parse(job.deliveredAt) - Date.parse(start)) : null;
        return { eventId: event.id, event: eventType, destination: names.get(event.organizationId) || "Recipient", kind, status: job?.status || "queued", queuedAt: event.expandedAt || event.occurredAt, deliveredAt: job?.deliveredAt || null, acknowledgedAt: job?.acknowledgedAt || null, latencyMs, target: latencyMs !== null ? latencyMs < 60_000 ? "Under 60 seconds" : "Over 60 seconds" : Date.now() - Date.parse(start) >= 60_000 ? "Overdue" : "Pending" };
      });
    }),
  }));
}
