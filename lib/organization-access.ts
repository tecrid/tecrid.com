import { and, eq, or } from "drizzle-orm";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import { auditEvents, deliveryPolicy, evidenceAccessGrants, evidenceDeliveries, organizations, participantProfiles } from "../db/schema";
import { getOrganizationForUser, isIcsAdmin, TecAuthorizationError, TecInputError } from "./tec";

const RECIPIENT_TYPES = new Set(["certification_body", "retailer", "government", "marketplace"]);
export type TermsPolicy = { termsRequired: boolean; termsVersion: string; termsUrl: string };
export function computeOrganizationGate(input: { identityVerified: boolean; activeGrant: boolean; termsAcceptedAt: string | null; acceptedVersion: string | null }, policy: TermsPolicy) {
  const reasons: string[] = [];
  if (!input.identityVerified) reasons.push("Organization identity is not verified.");
  if (!input.activeGrant) reasons.push("No active grant from the controlling brand or supplier.");
  if (policy.termsRequired) {
    if (!policy.termsUrl || !policy.termsVersion) reasons.push("Required terms are not configured.");
    else if (!input.termsAcceptedAt || input.acceptedVersion !== policy.termsVersion) reasons.push("The current terms have not been accepted.");
  }
  return { ungated: !reasons.length, status: reasons.length ? "GATED" : "UNGATED", reasons, termsRequired: policy.termsRequired };
}
export async function getDeliveryPolicy(): Promise<TermsPolicy> {
  const [policy] = await getDb().select().from(deliveryPolicy).where(eq(deliveryPolicy.id, "global")).limit(1);
  // A missing policy after a partial migration fails closed.
  return policy || { termsRequired: true, termsVersion: "", termsUrl: "" };
}
export async function organizationGate(organizationId: string, controllerId?: string) {
  const db = getDb();
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!organization) return { ungated: false, status: "GATED", reasons: ["Organization not found."], termsRequired: false };
  const [profile] = await db.select({ verified: participantProfiles.registryVerified }).from(participantProfiles).where(eq(participantProfiles.organizationId, organizationId)).limit(1);
  const grants = await db.select({ id: evidenceAccessGrants.id }).from(evidenceAccessGrants).innerJoin(organizations, eq(evidenceAccessGrants.controllerOrganizationId, organizations.id)).where(and(eq(evidenceAccessGrants.recipientOrganizationId, organizationId), eq(evidenceAccessGrants.status, "active"), or(eq(organizations.organizationType, "brand"), eq(organizations.organizationType, "supplier")), controllerId ? eq(evidenceAccessGrants.controllerOrganizationId, controllerId) : undefined)).limit(1);
  const identityVerified = organization.identityStatus === "verified" || (organization.identityStatus === "unreviewed" && (organization.issuerStatus === "verified" || profile?.verified === true));
  return computeOrganizationGate({ identityVerified, activeGrant: !!grants.length, termsAcceptedAt: organization.termsAcceptedAt, acceptedVersion: organization.termsVersion }, await getDeliveryPolicy());
}
export async function grantDeliveryGate(grant: { recipientOrganizationId: string; controllerOrganizationId: string; status: string }) {
  const gate = await organizationGate(grant.recipientOrganizationId, grant.controllerOrganizationId);
  if (grant.status !== "active") return { ...gate, ungated: false, status: "GATED", reasons: [...gate.reasons, "This grant is not active."] };
  return gate;
}
export async function recipientEventGate(event: { eventType: string; entityId: string; organizationId: string }) {
  if (event.eventType === "notification.test") return { ungated: true, reasons: [] as string[] };
  const db = getDb();
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, event.organizationId)).limit(1);
  if (!organization) return { ungated: false, reasons: ["Organization not found."] };
  // The controlling brand's own receipt and the issuer's events are distinct
  // from onward recipient delivery, which requires an incoming brand grant.
  if (!RECIPIENT_TYPES.has(organization.organizationType)) return { ungated: true, reasons: [] as string[] };
  const deliveries = await db.select({ grant: evidenceAccessGrants }).from(evidenceDeliveries).innerJoin(evidenceAccessGrants, eq(evidenceDeliveries.grantId, evidenceAccessGrants.id)).where(and(eq(evidenceDeliveries.recipientOrganizationId, event.organizationId), or(eq(evidenceDeliveries.id, event.entityId), eq(evidenceDeliveries.credentialIdentifier, event.entityId))));
  if (!deliveries.length) return organizationGate(organization.id);
  const gates = await Promise.all(deliveries.map(({ grant }) => grantDeliveryGate(grant)));
  return gates.find(gate => gate.ungated) || gates[0];
}
async function owner(user: ChatGPTUser) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) throw new TecAuthorizationError("An organization owner or administrator is required.");
  return membership;
}
export async function acceptOrganizationTerms(user: ChatGPTUser, input: Record<string, unknown>) {
  const { organization } = await owner(user);
  const policy = await getDeliveryPolicy();
  if (!policy.termsUrl || !policy.termsVersion) throw new TecInputError("No terms document is configured.");
  if (input.accepted !== true || input.termsVersion !== policy.termsVersion) throw new TecInputError("Review and accept the currently linked terms version.");
  if (organization.termsVersion === policy.termsVersion && organization.termsAcceptedAt) return { termsVersion: organization.termsVersion, termsAcceptedAt: organization.termsAcceptedAt };
  const termsAcceptedAt = new Date().toISOString();
  await getDb().batch([
    getDb().update(organizations).set({ termsAcceptedAt, termsVersion: policy.termsVersion }).where(eq(organizations.id, organization.id)),
    getDb().insert(auditEvents).values({ id: crypto.randomUUID(), organizationId: organization.id, actorUserId: user.userId, eventType: "organization.terms_accepted", entityType: "organization", entityId: organization.id, payload: JSON.stringify({ termsVersion: policy.termsVersion, termsUrl: policy.termsUrl }), createdAt: termsAcceptedAt }),
  ]);
  return { termsVersion: policy.termsVersion, termsAcceptedAt };
}
export async function configureDeliveryPolicy(user: ChatGPTUser, input: Record<string, unknown>) {
  if (!isIcsAdmin(user)) throw new TecAuthorizationError("ICS operator access is required.");
  const termsVersion = typeof input.termsVersion === "string" ? input.termsVersion.trim().slice(0, 100) : "";
  const termsUrl = typeof input.termsUrl === "string" ? input.termsUrl.trim() : "";
  const termsRequired = input.termsRequired === true;
  if (termsUrl) { try { const url = new URL(termsUrl); if (url.protocol !== "https:" || url.username || url.password) throw Error(); } catch { throw new TecInputError("Use an HTTPS terms URL without credentials."); } }
  if (termsRequired && (!termsUrl || !termsVersion)) throw new TecInputError("A terms URL and version are required before enabling the requirement.");
  const updatedAt = new Date().toISOString();
  await getDb().batch([
    getDb().insert(deliveryPolicy).values({ id: "global", termsVersion, termsUrl, termsRequired, updatedAt, updatedByUserId: user.userId }).onConflictDoUpdate({ target: deliveryPolicy.id, set: { termsVersion, termsUrl, termsRequired, updatedAt, updatedByUserId: user.userId } }),
    getDb().insert(auditEvents).values({ id: crypto.randomUUID(), actorUserId: user.userId, eventType: "delivery_policy.updated", entityType: "delivery_policy", entityId: "global", payload: JSON.stringify({ termsVersion, termsUrl, termsRequired }), createdAt: updatedAt }),
  ]);
  return { termsVersion, termsUrl, termsRequired };
}
export async function reviewOrganizationIdentity(user: ChatGPTUser, input: Record<string, unknown>) {
  if (!isIcsAdmin(user)) throw new TecAuthorizationError("ICS operator access is required.");
  const code = String(input.organizationCode || "").trim().toUpperCase();
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 1000) : "";
  if (typeof input.verified !== "boolean" || note.length < 10) throw new TecInputError("An identity decision and evidence note are required.");
  const db = getDb(); const [organization] = await db.select().from(organizations).where(eq(organizations.issuerCode, code)).limit(1);
  if (!organization) throw new TecInputError("Organization not found.");
  const createdAt = new Date().toISOString();
  await db.batch([
    db.update(organizations).set({ identityStatus: input.verified ? "verified" : "revoked" }).where(eq(organizations.id, organization.id)),
    db.update(participantProfiles).set({ registryVerified: input.verified }).where(eq(participantProfiles.organizationId, organization.id)),
    db.insert(auditEvents).values({ id: crypto.randomUUID(), organizationId: organization.id, actorUserId: user.userId, eventType: "organization.identity_reviewed", entityType: "organization", entityId: organization.id, payload: JSON.stringify({ verified: input.verified, note }), createdAt }),
  ]);
  return organizationGate(organization.id);
}
