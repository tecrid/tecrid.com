// @vitest-environment node
import { syntheticSourceDocument } from "./support/source-document";
import { afterAll, beforeAll, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { createHash, createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { env } from "./support/cloudflare-env";
import { getDb } from "../db";
import { credentials, evidenceDeliveries, notificationOutbox, organizations, organizationMembers } from "../db/schema";
import { createEvidenceRequest, respondToEvidenceRequest, createRoutingAuthorization, processStandingRoutingJobs, revokeEvidenceGrant } from "../lib/evidence-routing";
import { canonicalizeCredential, createCredential, onboardOrganization } from "../lib/tec";
import { processNotificationOutbox, saveNotificationChannel } from "../lib/notification-delivery";
import { recipientWebhookPayload } from "../lib/recipient-webhook";
const actor = (id: string) => ({ userId: id, email: `${id}@example.test`, displayName: id, fullName: id });
const brand = actor("market-brand"), market = actor("market-owner");
let mf: Miniflare, lab: typeof organizations.$inferSelect, privateKey: CryptoKey, marketId: string;
const grants: string[] = [], events: typeof notificationOutbox.$inferSelect[] = [];
const input = { sampleName: "SYNTHETIC marketplace fixture", productSku: "MARKET-SKU", ingredientCode: "cacao-example", lotNumber: "LOT-EXAMPLE", publish: true, visibility: "controlled", results: [{ analyte: "Lead", resultText: "LEAD-PRIVATE", unit: "ppb" }, { analyte: "Cadmium", resultText: "CADMIUM-PRIVATE", unit: "ppb" }] };
beforeAll(async () => {
 mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('test')}}", compatibilityDate: "2026-05-22", d1Databases: ["DB"] }); env.DB = await mf.getD1Database("DB"); env.TECRID_DELIVERY_ENABLED = "true"; env.TECRID_CHANNEL_SECRET = Buffer.alloc(32, 2).toString("base64url"); env.TECRID_WEBHOOK_HOSTS = "vle.example.org";
 for (const f of readdirSync("drizzle").filter(x => x.endsWith(".sql")).sort()) for (const s of readFileSync(`drizzle/${f}`, "utf8").split("--> statement-breakpoint").filter(x => x.trim())) await env.DB.prepare(s).run();
 const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]); privateKey = pair.privateKey;
 for (const [id,type,code] of [[brand.userId,"brand","MARKETBRAND"],["market-lab","laboratory","MARKETLAB"]]) {
  await getDb().insert(organizations).values({ id, name: id, slug: id, organizationType: type, ownerUserId: id, ownerEmail: `${id}@example.test`, issuerCode: code, issuerStatus: "verified", ...(type === "laboratory" ? { issuerKeyId: "market-key", issuerKeyAlgorithm: "Ed25519", issuerKeyVerifiedAt: new Date().toISOString(), issuerPublicKeyJwk: JSON.stringify(await crypto.subtle.exportKey("jwk", pair.publicKey)) } : {}) });
  await getDb().insert(organizationMembers).values({ organizationId: id, userId: id, email: `${id}@example.test`, role: "owner" });
 }
 [lab] = await getDb().select().from(organizations).where(eq(organizations.id,"market-lab"));
}, 60000);
afterAll(async () => { await mf?.dispose(); });
it("onboards a marketplace with the same evidence request workflow and controller authority", async () => {
 const membership = await onboardOrganization(market, { name: "SYNTHETIC VLE receiver", organizationType: "marketplace", website: "https://vle.example.org" });
 const org = membership!.organization; marketId = org.id; expect(org.organizationType).toBe("marketplace");
 await getDb().update(organizations).set({ identityStatus: "verified" }).where(eq(organizations.id, marketId));
});
it("creates a scoped webhook for each access level with an exact snapshot fingerprint", async () => {
 for (const [index, accessLevel] of ["status_only", "selected_analytes", "full_record"].entries()) {
  const productSku = `MARKET-${index}`;
  const request = await createEvidenceRequest(market, { controllerOrganizationCode: "MARKETBRAND", programName: "SYNTHETIC VLE", purpose: "Contract verification", productName: input.sampleName, productSku, accessLevel, analytes: ["Lead"], deliveryMode: "future_sku" });
  const grant = (await respondToEvidenceRequest(brand, request.id, { decision: "accept" })).grantId!; grants.push(grant);
  await createRoutingAuthorization(brand, { authorizationKind: "standing", laboratoryOrganizationCode: "MARKETLAB", productName: input.sampleName, productSku, ingredientCode: input.ingredientCode, grantIds: [grant] });
  const subject = { ...input, sourceDocument: syntheticSourceDocument(), productSku }; const canonical = canonicalizeCredential(subject).canonicalPayload;
  const issued = await createCredential(lab, null, { ...subject, proof: { keyId: "market-key", algorithm: "Ed25519", signature: Buffer.from(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(canonical))).toString("base64url") } }); await processStandingRoutingJobs();
  const [delivery] = await getDb().select().from(evidenceDeliveries).where(eq(evidenceDeliveries.credentialIdentifier, issued.identifier));
  const event = (await getDb().select().from(notificationOutbox)).find(e => e.entityId === delivery.id)!; events.push(event);
  const payload = await recipientWebhookPayload(event);
  expect(payload).toMatchObject({ schemaVersion: "tecrid.delivery/1", delivery: { id: delivery.id, tecrid: issued.identifier, version: 1, accessLevel, link: { productSku, ingredientCode: "cacao-example", lotNumber: "LOT-EXAMPLE", verificationUrl: `https://tecrid.com/records/${encodeURIComponent(issued.identifier)}` } } });
  if (!("delivery" in payload)) throw Error("Missing scoped delivery");
  const snapshot = JSON.parse(payload.delivery.snapshotJson);
  expect(payload.delivery!.snapshotFingerprint).toBe(createHash("sha256").update(payload.delivery!.snapshotJson).digest("hex"));
  expect(snapshot.results.map((r: { analyte: string }) => r.analyte)).toEqual(index === 0 ? [] : index === 1 ? ["Lead"] : ["Lead", "Cadmium"]);
  if (index < 2) expect(JSON.stringify(payload)).not.toContain("CADMIUM-PRIVATE");
  if (index === 0) expect(JSON.stringify(payload)).not.toContain("LEAD-PRIVATE");
 }
});
it("withholds legacy marketplace webhooks without signed supplier identity and leaves lifecycle metadata unchanged", async () => {
 const channel = await saveNotificationChannel(market, { kind: "webhook", url: "https://vle.example.org/events", label: "SYNTHETIC receiver" });
 // A channel gets only events created after enrollment, so enqueue a new
 // synthetic event pointing at the already verified snapshot.
 const occurredAt = new Date(Date.now() + 1).toISOString();
 await getDb().insert(notificationOutbox).values({ ...events[1], id: "contract-scoped", expandedAt: null, occurredAt });
 const bodies: string[] = [];
 await processNotificationOutbox({ transport: async (_url, init) => {
  const body = String(init!.body); bodies.push(body); const headers = new Headers(init!.headers); const [stamp, signature] = headers.get("x-tecrid-signature")!.split(",");
  expect(signature).toBe(`v1=${createHmac("sha256", channel.webhookSecret!).update(`${stamp.slice(2)}.${body}`).digest("hex")}`); return new Response(null,{status:202});
 } });
 expect(bodies).toEqual([]);
 expect(bodies.join()).not.toContain("CADMIUM-PRIVATE");
 const lifecycle = await recipientWebhookPayload({ ...events[1], eventType: "credential.corrected" });
 expect(Object.keys(lifecycle).sort()).toEqual(["event","eventId","sku","url"]);
});
it("rejects cross-recipient access, tampered snapshots, stale records and revoked grants before sending", async () => {
 await expect(recipientWebhookPayload({ ...events[0], organizationId: brand.userId })).rejects.toThrow();
 const [delivery] = await getDb().select().from(evidenceDeliveries).where(eq(evidenceDeliveries.id, events[0].entityId));
 await expect(getDb().update(evidenceDeliveries).set({ snapshotJson: "{}" }).where(eq(evidenceDeliveries.id, delivery.id))).rejects.toThrow();
 // Simulate storage corruption only after proving the production immutability guard.
 await env.DB.prepare("DROP TRIGGER evidence_deliveries_no_update").run();
 await getDb().update(evidenceDeliveries).set({ snapshotJson: "{}" }).where(eq(evidenceDeliveries.id, delivery.id));
 await expect(recipientWebhookPayload(events[0])).rejects.toThrow(/integrity/);
 await getDb().update(credentials).set({ ingredientCode: "tampered" }).where(eq(credentials.identifier, (await getDb().select().from(evidenceDeliveries).where(eq(evidenceDeliveries.id,events[2].entityId)))[0].credentialIdentifier));
 await expect(recipientWebhookPayload(events[2])).rejects.toThrow(/verified/);
 await revokeEvidenceGrant(brand, grants[1]);
 await expect(recipientWebhookPayload(events[1])).rejects.toThrow(/authority/);
});
