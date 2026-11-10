import { and, desc, eq } from "drizzle-orm";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import { auditEvents, issuerApplications, organizationMembers, organizationNotifications, organizations } from "../db/schema";
import { laboratoryMailbox, requireConfirmedLaboratoryMailbox } from "./lab-signup-policy";
import { getOrganizationForUser, isIcsAdmin, TecAuthorizationError, TecInputError } from "./tec";

function clean(value: unknown, maximum = 180) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function now() {
  return new Date().toISOString();
}

function randomCharacters(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 52);
}

function issuerCodeFor(name: string) {
  const stem = name.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 4).padEnd(3, "X");
  return `${stem}${randomCharacters(3)}`;
}

function expiry(value: unknown) {
  const text = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new TecInputError("Enter the ISO/IEC 17025 certificate expiry as YYYY-MM-DD.");
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new TecInputError("Enter a real ISO/IEC 17025 certificate expiry date.");
  }
  return text;
}

function websiteUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new TecInputError("Laboratory website must be a complete http or https URL.");
  }
}

export function laboratoryInviteMailto(input: { ownerName: string; ownerEmail: string; legalName: string }) {
  const subject = "Confirm your TECRID laboratory";
  const body = `${input.ownerName},\n\nICS prepared a TECRID workspace for ${input.legalName}. Sign in with this email and confirm the details. The laboratory is not verified until two different ICS admins approve it.\n\nSign in: https://tecrid.com/sign-in?return_to=%2Fdashboard%2Flaboratory\n`;
  return `mailto:${encodeURIComponent(input.ownerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function inviteLaboratoryForAdmin(user: ChatGPTUser, input: Record<string, unknown>) {
  if (!isIcsAdmin(user)) throw new TecAuthorizationError("ICS administrator access required.");
  const legalName = clean(input.legalName);
  const laboratoryAddress = clean(input.laboratoryAddress, 300);
  const laboratoryWebsite = websiteUrl(clean(input.laboratoryWebsite, 300));
  const ownerName = clean(input.ownerName);
  const ownerEmail = clean(input.ownerEmail, 254).toLowerCase();
  const accreditationBody = clean(input.accreditationBody);
  const accreditationNumber = clean(input.accreditationNumber, 120);
  const accreditationExpiresOn = expiry(input.accreditationExpiresOn);
  const scopeSummary = clean(input.scopeSummary, 1800);
  if (!legalName || !laboratoryAddress || !ownerName || !accreditationBody || !accreditationNumber || !scopeSummary) {
    throw new TecInputError("Laboratory name, address, owner, accreditation body, certificate number, expiry, and scope are required.");
  }
  if (ownerEmail === user.email.toLowerCase()) {
    throw new TecInputError("Invite the laboratory owner. An ICS admin cannot invite their own email.");
  }
  laboratoryMailbox(ownerEmail, laboratoryWebsite);
  const db = getDb();
  const [emailOwner] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.ownerEmail, ownerEmail)).limit(1);
  const [emailMember] = await db.select({ id: organizationMembers.id }).from(organizationMembers).where(eq(organizationMembers.email, ownerEmail)).limit(1);
  if (emailOwner || emailMember) throw new TecInputError("That email already belongs to a TECRID workspace.");
  const createdAt = now();
  const organizationId = `org_${crypto.randomUUID().replaceAll("-", "")}`;
  const applicationId = `issuer_app_${crypto.randomUUID().replaceAll("-", "")}`;
  const inviteUserId = `invite:${ownerEmail}`;
  const issuerCode = issuerCodeFor(legalName);
  const mailto = laboratoryInviteMailto({ ownerName, ownerEmail, legalName });
  await db.batch([
    db.insert(organizations).values({
      id: organizationId,
      name: legalName,
      slug: `${slugify(legalName) || "laboratory"}-${crypto.randomUUID().slice(0, 8)}`,
      organizationType: "laboratory",
      website: laboratoryWebsite,
      ownerUserId: inviteUserId,
      ownerEmail,
      issuerCode,
      issuerStatus: "pending",
      plan: "free",
      createdAt,
      updatedAt: createdAt,
    }),
    db.insert(organizationMembers).values({
      organizationId,
      userId: inviteUserId,
      email: ownerEmail,
      role: "owner",
      createdAt,
    }),
    db.insert(issuerApplications).values({
      id: applicationId,
      organizationId,
      legalName,
      laboratoryAddress,
      laboratoryWebsite,
      authorityRole: "Laboratory owner",
      accreditationStatus: "accredited",
      accreditationBody,
      accreditationNumber,
      accreditationExpiresOn,
      scopeSummary,
      methodFamilies: "Pending laboratory confirmation",
      contactName: ownerName,
      contactEmail: ownerEmail,
      attested: false,
      status: "invited",
      submittedAt: createdAt,
    }),
    db.insert(auditEvents).values({
      id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
      organizationId,
      actorUserId: user.userId,
      eventType: "issuer.laboratory_invited",
      entityType: "issuer_application",
      entityId: applicationId,
      payload: JSON.stringify({ accreditationBody, accreditationNumber, accreditationExpiresOn, ownerEmail, issuerCode }),
      createdAt,
    }),
  ]);
  return { organizationId, applicationId, issuerCode, ownerEmail, legalName, mailto, issuerStatus: "pending" as const, applicationStatus: "invited" as const };
}

export async function listInvitedLaboratoriesForAdmin(user: ChatGPTUser) {
  if (!isIcsAdmin(user)) throw new TecAuthorizationError("ICS administrator access required.");
  const rows = await getDb()
    .select({ application: issuerApplications, organizationName: organizations.name, issuerCode: organizations.issuerCode, issuerStatus: organizations.issuerStatus })
    .from(issuerApplications)
    .innerJoin(organizations, eq(issuerApplications.organizationId, organizations.id))
    .where(eq(issuerApplications.status, "invited"))
    .orderBy(desc(issuerApplications.submittedAt));
  return rows.map((row) => ({
    id: row.application.id,
    legalName: row.application.legalName,
    ownerName: row.application.contactName,
    ownerEmail: row.application.contactEmail,
    issuerCode: row.issuerCode,
    issuerStatus: row.issuerStatus,
    mailto: laboratoryInviteMailto({ ownerName: row.application.contactName, ownerEmail: row.application.contactEmail, legalName: row.application.legalName }),
  }));
}

export async function claimInvitedLaboratory(user: ChatGPTUser) {
  const existing = await getOrganizationForUser(user.userId);
  if (existing) return existing;
  const email = user.email.trim().toLowerCase();
  const inviteUserId = `invite:${email}`;
  const db = getDb();
  const [organization] = await db.select().from(organizations).where(and(
    eq(organizations.organizationType, "laboratory"),
    eq(organizations.ownerEmail, email),
    eq(organizations.ownerUserId, inviteUserId),
  )).limit(1);
  if (!organization) return null;
  await db.batch([
    db.update(organizationMembers).set({ userId: user.userId }).where(and(eq(organizationMembers.organizationId, organization.id), eq(organizationMembers.userId, inviteUserId))),
    db.update(organizations).set({ ownerUserId: user.userId, updatedAt: now() }).where(eq(organizations.id, organization.id)),
  ]);
  return getOrganizationForUser(user.userId);
}

export async function confirmInvitedLaboratory(user: ChatGPTUser) {
  const membership = await claimInvitedLaboratory(user);
  if (!membership || membership.organization.organizationType !== "laboratory") {
    throw new TecAuthorizationError("This confirmation is only for an invited laboratory owner.");
  }
  const db = getDb();
  const [application] = await db.select().from(issuerApplications).where(eq(issuerApplications.organizationId, membership.organization.id)).orderBy(desc(issuerApplications.submittedAt)).limit(1);
  if (!application || application.status !== "invited") throw new TecInputError("There is no laboratory invitation waiting for confirmation.");
  if (application.contactEmail.toLowerCase() !== user.email.toLowerCase()) {
    throw new TecAuthorizationError("Sign in with the invited laboratory email to confirm.");
  }
  await requireConfirmedLaboratoryMailbox(user, application.laboratoryWebsite || "", application.contactEmail);
  const submittedAt = now();
  await db.batch([
    db.update(issuerApplications).set({ status: "submitted", attested: true, submittedAt }).where(and(eq(issuerApplications.id, application.id), eq(issuerApplications.status, "invited"))),
    db.update(organizations).set({ issuerStatus: "application_submitted", updatedAt: submittedAt }).where(eq(organizations.id, membership.organization.id)),
    db.insert(auditEvents).values({
      id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
      organizationId: membership.organization.id,
      actorUserId: user.userId,
      eventType: "issuer.application_submitted",
      entityType: "issuer_application",
      entityId: application.id,
      payload: JSON.stringify({ signupVerificationVersion: 1, workEmailConfirmed: true, invitedByIcs: true, accreditationBody: application.accreditationBody, accreditationNumber: application.accreditationNumber }),
      createdAt: submittedAt,
    }),
    db.insert(organizationNotifications).values({
      id: `notice_${application.id}_submitted`,
      organizationId: membership.organization.id,
      eventType: "issuer.application_submitted",
      entityType: "issuer_application",
      entityId: application.id,
      title: "Lab application submitted",
      body: "Your application is awaiting independent ICS review. Issuing remains locked.",
      actionPath: "/dashboard/laboratory",
      createdAt: submittedAt,
    }),
  ]);
  return { id: application.id, status: "submitted" as const, issuerStatus: "application_submitted" as const };
}
