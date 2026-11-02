import { eq, inArray, like } from "drizzle-orm";
import { getDb } from "../db";
import {
  controllerEvidenceReceipts,
  evidenceDeliveries,
  evidenceShareRedemptions,
  organizationMembers,
  organizationNotifications,
} from "../db/schema";
import { sendOperationalEmail } from "./operational-email";

async function memberEmails(organizationIds: string[]) {
  if (!organizationIds.length) return [];
  const db = getDb();
  const members = await db
    .select({ email: organizationMembers.email })
    .from(organizationMembers)
    .where(inArray(organizationMembers.organizationId, organizationIds));
  return [...new Set(members.map((member) => member.email.trim().toLowerCase()).filter(Boolean))];
}

export async function insertOrganizationNotices(organizationIds: string[], notice: {
  eventType: string;
  title: string;
  body: string;
  actionPath: string;
  entityType: string;
  entityId: string;
}) {
  const ids = [...new Set(organizationIds.filter(Boolean))];
  if (!ids.length) return;
  const createdAt = new Date().toISOString();
  const db = getDb();
  await db.insert(organizationNotifications).values(ids.map((organizationId) => ({
    id: crypto.randomUUID(),
    organizationId,
    eventType: notice.eventType,
    title: notice.title,
    body: notice.body,
    actionPath: notice.actionPath,
    entityType: notice.entityType,
    entityId: notice.entityId,
    createdAt,
  })));
}

export async function emailOrganizationMembers(organizationIds: string[], notice: {
  eventType: string;
  title: string;
  body: string;
  url: string;
}) {
  const emails = await memberEmails([...new Set(organizationIds.filter(Boolean))]);
  await Promise.all(emails.map((email) => sendOperationalEmail({ email, ...notice })));
}

export async function notifyRevisionAudience(input: {
  identifier: string;
  action: "correct" | "revoke";
  reason: string;
  version: number;
}) {
  const db = getDb();
  const [deliveries, receipts, redemptions] = await Promise.all([
    db.select({ organizationId: evidenceDeliveries.recipientOrganizationId }).from(evidenceDeliveries).where(eq(evidenceDeliveries.credentialIdentifier, input.identifier)),
    db.select({ organizationId: controllerEvidenceReceipts.controllerOrganizationId }).from(controllerEvidenceReceipts).where(eq(controllerEvidenceReceipts.credentialIdentifier, input.identifier)),
    db.select({ organizationId: evidenceShareRedemptions.recipientOrganizationId }).from(evidenceShareRedemptions).where(like(evidenceShareRedemptions.packageJson, `%${input.identifier.replace(/[%_]/g, "")}%`)),
  ]);
  const organizationIds = [...new Set([...deliveries, ...receipts, ...redemptions].map((row) => row.organizationId))];
  const eventType = input.action === "revoke" ? "credential.revoked" : "credential.corrected";
  const title = input.action === "revoke" ? `${input.identifier} was revoked` : `${input.identifier} was corrected`;
  const body = `Version ${input.version} is now ${input.action === "revoke" ? "revoked" : "corrected"}. Reason: ${input.reason}`;
  const actionPath = `/records/${encodeURIComponent(input.identifier)}`;
  await insertOrganizationNotices(organizationIds, {
    eventType,
    title,
    body,
    actionPath,
    entityType: "credential",
    entityId: input.identifier,
  });
  await emailOrganizationMembers(organizationIds, {
    eventType,
    title,
    body,
    url: `https://tecrid.com${actionPath}`,
  });
}
