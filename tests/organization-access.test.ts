// @vitest-environment node
import { syntheticSourceDocument } from "./support/source-document";
import { afterAll, beforeAll, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { env } from "./support/cloudflare-env";
import { getDb } from "../db";
import { organizations, organizationMembers, evidenceDeliveries, evidenceAccessGrants, notificationDeliveries, organizationNotifications } from "../db/schema";
import { acceptOrganizationTerms, computeOrganizationGate, configureDeliveryPolicy, getDeliveryPolicy, organizationGate, reviewOrganizationIdentity } from "../lib/organization-access";
import { createEvidenceRequest, respondToEvidenceRequest, createRoutingAuthorization, processStandingRoutingJobs } from "../lib/evidence-routing";
import { canonicalizeCredential, createCredential } from "../lib/tec";
import { processNotificationOutbox, saveNotificationChannel } from "../lib/notification-delivery";
const actor = (id: string) => ({ userId: id, email: `${id}@example.test`, displayName: id, fullName: id });
const brand = actor("gate-brand"), recipient = actor("gate-recipient"), admin = actor("gate-admin");
let mf: Miniflare, lab: typeof organizations.$inferSelect, privateKey: CryptoKey, grantId: string, authorizationId: string, firstId: string;
const input = { sampleName: "Synthetic gated fixture", productSku: "GATED-SKU", lotNumber: "TEST-LOT", publish: true, visibility: "controlled", results: [{ analyte: "Lead", resultText: "PRIVATE-9.99", unit: "ppb" }] };
async function issue(productSku = input.productSku) { const subject = { ...input, sourceDocument: syntheticSourceDocument(), productSku }; const canonical = canonicalizeCredential(subject).canonicalPayload; const proof = { keyId: "gate-key", algorithm: "Ed25519", signature: Buffer.from(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(canonical))).toString("base64url") }; const result = await createCredential(lab, null, { ...subject, proof }); await processStandingRoutingJobs(); return result.identifier; }
beforeAll(async () => {
 mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('test')}}", compatibilityDate: "2026-05-22", d1Databases: ["DB"] }); env.DB = await mf.getD1Database("DB"); env.ICS_ADMIN_EMAILS = admin.email; env.TECRID_DELIVERY_ENABLED = "true"; env.TECRID_CHANNEL_SECRET = Buffer.alloc(32, 1).toString("base64url"); env.TECRID_WEBHOOK_HOSTS = "recipient.example.org";
 for (const f of readdirSync("drizzle").filter(x => x.endsWith(".sql")).sort()) for (const s of readFileSync(`drizzle/${f}`, "utf8").split("--> statement-breakpoint").filter(x => x.trim())) await env.DB.prepare(s).run();
 const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]); privateKey = pair.privateKey;
 for (const [id, type, code, verified] of [[brand.userId,"brand","GATEBRAND",true],[recipient.userId,"certification_body","GATERECIPIENT",false],["gate-lab","laboratory","GATELAB",true]] as const) {
  await getDb().insert(organizations).values({ id, name: id, slug: id, organizationType: type, ownerUserId: id, ownerEmail: `${id}@example.test`, issuerCode: code, issuerStatus: verified ? "verified" : "pending", ...(type === "laboratory" ? { issuerKeyId: "gate-key", issuerKeyAlgorithm: "Ed25519", issuerKeyVerifiedAt: new Date().toISOString(), issuerPublicKeyJwk: JSON.stringify(await crypto.subtle.exportKey("jwk", pair.publicKey)) } : {}) });
  await getDb().insert(organizationMembers).values({ organizationId: id, userId: id, email: `${id}@example.test`, role: "owner" });
 }
 [lab] = await getDb().select().from(organizations).where(eq(organizations.id,"gate-lab"));
 const requested = await createEvidenceRequest(recipient, { controllerOrganizationCode: "GATEBRAND", programName: "Synthetic", purpose: "Gate test", productName: input.sampleName, productSku: input.productSku, accessLevel: "full_record", deliveryMode: "future_sku" });
 grantId = (await respondToEvidenceRequest(brand, requested.id, { decision: "accept" })).grantId!;
 authorizationId = (await createRoutingAuthorization(brand, { authorizationKind: "standing", laboratoryOrganizationCode: "GATELAB", productName: input.sampleName, productSku: input.productSku, grantIds: [grantId] })).id;
 await saveNotificationChannel(recipient, { kind: "webhook", url: "https://recipient.example.org/events", label: "Isolated receiver" });
}, 60000);
afterAll(async () => { await mf?.dispose(); });
it("defaults to no terms document and no terms requirement", async () => {
 expect(await getDeliveryPolicy()).toMatchObject({ termsRequired: false, termsVersion: "", termsUrl: "" });
 expect(computeOrganizationGate({ identityVerified: true, activeGrant: true, termsAcceptedAt: null, acceptedVersion: null }, { termsRequired: false, termsVersion: "", termsUrl: "" }).status).toBe("UNGATED");
 expect((await organizationGate(recipient.userId, brand.userId)).status).toBe("GATED");
});
it("gives a GATED recipient no snapshot or external delivery, including at the database guard", async () => {
 firstId = await issue(); expect((await getDb().select().from(evidenceDeliveries)).filter(d => d.credentialIdentifier === firstId)).toHaveLength(0);
 await expect(getDb().insert(evidenceDeliveries).values({ id: "forbidden", grantId, routingAuthorizationId: authorizationId, controllerOrganizationId: brand.userId, recipientOrganizationId: recipient.userId, credentialIdentifier: firstId, credentialVersion: 1, accessLevel: "full_record", snapshotJson: "{}", snapshotFingerprint: "0".repeat(64) })).rejects.toThrow();
 await getDb().insert(organizationNotifications).values({ id: "gated-alert", organizationId: recipient.userId, eventType: "fixture.event", entityId: firstId, entityType: "credential", title: "PRIVATE", body: "PRIVATE", actionPath: "/dashboard" });
 const calls: string[] = []; await processNotificationOutbox({ transport: async url => { calls.push(String(url)); return new Response(null, { status: 200 }); } });
 expect(calls).toEqual([]);
 const [job] = await getDb().select().from(notificationDeliveries).where(eq(notificationDeliveries.eventId,"notification:gated-alert")); expect(job.status).toBe("blocked"); expect(job.attempts).toBe(0);
});
it("becomes UNGATED after operator identity verification with an active grant, scoped to its controller", async () => {
 await expect(reviewOrganizationIdentity(recipient, { organizationCode: "GATERECIPIENT", verified: true, note: "Self verification forbidden" })).rejects.toThrow();
 await reviewOrganizationIdentity(admin, { organizationCode: "GATERECIPIENT", verified: true, note: "Synthetic operator identity review" });
 expect((await organizationGate(recipient.userId, brand.userId)).status).toBe("UNGATED");
 expect((await organizationGate(recipient.userId, "different-brand")).status).toBe("GATED");
 const id = await issue(); expect((await getDb().select().from(evidenceDeliveries)).some(d => d.credentialIdentifier === id)).toBe(true);
});
it("enables configured terms without a code change and requires the current version", async () => {
 await expect(configureDeliveryPolicy(recipient, { termsRequired: true, termsVersion: "v1", termsUrl: "https://example.org/terms" })).rejects.toThrow();
 await expect(configureDeliveryPolicy(admin, { termsRequired: true, termsVersion: "", termsUrl: "" })).rejects.toThrow();
 await configureDeliveryPolicy(admin, { termsRequired: true, termsVersion: "v1", termsUrl: "https://example.org/terms" });
 expect((await organizationGate(recipient.userId, brand.userId)).status).toBe("GATED");
 const blocked = await issue(); expect((await getDb().select().from(evidenceDeliveries)).some(d => d.credentialIdentifier === blocked)).toBe(false);
 await expect(acceptOrganizationTerms(recipient, { accepted: true, termsVersion: "old" })).rejects.toThrow();
 await expect(acceptOrganizationTerms(recipient, { accepted: false, termsVersion: "v1" })).rejects.toThrow();
 const acceptance = await acceptOrganizationTerms(recipient, { accepted: true, termsVersion: "v1" }); expect(acceptance.termsAcceptedAt).toBeTruthy();
 expect((await organizationGate(recipient.userId, brand.userId)).status).toBe("UNGATED");
 expect(await acceptOrganizationTerms(recipient, { accepted: true, termsVersion: "v1" })).toEqual(acceptance);
 await configureDeliveryPolicy(admin, { termsRequired: true, termsVersion: "v2", termsUrl: "https://example.org/terms" });
 expect((await organizationGate(recipient.userId, brand.userId)).status).toBe("GATED");
 await configureDeliveryPolicy(admin, { termsRequired: false, termsVersion: "", termsUrl: "" });
 expect((await organizationGate(recipient.userId, brand.userId)).status).toBe("UNGATED");
 await reviewOrganizationIdentity(admin, { organizationCode: "GATERECIPIENT", verified: false, note: "Synthetic identity revocation" });
 expect((await organizationGate(recipient.userId, brand.userId)).status).toBe("GATED");
});

it("consumes a one-time grant once while preserving authority for its first alert", async () => {
 await reviewOrganizationIdentity(admin, { organizationCode: "GATERECIPIENT", verified: true, note: "Synthetic identity reviewed again" });
 const requested = await createEvidenceRequest(recipient, { controllerOrganizationCode: "GATEBRAND", programName: "Synthetic", purpose: "One-time gate test", productName: input.sampleName, productSku: "ONCE-SKU", accessLevel: "full_record", deliveryMode: "one_time" });
 const onceGrant = (await respondToEvidenceRequest(brand, requested.id, { decision: "accept" })).grantId!;
 await createRoutingAuthorization(brand, { authorizationKind: "standing", laboratoryOrganizationCode: "GATELAB", productName: input.sampleName, productSku: "ONCE-SKU", grantIds: [onceGrant] });
 const first = await issue("ONCE-SKU");
 const [delivery] = await getDb().select().from(evidenceDeliveries).where(eq(evidenceDeliveries.grantId, onceGrant));
 expect(delivery.credentialIdentifier).toBe(first);
 const [grant] = await getDb().select().from(evidenceAccessGrants).where(eq(evidenceAccessGrants.id, onceGrant));
 expect(grant.status).toBe("active");
 const [alert] = await getDb().select().from(organizationNotifications).where(eq(organizationNotifications.entityId, delivery.id));
 await processNotificationOutbox({ at: Date.now() + 20000, transport: async () => new Response(null, { status: 200 }) });
 const [job] = await getDb().select().from(notificationDeliveries).where(eq(notificationDeliveries.eventId, `notification:${alert.id}`));
 expect(job.status).toBe("delivered");
 const second = await issue("ONCE-SKU");
 expect(second).not.toBe(first);
 await expect(getDb().insert(evidenceDeliveries).values({ ...delivery, id: "forbidden-second-use", credentialIdentifier: second })).rejects.toThrow();
 expect(await getDb().select().from(evidenceDeliveries).where(eq(evidenceDeliveries.grantId, onceGrant))).toHaveLength(1);
});
