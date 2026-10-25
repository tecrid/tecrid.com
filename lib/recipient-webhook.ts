import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { evidenceAccessGrants, evidenceDeliveries, routingAuthorizations } from "../db/schema";
import { grantDeliveryGate } from "./organization-access";
import { notificationPayload } from "./notification-delivery";
import { getCredential } from "./tec";

type Event = Parameters<typeof notificationPayload>[0] & { organizationId: string; entityId: string };

// Only a concrete, authorized recipient delivery may carry a snapshot.
// Push, email, laboratory events, and lifecycle invalidations stay metadata-only.
export async function recipientWebhookPayload(event: Event) {
  const metadata = notificationPayload(event);
  if (event.eventType !== "evidence_routing.delivered") return metadata;
  const db = getDb();
  const [row] = await db.select({ delivery: evidenceDeliveries, grant: evidenceAccessGrants, authorization: routingAuthorizations })
    .from(evidenceDeliveries)
    .innerJoin(evidenceAccessGrants, eq(evidenceDeliveries.grantId, evidenceAccessGrants.id))
    .innerJoin(routingAuthorizations, eq(evidenceDeliveries.routingAuthorizationId, routingAuthorizations.id))
    .where(and(eq(evidenceDeliveries.id, event.entityId), eq(evidenceDeliveries.recipientOrganizationId, event.organizationId))).limit(1);
  if (!row || !(await grantDeliveryGate(row.grant)).ungated || row.authorization.status !== "active") throw Error("Recipient delivery authority is no longer current.");
  const { delivery, grant } = row;
  const record = await getCredential(delivery.credentialIdentifier);
  if (!record || record.credential.status !== "issued" || record.credential.version !== delivery.credentialVersion || !record.integrity.issuerSignatureVerified || !record.integrity.fingerprintValid || !record.integrity.currentVersionConsistent) throw Error("Recipient record is no longer current or verified.");
  const snapshotHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(delivery.snapshotJson))), byte => byte.toString(16).padStart(2, "0")).join("");
  if (delivery.accessLevel !== grant.accessLevel || delivery.controllerOrganizationId !== grant.controllerOrganizationId || delivery.recipientOrganizationId !== grant.recipientOrganizationId || snapshotHash !== delivery.snapshotFingerprint) throw Error("Recipient snapshot integrity failed.");
  const snapshot = JSON.parse(delivery.snapshotJson);
  if (snapshot.tecrid !== record.credential.identifier || snapshot.version !== record.credential.version) throw Error("Recipient snapshot version failed.");
  const verificationUrl = new URL(`/records/${encodeURIComponent(record.credential.identifier)}`, metadata.url).href;
  return {
    ...metadata,
    schemaVersion: "tecrid.delivery/1",
    delivery: {
      id: delivery.id,
      grantId: delivery.grantId,
      controllerOrganizationId: delivery.controllerOrganizationId,
      recipientOrganizationId: delivery.recipientOrganizationId,
      tecrid: delivery.credentialIdentifier,
      version: delivery.credentialVersion,
      link: { verificationUrl, productSku: record.credential.productSku, ingredientCode: record.credential.ingredientCode, lotNumber: record.credential.lotNumber },
      accessLevel: delivery.accessLevel,
      snapshotJson: delivery.snapshotJson,
      snapshotFingerprint: delivery.snapshotFingerprint,
      fingerprintAlgorithm: "SHA-256",
      deliveredAt: delivery.deliveredAt,
    },
  };
}
