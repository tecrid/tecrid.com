import {currentRecipientDelivery} from "./recipient-access";
import {notificationPayload} from "./notification-delivery";

type Event = Parameters<typeof notificationPayload>[0] & { organizationId: string; entityId: string };

// Only a concrete, authorized recipient delivery may carry a snapshot.
// Push, email, laboratory events, and lifecycle invalidations stay metadata-only.
export async function recipientWebhookPayload(event: Event) {
  const metadata = notificationPayload(event);
  if (event.eventType !== "evidence_routing.delivered") return metadata;
  const row = await currentRecipientDelivery(event.entityId, event.organizationId);
  if (!row) throw Error("Recipient delivery authority, integrity or verified evidence is no longer current.");
  const { delivery, record } = row;
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
