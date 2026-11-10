// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { env } from "./support/cloudflare-env";
import { claimInvitedLaboratory, confirmInvitedLaboratory, inviteLaboratoryForAdmin } from "../lib/lab-invite";
import { getOrganizationForUser, reviewIssuerApplication } from "../lib/tec";

const admin = { userId: "reviewer-a", email: "first@ics.test", displayName: "First", fullName: null };
const second = { userId: "reviewer-b", email: "second@ics.test", displayName: "Second", fullName: null };
const owner = { userId: "email:invited-owner", email: "quality@invited-lab.test", displayName: "Owner", fullName: null };
const input = {
  legalName: "Example Invited Laboratory",
  laboratoryAddress: "1 Example Street",
  laboratoryWebsite: "https://invited-lab.test",
  ownerName: "Example Owner",
  ownerEmail: owner.email,
  accreditationBody: "Example accreditation body",
  accreditationNumber: "EX-17025",
  accreditationExpiresOn: "2027-12-31",
  scopeSummary: "Example olive oil metals scope",
  accreditedSites: "Ann Arbor, MI",
  accreditedAnalytes: "Lead",
};
let mf: Miniflare;

beforeAll(async () => {
  mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('test')}}", compatibilityDate: "2026-05-22", d1Databases: ["DB"] });
  env.DB = await mf.getD1Database("DB");
  env.ICS_ADMIN_EMAILS = `${admin.email},${second.email}`;
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    for (const sql of readFileSync(`drizzle/${file}`, "utf8").split("--> statement-breakpoint")) {
      if (sql.trim()) await env.DB.prepare(sql).run();
    }
  }
  await env.DB.prepare("INSERT INTO auth_user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,0,0)").bind(owner.userId.slice(6), "Owner", owner.email).run();
}, 60000);

afterAll(async () => { await mf?.dispose(); });

it("lets an ICS admin prefill a lab and still requires two different admins", async () => {
  await expect(inviteLaboratoryForAdmin(owner, input)).rejects.toThrow(/ICS administrator/);
  await expect(inviteLaboratoryForAdmin(admin, { ...input, ownerEmail: admin.email })).rejects.toThrow(/own email/);
  const invite = await inviteLaboratoryForAdmin(admin, input);
  expect(invite.issuerStatus).toBe("pending");
  expect(invite.applicationStatus).toBe("invited");
  const stored = await env.DB.prepare("SELECT accredited_sites, accredited_analytes FROM issuer_applications WHERE id=?").bind(invite.applicationId).first<{ accredited_sites: string; accredited_analytes: string }>();
  expect(JSON.parse(stored!.accredited_sites)).toEqual(["Ann Arbor, MI"]);
  expect(JSON.parse(stored!.accredited_analytes)).toEqual(["Lead"]);
  expect(invite.mailto.startsWith("mailto:")).toBe(true);
  expect(decodeURIComponent(invite.mailto)).toContain(owner.email);
  expect(await getOrganizationForUser(owner.userId)).toBeNull();
  const claimed = await claimInvitedLaboratory(owner);
  expect(claimed?.organization.issuerStatus).toBe("pending");
  expect(claimed?.organization.organizationType).toBe("laboratory");
  await expect(reviewIssuerApplication(second, invite.applicationId, { decision: "approve", reviewNote: "Too early" })).rejects.toThrow(/signup verification|submitted/);
  const confirmed = await confirmInvitedLaboratory(owner);
  expect(confirmed).toMatchObject({ status: "submitted", issuerStatus: "application_submitted" });
  expect((await getOrganizationForUser(owner.userId))?.organization.issuerStatus).toBe("application_submitted");
  await expect(reviewIssuerApplication(second, invite.applicationId, { decision: "approve", reviewNote: "Missing the signing key and the second admin" })).rejects.toThrow(/public key|gates|Two different/);
  expect((await getOrganizationForUser(owner.userId))?.organization.issuerStatus).not.toBe("verified");
});
