// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { eq } from "drizzle-orm";
import { env } from "./support/cloudflare-env";
import { getDb } from "../db";
import {
  credentialVersions,
  credentials,
  controllerEvidenceReceipts,
  evidenceAccessGrants,
  evidenceDeliveries,
  evidenceRequests,
  evidenceShareCodes,
  evidenceShareRedemptions,
  organizationMembers,
  organizationNotifications,
  organizations,
  routingAuthorizations,
} from "../db/schema";
import { removeClientIdentityHeaders } from "../lib/request-security";
import { createApiKey, createCredential, canonicalizeCredential, canonicalizeCredentialRevision, createCredentialRevision, generateTecridIdentifier, getCredential, getIssuer, publicCredentialDocument } from "../lib/tec";
import { resignBoundPayloads } from "../lib/resign-bound-payload";
import { createEvidenceRequest, respondToEvidenceRequest, revokeEvidenceGrant, listEvidenceDeliveriesForOrganization, listEvidenceRoutingForUser } from "../lib/evidence-routing";
import { createEvidenceShareCode, listSharingForUser, redeemEvidenceShareCode, revokeEvidenceShareCode } from "../lib/sharing";
import { createVerificationCheck } from "../lib/lab-defense";
import { getEvidenceInsightsForOrganization } from "../lib/insights";
import { createLegacyReport } from "../lib/legacy-reports";
import { adminFactorSatisfied, beginAdminEnrollment, confirmAdminEnrollment, totpCode, verifyAdminSecondFactor } from "../lib/admin-mfa";
import { GET as versions } from "../app/api/v1/credentials/[identifier]/versions/route";
import { POST as adminReview } from "../app/api/admin/issuer-applications/[applicationId]/route";

const current = vi.hoisted(() => ({ user: null as { userId: string; email: string; displayName: string; fullName: string | null } | null }));
const mail = vi.hoisted(() => ({ items: [] as Array<{ url: string; body: { noticeType?: string; email?: string; text?: string; kind?: string } }> }));
vi.mock("../app/chatgpt-auth", () => ({ getChatGPTUser: async () => current.user }));
vi.mock("../lib/private-fetch", () => ({
  privateFetch: async (url: string, init: { body?: string }) => {
    mail.items.push({ url: String(url), body: JSON.parse(init.body ?? "{}") });
    return new Response("{}", { status: 200 });
  },
}));

const user = (id: string, email: string) => ({ userId: id, email, displayName: id, fullName: null as string | null });
const brandOwner = user("brand-owner", "owner@brand.test");
const brandMember = user("brand-member", "member@brand.test");
const labOwner = user("lab-owner", "owner@lab.test");
const labMember = user("lab-member", "member@lab.test");
const retailer = user("retailer-owner", "owner@retailer.test");
const stranger = user("stranger-owner", "owner@stranger.test");
const admin = user("ics-admin", "admin@ics.test");
const lead = "17.125";
const leadHash = "leadhash17leadhash17leadhash17leadhash17leadhash17lead";
const leadSignature = "leadsig17";

let mf: Miniflare;
let privateKey: CryptoKey;
let controlledId = "";
let publicId = "";

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function org(id: string, type: string, code: string, status = "pending") {
  return { id, name: id, slug: id, organizationType: type, ownerUserId: id, ownerEmail: `${id}@example.test`, issuerCode: code, issuerStatus: status };
}

describe("client identity headers", () => {
  it("drops spoofed identity headers and unsigned platform headers", () => {
    const headers = new Headers({
      "x-user-id": "admin",
      "x-forwarded-email": "admin@ics.test",
      "cf-access-authenticated-user-email": "admin@ics.test",
      "oai-authenticated-user-id": "spoofed",
      "oai-authenticated-user-email": "admin@ics.test",
      cookie: "tecrid.session_token=keep",
    });
    removeClientIdentityHeaders(headers, undefined);
    expect(headers.get("x-user-id")).toBeNull();
    expect(headers.get("x-forwarded-email")).toBeNull();
    expect(headers.get("cf-access-authenticated-user-email")).toBeNull();
    expect(headers.get("oai-authenticated-user-email")).toBeNull();
    expect(headers.get("cookie")).toContain("tecrid.session_token");
  });

  it("keeps platform identity only when the platform secret matches", () => {
    const headers = new Headers({
      "x-user-id": "spoofed",
      "x-tecrid-platform-identity": "platform-secret-value",
      "oai-authenticated-user-id": "platform-user",
      "oai-authenticated-user-email": "person@company.test",
    });
    removeClientIdentityHeaders(headers, "platform-secret-value");
    expect(headers.get("x-user-id")).toBeNull();
    expect(headers.get("x-tecrid-platform-identity")).toBeNull();
    expect(headers.get("oai-authenticated-user-id")).toBe("platform-user");
    const wrong = new Headers({ "x-tecrid-platform-identity": "wrong-secret-value", "oai-authenticated-user-id": "spoofed" });
    removeClientIdentityHeaders(wrong, "platform-secret-value");
    expect(wrong.get("oai-authenticated-user-id")).toBeNull();
  });
});

describe("security hardening", () => {
  beforeAll(async () => {
    mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('test')}}", compatibilityDate: "2026-05-22", d1Databases: ["DB"], r2Buckets: ["DOCUMENTS"] });
    env.DB = await mf.getD1Database("DB");
    env.DOCUMENTS = await mf.getR2Bucket("DOCUMENTS");
    env.ICS_ADMIN_EMAILS = admin.email;
    env.TECRID_EMAIL_RELAY_URL = "https://relay.test/email";
    env.TECRID_EMAIL_RELAY_SECRET = "relay-secret";
    for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
      for (const sql of readFileSync(`drizzle/${file}`, "utf8").split("--> statement-breakpoint")) {
        if (sql.trim()) await env.DB.prepare(sql).run();
      }
    }
    const db = getDb();
    await db.insert(organizations).values([
      org("brand", "brand", "BRAND1"),
      org("lab", "laboratory", "LABTEST"),
      org("retailer", "retailer", "RETAIL1"),
      org("stranger", "supplier", "STRAN1"),
    ]);
    await db.insert(organizationMembers).values([
      { organizationId: "brand", userId: brandOwner.userId, email: brandOwner.email, role: "owner" },
      { organizationId: "brand", userId: brandMember.userId, email: brandMember.email, role: "member" },
      { organizationId: "lab", userId: labOwner.userId, email: labOwner.email, role: "owner" },
      { organizationId: "lab", userId: labMember.userId, email: labMember.email, role: "member" },
      { organizationId: "retailer", userId: retailer.userId, email: retailer.email, role: "owner" },
      { organizationId: "stranger", userId: stranger.userId, email: stranger.email, role: "owner" },
    ]);
    const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
    privateKey = pair.privateKey;
    const publicKeyJwk = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.publicKey));
    await db.update(organizations).set({
      issuerStatus: "verified",
      issuerKeyId: "fixture-key",
      issuerKeyAlgorithm: "Ed25519",
      issuerPublicKeyJwk: publicKeyJwk,
      issuerKeyVerifiedAt: "2026-01-01T00:00:00.000Z",
    }).where(eq(organizations.id, "lab"));
    const [lab] = await db.select().from(organizations).where(eq(organizations.id, "lab"));
    const sign = async (text: string) => ({ keyId: "fixture-key", algorithm: "Ed25519" as const, signature: Buffer.from(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(text))).toString("base64url") });
    const controlledInput = { tecrid: generateTecridIdentifier(lab.issuerCode), sampleName: "Synthetic oil", productSku: "SKU-1", lotNumber: "LOT-1", testedAt: "2025-01-02", releasedAt: "2025-01-03", publish: true, visibility: "controlled" as const, sourceDocument: { sha256: "b".repeat(64), filename: "report.pdf", reportNumber: "R-1" }, results: [{ analyte: "Lead", resultText: lead, numericValue: 17.125, unit: "ppb", loqText: "0.41 ppb" }, { analyte: "Cadmium", resultText: "1.5", numericValue: 1.5, unit: "ppb", loqText: "0.2 ppb" }] };
    controlledId = (await createCredential(lab, labOwner.userId, { ...controlledInput, proof: await sign(canonicalizeCredential(controlledInput).canonicalPayload) }, { controlledRoutingAuthorized: true })).identifier;
    const publicInput = { ...controlledInput, tecrid: generateTecridIdentifier(lab.issuerCode), visibility: "public" as const, sourceDocument: { ...controlledInput.sourceDocument, sha256: "c".repeat(64) }, results: [{ analyte: "Lead", resultText: "9", numericValue: 9, unit: "ppb" }] };
    publicId = (await createCredential(lab, labOwner.userId, { ...publicInput, proof: await sign(canonicalizeCredential(publicInput).canonicalPayload) })).identifier;
  });
  afterAll(async () => { await mf.dispose(); });

  it("lets only an owner or admin grant full access, create share codes, or create laboratory API keys", async () => {
    await expect(createEvidenceShareCode(brandMember, { recipientOrganizationCode: "RETAIL1", label: "Member package", purpose: "Audit", scopeMode: "sku_set", scopeValues: "SKU-1", accessLevel: "status_only" })).rejects.toThrow(/owner or admin/);
    await expect(createApiKey(labMember, "member key", ["read"])).rejects.toThrow(/owner or admin/);
    expect((await createApiKey(labOwner, "owner key", ["read"])).plainTextKey).toMatch(/^tec_live_/);
    const broad = await createEvidenceRequest(retailer, { controllerOrganizationCode: "BRAND1", programName: "Review", purpose: "Check", productName: "Oil", productSku: "SKU-1", accessLevel: "full_record", deliveryMode: "one_time" });
    await expect(respondToEvidenceRequest(brandMember, broad.id, { decision: "accept", accessLevel: "full_record" })).rejects.toThrow(/full record/);
    const narrow = await createEvidenceRequest(retailer, { controllerOrganizationCode: "BRAND1", programName: "Narrow", purpose: "Check", productName: "Oil", productSku: "SKU-2", accessLevel: "full_record", deliveryMode: "one_time" });
    mail.items.length = 0;
    await expect(respondToEvidenceRequest(brandMember, narrow.id, { decision: "accept", accessLevel: "selected_analytes", analytes: ["Cadmium"] })).resolves.toMatchObject({ status: "accepted" });
    expect(mail.items.map((item) => item.body.noticeType)).toEqual(["evidence_access.granted"]);
    mail.items.length = 0;
    const accepted = await respondToEvidenceRequest(brandOwner, broad.id, { decision: "accept", accessLevel: "full_record" });
    expect(mail.items.some((item) => item.body.noticeType === "evidence_access.granted" && item.body.email === retailer.email)).toBe(true);
    mail.items.length = 0;
    await revokeEvidenceGrant(brandOwner, accepted.grantId);
    const revoked = await env.DB.prepare("SELECT event_type FROM organization_notifications WHERE event_type='evidence_access.revoked'").all();
    expect(revoked.results.length).toBeGreaterThan(0);
    expect(mail.items.some((item) => item.body.noticeType === "evidence_access.revoked")).toBe(false);
  });

  it("enforces share-code expiry on later access and stops a revoked code immediately", async () => {
    const db = getDb();
    await db.insert(routingAuthorizations).values({ id: "route-1", controllerOrganizationId: "brand", laboratoryOrganizationId: "lab", productName: "Oil", productSku: "SKU-1", tokenHash: "hash-1", tokenPrefix: "tec_route_test", tokenLastFour: "test", createdByUserId: brandOwner.userId, createdAt: "2026-01-01T00:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z" });
    await db.insert(controllerEvidenceReceipts).values({ id: "receipt-1", routingAuthorizationId: "route-1", controllerOrganizationId: "brand", laboratoryOrganizationId: "lab", credentialIdentifier: controlledId, credentialVersion: 1, snapshotJson: JSON.stringify({ tecrid: controlledId, subject: { productSku: "SKU-1", sampleName: "Synthetic oil" }, results: [{ analyte: "Lead", resultText: lead, numericValue: 17.125, unit: "ppb", loqText: "0.41 ppb" }, { analyte: "Cadmium", resultText: "1.5", numericValue: 1.5, unit: "ppb" }], integrity: { fingerprint: leadHash, issuerProof: { signature: leadSignature, signedPayloadHash: leadHash, signedPayload: `lead ${lead}` } } }), snapshotFingerprint: leadHash, deliveredAt: "2026-01-02T00:00:00.000Z" });
    const created = await createEvidenceShareCode(brandOwner, { recipientOrganizationCode: "RETAIL1", label: "Cadmium only", purpose: "Retail review", scopeMode: "sku_set", scopeValues: "SKU-1", accessLevel: "selected_analytes", analytes: ["Cadmium"], expiresInDays: 30 });
    mail.items.length = 0;
    await expect(redeemEvidenceShareCode({ code: created.plainTextCode, recipientOrganizationCode: "RETAIL1" })).rejects.toThrow(/receiving organization/);
    const first = await redeemEvidenceShareCode({ code: created.plainTextCode, recipientOrganizationCode: "RETAIL1" }, retailer);
    const serialized = JSON.stringify(first);
    expect(serialized).toContain("Cadmium");
    expect(serialized).toContain("1.5");
    expect(serialized).not.toContain(lead);
    expect(serialized).not.toContain("0.41");
    expect(serialized).not.toContain(leadHash);
    expect(serialized).not.toContain(leadSignature);
    const used = await env.DB.prepare("SELECT event_type FROM organization_notifications WHERE event_type IN ('evidence_share.redeemed','evidence_share.received')").all();
    expect(used.results.map((row: { event_type: string }) => row.event_type).sort()).toEqual(["evidence_share.received", "evidence_share.redeemed"]);
    expect(mail.items).toEqual([]);
    await expect(redeemEvidenceShareCode({ code: created.plainTextCode, recipientOrganizationCode: "RETAIL1" }, retailer)).resolves.toMatchObject({ receipt: { replayed: true } });
    const expiredToken = "tec_share_expiredtoken";
    await db.insert(evidenceShareCodes).values({ id: "share-expired", controllerOrganizationId: "brand", recipientOrganizationId: "retailer", label: "Expired", purpose: "Expiry check", scopeMode: "sku_set", scopeJson: JSON.stringify(["SKU-1"]), accessLevel: "selected_analytes", analyteScopeJson: JSON.stringify(["Cadmium"]), tokenHash: await sha256(expiredToken), tokenPrefix: expiredToken.slice(0, 16), tokenLastFour: "oken", status: "redeemed", createdByUserId: brandOwner.userId, createdAt: "2019-01-01T00:00:00.000Z", expiresAt: "2020-01-01T00:00:00.000Z", redeemedAt: "2019-06-01T00:00:00.000Z" });
    await db.insert(evidenceShareRedemptions).values({ id: "redemption-expired", shareCodeId: "share-expired", controllerOrganizationId: "brand", recipientOrganizationId: "retailer", packageJson: JSON.stringify({ evidence: [{ resultText: lead, integrity: { fingerprint: leadHash } }] }), packageFingerprint: "expired", recordCount: 1, redeemedAt: "2019-06-01T00:00:00.000Z" });
    await expect(redeemEvidenceShareCode({ code: expiredToken, recipientOrganizationCode: "RETAIL1" })).rejects.toThrow(/expired/);
    await revokeEvidenceShareCode(brandOwner, created.id);
    await expect(redeemEvidenceShareCode({ code: created.plainTextCode, recipientOrganizationCode: "RETAIL1" })).rejects.toThrow(/revoked/);
  });

  it("does not let public or partial responses reveal a withheld lead value", async () => {
    const record = await getCredential(controlledId);
    const document = publicCredentialDocument(record!);
    const published = JSON.stringify(document);
    const signedPayload = record!.credential.signedPayload ?? "";
    expect(document.results).toEqual([]);
    expect(published).not.toContain(lead);
    expect(published).not.toContain("0.41");
    expect(published).not.toContain(record!.credential.fingerprint ?? "missing-fingerprint");
    expect(published).not.toContain(record!.credential.signedPayloadHash ?? "missing-hash");
    expect(published).not.toContain(record!.credential.issuerSignature ?? "missing-signature");
    expect(published).not.toContain(await sha256(signedPayload));
    for (const candidate of [1, 9, 17.125, 42]) {
      const guessed = signedPayload.replace(lead, String(candidate));
      expect(published).not.toContain(await sha256(guessed));
    }
    const history = await versions(new Request("https://tecrid.test"), { params: Promise.resolve({ identifier: controlledId }) });
    const historyBody = await history.text();
    expect(historyBody).not.toContain(lead);
    expect(historyBody).not.toContain(record!.credential.fingerprint ?? "");
    const publicRecord = await getCredential(publicId);
    expect(publicCredentialDocument(publicRecord!).integrity.fingerprint).toBe(publicRecord!.credential.fingerprint);
    const db = getDb();
    await db.insert(evidenceRequests).values({ id: "request-insight", requesterOrganizationId: "retailer", controllerOrganizationId: "brand", programName: "Insight", purpose: "Check", productName: "Oil", productSku: "SKU-9", accessLevel: "selected_analytes", analyteScopeJson: JSON.stringify(["Cadmium"]), deliveryMode: "one_time", requestedByUserId: retailer.userId, requestedAt: "2026-01-01T00:00:00.000Z" });
    await db.insert(evidenceAccessGrants).values({ id: "grant-insight", requestId: "request-insight", controllerOrganizationId: "brand", recipientOrganizationId: "retailer", productName: "Oil", productSku: "SKU-9", accessLevel: "selected_analytes", analyteScopeJson: JSON.stringify(["Cadmium"]), deliveryMode: "one_time", createdByUserId: brandOwner.userId, createdAt: "2026-01-01T00:00:00.000Z" });
    await db.insert(evidenceDeliveries).values({ id: "delivery-insight", grantId: "grant-insight", routingAuthorizationId: "route-1", controllerOrganizationId: "brand", recipientOrganizationId: "retailer", credentialIdentifier: controlledId, credentialVersion: 1, accessLevel: "selected_analytes", snapshotJson: JSON.stringify({ subject: { sampleName: "Synthetic oil", productSku: "SKU-9" }, results: [{ analyte: "Lead", resultText: lead, numericValue: 17.125, unit: "ppb", loqText: "0.41 ppb" }, { analyte: "Cadmium", resultText: "1.5", numericValue: 1.5, unit: "ppb" }], resultsAccess: { state: "granted", accessLevel: "selected_analytes", deliveredAnalytes: ["Cadmium"] }, integrity: { fingerprint: leadHash, issuerProof: { signature: leadSignature, signedPayloadHash: leadHash, signedPayload: lead } } }), snapshotFingerprint: leadHash, deliveredAt: "2026-01-03T00:00:00.000Z" });
    const insights = await getEvidenceInsightsForOrganization("retailer");
    const insightText = JSON.stringify(insights);
    expect(insightText).not.toContain(lead);
    expect(insightText).not.toContain("Lead");
    expect(insights.analytes.map((item) => item.latestResult)).toEqual(["1.5"]);
    const listed = await listEvidenceDeliveriesForOrganization("retailer");
    const listedText = JSON.stringify(listed);
    expect(listedText).not.toContain(lead);
    expect(listedText).not.toContain(leadHash);
    expect(listedText).not.toContain(leadSignature);
    await db.update(evidenceAccessGrants).set({ status: "revoked" }).where(eq(evidenceAccessGrants.id, "grant-insight"));
    expect(JSON.stringify(await getEvidenceInsightsForOrganization("retailer"))).not.toContain("Cadmium");
    expect(JSON.stringify(await listEvidenceDeliveriesForOrganization("brand"))).toContain(controlledId);
    const hidden = await createVerificationCheck({ documentSha256: "b".repeat(64) }, stranger.userId);
    const missing = await createVerificationCheck({ documentSha256: "d".repeat(64) }, stranger.userId);
    expect(hidden.outcome).toBe("not_found");
    expect(hidden.credentialIdentifier).toBeNull();
    expect(hidden.record).toBeNull();
    expect(missing.outcome).toBe("not_found");
    expect(JSON.stringify(hidden)).not.toContain(controlledId);
    const visible = await createVerificationCheck({ documentSha256: "c".repeat(64) }, null);
    expect(visible.credentialIdentifier).toBe(publicId);
    const sameOrg = new FormData();
    sameOrg.set("document", new File(["%PDF-1.7 same bytes"], "original.pdf"));
    for (const [key, value] of Object.entries({ laboratoryName: "Fixture", confirmationEmail: brandOwner.email, sampleName: "Synthetic", results: JSON.stringify([{ analyte: "Lead", resultText: "ND", unit: "ppb" }]), attested: "on" })) sameOrg.set(key, value);
    const firstIntake = await createLegacyReport(brandOwner, sameOrg);
    const otherOrg = new FormData();
    otherOrg.set("document", new File(["%PDF-1.7 same bytes"], "original.pdf"));
    for (const [key, value] of Object.entries({ laboratoryName: "Fixture", confirmationEmail: stranger.email, sampleName: "Synthetic", results: JSON.stringify([{ analyte: "Lead", resultText: "ND", unit: "ppb" }]), attested: "on" })) otherOrg.set(key, value);
    const secondIntake = await createLegacyReport(stranger, otherOrg);
    expect(secondIntake.id).not.toBe(firstIntake.id);
    const repeat = new FormData();
    repeat.set("document", new File(["%PDF-1.7 same bytes"], "original.pdf"));
    for (const [key, value] of Object.entries({ laboratoryName: "Fixture", confirmationEmail: brandOwner.email, sampleName: "Synthetic", results: JSON.stringify([{ analyte: "Lead", resultText: "ND", unit: "ppb" }]), attested: "on" })) repeat.set(key, value);
    await expect(createLegacyReport(brandOwner, repeat)).rejects.toThrow(firstIntake.id);
    const strangerRepeat = new FormData();
    strangerRepeat.set("document", new File(["%PDF-1.7 same bytes"], "original.pdf"));
    for (const [key, value] of Object.entries({ laboratoryName: "Fixture", confirmationEmail: stranger.email, sampleName: "Synthetic", results: JSON.stringify([{ analyte: "Lead", resultText: "ND", unit: "ppb" }]), attested: "on" })) strangerRepeat.set(key, value);
    await expect(createLegacyReport(stranger, strangerRepeat)).rejects.toThrow(secondIntake.id);
  });

  it("lists only organizations the caller is entitled to see", async () => {
    expect(await getIssuer("BRAND1")).toBeNull();
    expect(await getIssuer("STRAN1")).toBeNull();
    expect((await getIssuer("LABTEST"))?.name).toBe("lab");
    const sharing = await listSharingForUser(brandOwner);
    expect(Object.keys(sharing.organizationMap).sort()).toEqual(["brand", "retailer"]);
    expect(JSON.stringify(sharing.organizationMap)).not.toContain("STRAN1");
    const routing = await listEvidenceRoutingForUser(retailer);
    expect(routing.organizationMap.stranger).toBeUndefined();
    expect(routing.organizationMap.retailer.code).toBe("RETAIL1");
  });

  it("requires a TOTP or recovery code before admin tools", async () => {
    const enrollment = await beginAdminEnrollment(admin);
    const confirmed = await confirmAdminEnrollment(admin, await totpCode(enrollment.secret));
    expect(confirmed.recoveryCodes).toHaveLength(8);
    expect(await adminFactorSatisfied(admin, null)).toBe(false);
    expect(await adminFactorSatisfied(admin, `tecrid_admin_mfa=${confirmed.token}`)).toBe(true);
    const recovered = await verifyAdminSecondFactor(admin, confirmed.recoveryCodes[0]);
    expect(await adminFactorSatisfied(admin, `tecrid_admin_mfa=${recovered.token}`)).toBe(true);
    await expect(verifyAdminSecondFactor(admin, confirmed.recoveryCodes[0])).rejects.toThrow(/not valid/);
    current.user = admin;
    const denied = await adminReview(new Request("https://tecrid.test/api/admin/issuer-applications/missing", { method: "POST", headers: { origin: "https://tecrid.test", "content-type": "application/json" }, body: JSON.stringify({ decision: "reject", reviewNote: "Synthetic" }) }), { params: Promise.resolve({ applicationId: "missing" }) });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ error: expect.stringMatching(/second factor/) });
    const allowed = await adminReview(new Request("https://tecrid.test/api/admin/issuer-applications/missing", { method: "POST", headers: { origin: "https://tecrid.test", "content-type": "application/json", cookie: `tecrid_admin_mfa=${confirmed.token}` }, body: JSON.stringify({ decision: "reject", reviewNote: "Synthetic" }) }), { params: Promise.resolve({ applicationId: "missing" }) });
    expect(allowed.status).toBe(400);
    expect(await allowed.json()).toMatchObject({ error: "Issuer application not found." });
  });

  it("notifies every share recipient in the app and by email when a record is corrected or revoked", async () => {
    const db = getDb();
    await db.insert(evidenceShareCodes).values({ id: "share-public", controllerOrganizationId: "brand", recipientOrganizationId: "retailer", label: "Public share", purpose: "Notice", scopeMode: "tecrid_set", scopeJson: JSON.stringify([publicId]), accessLevel: "full_record", tokenHash: "share-hash", tokenPrefix: "tec_share_public", tokenLastFour: "pub1", createdByUserId: brandOwner.userId, createdAt: "2026-01-01T00:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z" });
    await db.insert(evidenceShareRedemptions).values({ id: "redemption-public", shareCodeId: "share-public", controllerOrganizationId: "brand", recipientOrganizationId: "retailer", packageJson: JSON.stringify({ evidence: [{ tecrid: publicId }] }), packageFingerprint: "pkg", recordCount: 1, redeemedAt: "2026-01-02T00:00:00.000Z" });
    await db.insert(controllerEvidenceReceipts).values({ id: "receipt-public", routingAuthorizationId: "route-1", controllerOrganizationId: "brand", laboratoryOrganizationId: "lab", credentialIdentifier: publicId, credentialVersion: 1, snapshotJson: "{}", snapshotFingerprint: "pub", deliveredAt: "2026-01-02T00:00:00.000Z" });
    const [lab] = await db.select().from(organizations).where(eq(organizations.id, "lab"));
    const correct = { action: "correct" as const, reason: "Synthetic correction", sampleName: "Synthetic oil", productSku: "SKU-1", lotNumber: "LOT-1", results: [{ analyte: "Lead", resultText: "9", numericValue: 9, unit: "ppb" }] };
    const canonical = await canonicalizeCredentialRevision(lab, publicId, correct);
    const signature = Buffer.from(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(canonical.canonicalPayload))).toString("base64url");
    mail.items.length = 0;
    await createCredentialRevision(lab, labOwner.userId, publicId, { ...correct, proof: { keyId: "fixture-key", algorithm: "Ed25519", signature } });
    const notices = await db.select().from(organizationNotifications).where(eq(organizationNotifications.eventType, "credential.corrected"));
    expect(notices.map((notice) => notice.organizationId).sort()).toEqual(["brand", "retailer"]);
    const emailed = mail.items.filter((item) => item.body.noticeType === "credential.corrected");
    expect(emailed.map((item) => item.body.email).sort()).toEqual([brandMember.email, brandOwner.email, retailer.email].sort());
    expect(emailed.every((item) => item.body.kind === "tecrid-notice" && !item.body.text?.includes(lead))).toBe(true);
    expect(mail.items.some((item) => item.body.email === labOwner.email)).toBe(false);
    const revoke = { action: "revoke" as const, reason: "Synthetic revocation" };
    const revokeCanonical = await canonicalizeCredentialRevision(lab, publicId, revoke);
    const revokeSignature = Buffer.from(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(revokeCanonical.canonicalPayload))).toString("base64url");
    mail.items.length = 0;
    await createCredentialRevision(lab, labOwner.userId, publicId, { ...revoke, proof: { keyId: "fixture-key", algorithm: "Ed25519", signature: revokeSignature } });
    const revocationMail = mail.items.filter((item) => item.body.noticeType === "credential.revoked");
    expect(revocationMail.length).toBe(3);
    const revocationNotices = await db.select().from(organizationNotifications).where(eq(organizationNotifications.eventType, "credential.revoked"));
    expect(revocationNotices.map((notice) => notice.organizationId).sort()).toEqual(["brand", "retailer"]);
  });

  it("re-signs legacy payloads onto the TECRiD, PDF hash, and lot, and a dry run only reports counts", async () => {
    const db = getDb();
    const tecrid = generateTecridIdentifier("LABTEST");
    const legacy = JSON.stringify({ type: "TestEvidenceCredential", sampleName: "Old oil", results: [] });
    const legacySignature = Buffer.from(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(legacy))).toString("base64url");
    const canonical = "legacy-canonical";
    const fingerprint = await sha256(canonical);
    const [lab] = await db.select().from(organizations).where(eq(organizations.id, "lab"));
    await db.insert(credentials).values({ identifier: tecrid, organizationId: "lab", status: "issued", sampleName: "Old oil", lotNumber: "OLD-LOT", version: 1, fingerprint, issuerSignature: legacySignature, issuerKeyId: "fixture-key", issuerPublicKeyJwk: lab.issuerPublicKeyJwk, issuerKeyVerifiedAt: lab.issuerKeyVerifiedAt, signatureAlgorithm: "Ed25519", signedPayload: legacy, signedPayloadHash: await sha256(legacy), sourceDocumentHash: "e".repeat(64), sourceDocumentName: "old.pdf", publicRecord: true, visibility: "public", createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z" });
    await db.insert(credentialVersions).values({ credentialIdentifier: tecrid, version: 1, status: "issued", canonicalPayload: canonical, fingerprint, issuerSignature: legacySignature, issuerKeyId: "fixture-key", issuerPublicKeyJwk: lab.issuerPublicKeyJwk, issuerKeyVerifiedAt: lab.issuerKeyVerifiedAt, signatureAlgorithm: "Ed25519", signedPayload: legacy, signedPayloadHash: await sha256(legacy), changeType: "issuance", changeReason: "Original issuance", createdAt: "2024-01-01T00:00:00.000Z" });
    expect((await getCredential(tecrid))!.integrity.issuerSignatureVerified).toBe(false);
    const sign = async (keyId: string, payload: string) => {
      expect(keyId).toBe("fixture-key");
      return Buffer.from(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(payload))).toString("base64url");
    };
    const dry = await resignBoundPayloads({ dryRun: true, sign });
    expect(dry.dryRun).toBe(true);
    expect(dry.needsResign).toBe(1);
    expect(dry.resigned).toBe(0);
    expect(dry.alreadyBound).toBe(2);
    expect((await getCredential(tecrid))!.credential.version).toBe(1);
    const applied = await resignBoundPayloads({ dryRun: false, sign });
    expect(applied.resigned).toBe(1);
    expect(applied.failed).toBe(0);
    const after = (await getCredential(tecrid))!;
    expect(after.credential.status).toBe("issued");
    expect(after.credential.lotNumber).toBe("OLD-LOT");
    expect(after.credential.version).toBe(2);
    expect(after.integrity.issuerSignatureVerified).toBe(true);
    const signed = JSON.parse(after.credential.signedPayload!);
    expect(signed.tecrid).toBe(tecrid);
    expect(signed.sourceDocumentSha256).toBe("e".repeat(64));
    expect(signed.lotNumber).toBe("OLD-LOT");
    const repeat = await resignBoundPayloads({ dryRun: false, sign });
    expect(repeat.resigned).toBe(0);
    expect(repeat.needsResign).toBe(0);
    expect(repeat.alreadyBound).toBe(3);
    expect((await getCredential(tecrid))!.credential.version).toBe(2);
  });
});
