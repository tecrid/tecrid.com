// @vitest-environment node
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { eq } from "drizzle-orm";
import { env } from "./support/cloudflare-env";
import { getDb } from "../db";
import { apiKeys, auditEvents, legacyReports, organizationMembers, organizations } from "../db/schema";
import { guardMutationRequest } from "../lib/abuse-budget";
import { getLegacyConfirmation, manageLegacyConfirmation } from "../lib/legacy-reports";
import { createSandboxApiKey, revokeSandboxApiKey } from "../lib/sandbox";
import { authenticateApiRequest, createApiKey, revokeApiKey } from "../lib/tec";

const labUser = { userId: "gate-lab", email: "quality@gate-lab.test", displayName: "Lab", fullName: null };
const brandUser = { userId: "gate-brand", email: "owner@gate-brand.test", displayName: "Brand", fullName: null };
const mailbox = { userId: "email:gate-mailbox", email: "lab@gate-lab.test", displayName: "Mailbox", fullName: null };
let mf: Miniflare;

beforeAll(async () => {
  mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('test')}}", compatibilityDate: "2026-05-22", d1Databases: ["DB"], r2Buckets: ["DOCUMENTS"] });
  env.DB = await mf.getD1Database("DB");
  env.DOCUMENTS = await mf.getR2Bucket("DOCUMENTS");
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    for (const statement of readFileSync(`drizzle/${file}`, "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) await env.DB.prepare(statement).run();
    }
  }
  await getDb().insert(organizations).values([
    { id: labUser.userId, name: "Gate Lab", slug: "gate-lab", organizationType: "laboratory", ownerUserId: labUser.userId, ownerEmail: labUser.email, issuerCode: "GATELAB", issuerStatus: "pending" },
    { id: brandUser.userId, name: "Gate Brand", slug: "gate-brand", organizationType: "brand", ownerUserId: brandUser.userId, ownerEmail: brandUser.email, issuerCode: "GATEBRAND", issuerStatus: "not_applicable" },
  ]);
  await getDb().insert(organizationMembers).values([
    { organizationId: labUser.userId, userId: labUser.userId, email: labUser.email, role: "owner" },
    { organizationId: brandUser.userId, userId: brandUser.userId, email: brandUser.email, role: "owner" },
  ]);
}, 60000);

afterAll(async () => { await mf?.dispose(); });

it("refuses production write keys until the laboratory is verified, including a legacy wildcard", async () => {
  await expect(createApiKey(brandUser, "Brand write", ["credentials:write"])).rejects.toThrow(/verified laboratory/);
  await expect(createApiKey(labUser, "Pending write", ["credentials:write"])).rejects.toThrow(/verified laboratory/);
  const read = await createApiKey(labUser, "Pending read", ["read"]);
  await getDb().update(apiKeys).set({ scopes: '["*"]' }).where(eq(apiKeys.id, read.id));
  await expect(authenticateApiRequest(new Request("https://tecrid.com/api/v1/credentials", { method: "POST", headers: { authorization: `Bearer ${read.plainTextKey}` } }))).rejects.toThrow(/does not permit/);
  await getDb().update(organizations).set({ issuerStatus: "verified" }).where(eq(organizations.id, labUser.userId));
  const write = await createApiKey(labUser, "Verified write", ["credentials:write"]);
  expect((await authenticateApiRequest(new Request("https://tecrid.com/api/v1/credentials", { method: "POST", headers: { authorization: `Bearer ${write.plainTextKey}` } }))).organization.id).toBe(labUser.userId);
  await getDb().update(organizations).set({ issuerStatus: "suspended" }).where(eq(organizations.id, labUser.userId));
  await expect(authenticateApiRequest(new Request("https://tecrid.com/api/v1/credentials", { method: "POST", headers: { authorization: `Bearer ${write.plainTextKey}` } }))).rejects.toThrow(/does not permit/);
});

it("rolls a key back when its audit event cannot be stored", async () => {
  const before = (await getDb().select().from(apiKeys)).length;
  await env.DB.prepare("CREATE TRIGGER reject_gate_audit BEFORE INSERT ON audit_events WHEN NEW.event_type = 'api_key.created' BEGIN SELECT RAISE(ABORT, 'synthetic audit outage'); END").run();
  await createApiKey(labUser, "Rollback", ["read"]).catch(() => {});
  expect((await getDb().select().from(apiKeys)).length).toBe(before);
  await env.DB.prepare("DROP TRIGGER reject_gate_audit").run();
  const key = await createApiKey(labUser, "Audited", ["read"]);
  const events = await getDb().select().from(auditEvents).where(eq(auditEvents.entityId, key.id));
  expect(events.map((event) => event.eventType)).toEqual(["api_key.created"]);
  expect(JSON.stringify(events)).not.toContain(key.plainTextKey);
  expect((await revokeApiKey(labUser, key.id)).id).toBe(key.id);
});

it("records sandbox key changes without the secret", async () => {
  const key = await createSandboxApiKey(brandUser, "Synthetic sandbox");
  await revokeSandboxApiKey(brandUser, key.id);
  const events = await getDb().select().from(auditEvents).where(eq(auditEvents.entityId, key.id));
  expect(events.map((event) => event.eventType)).toEqual(["sandbox_api_key.created", "sandbox_api_key.revoked"]);
  expect(JSON.stringify(events)).not.toContain(key.plainTextKey);
});

it("expires confirmation links and lets an administrator revoke the replacement", async () => {
  const token = "confirm-token-gate-current";
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), (byte) => byte.toString(16).padStart(2, "0")).join("");
  await getDb().insert(legacyReports).values({
    id: "intake-gate",
    submittingOrganizationId: brandUser.userId,
    submittedByUserId: brandUser.userId,
    status: "awaiting_lab_claim",
    laboratoryName: "Gate Lab",
    confirmationEmail: mailbox.email,
    confirmationTokenHash: hash,
    confirmationTokenLastFour: token.slice(-4),
    sampleName: "Synthetic",
    sourceObjectKey: "legacy-reports/gate/intake-gate/synthetic.pdf",
    sourceFilename: "synthetic.pdf",
    sourceMimeType: "application/pdf",
    sourceSize: 12,
    sourceSha256: "ab".repeat(32),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  expect(await getLegacyConfirmation(mailbox, token)).not.toBeNull();
  const started = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(started + 25 * 60 * 60 * 1000);
  expect(await getLegacyConfirmation(mailbox, token)).toBeNull();
  clock.mockRestore();
  await getDb().update(legacyReports).set({ status: "withdrawn" }).where(eq(legacyReports.id, "intake-gate"));
  expect(await getLegacyConfirmation(mailbox, token)).toBeNull();
  await getDb().update(legacyReports).set({ status: "awaiting_lab_claim" }).where(eq(legacyReports.id, "intake-gate"));
  const rotated = await manageLegacyConfirmation(brandUser, "intake-gate", "rotate");
  expect(await getLegacyConfirmation(mailbox, token)).toBeNull();
  const next = rotated.confirmationPath!.split("/").at(-1)!;
  expect(await getLegacyConfirmation(mailbox, next)).not.toBeNull();
  await manageLegacyConfirmation(brandUser, "intake-gate", "revoke");
  expect(await getLegacyConfirmation(mailbox, next)).toBeNull();
});

it("does not let one client exhaust the shared mutation budget", async () => {
  const mutation = (ip: string) => new Request("https://tecrid.com/api/auth/sign-in/magic-link", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: "{}",
  });
  const limited = { DB: env.DB, TECRID_API_IP_LIMIT: "2", TECRID_API_GLOBAL_LIMIT: "1" };
  const outcomes = await Promise.all(Array.from({ length: 8 }, () => guardMutationRequest(mutation("192.0.2.20"), limited)));
  expect(outcomes.filter((result) => result instanceof Request)).toHaveLength(2);
  expect(await guardMutationRequest(mutation("192.0.2.21"), limited)).toBeInstanceOf(Request);
  expect((await guardMutationRequest(mutation("192.0.2.40"), {})).status).toBe(503);
});
