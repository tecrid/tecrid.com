// @vitest-environment node
import { syntheticSourceDocument } from "./support/source-document";
import { afterAll, beforeAll, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { env } from "./support/cloudflare-env";
import { getDb } from "../db";
import { controllerEvidenceReceipts, credentials, credentialRoutingJobs, evidenceAccessGrants, evidenceDeliveries, organizations, organizationMembers, organizationNotifications } from "../db/schema";
import { createEvidenceRequest, respondToEvidenceRequest, createRoutingAuthorization, deliverCredentialWithAuthorization, authorizeRoutingAuthorizationId, processStandingRoutingJobs, revokeRoutingAuthorization, revokeEvidenceGrant } from "../lib/evidence-routing";
import { reserveReportTecrid, finalizeReportTecrid } from "../lib/report-issuance";
import { POST as issueViaApi } from "../app/api/v1/credentials/route";
import { canonicalizeCredential, createCredential, createApiKey } from "../lib/tec";
const user = (id: string) => ({ userId: id, email: `${id}@example.test`, displayName: id, fullName: id });
const brand = user("standing-brand"), recipient = user("standing-recipient"), other = user("standing-other");
let mf: Miniflare, privateKey: CryptoKey, lab: typeof organizations.$inferSelect, grantId: string, unselectedGrantId: string, authorizationId: string;
const payload = { sampleName: "EXAMPLE ingredient", productSku: "EXAMPLE-SKU", lotNumber: "EXAMPLE-LOT", publish: true, visibility: "controlled", results: [{ analyte: "Lead", resultText: "1.23", numericValue: 1.23, unit: "ppb" }, { analyte: "Cadmium", resultText: "9.87", numericValue: 9.87, unit: "ppb" }] };
async function issue(sku = payload.productSku, ingredientCode?: string) { const input = { ...payload, sourceDocument: syntheticSourceDocument(), productSku: sku, ...(ingredientCode === undefined ? {} : { ingredientCode }) }; const canonical = canonicalizeCredential(input).canonicalPayload; return createCredential(lab, null, { ...input, proof: { keyId: "standing-test", algorithm: "Ed25519", signature: Buffer.from(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(canonical))).toString("base64url") } }); }
beforeAll(async () => {
 mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('test')}}", compatibilityDate: "2026-05-22", d1Databases: ["DB"] }); env.DB = await mf.getD1Database("DB");
 for (const f of readdirSync("drizzle").filter(x => x.endsWith(".sql")).sort()) for (const s of readFileSync(`drizzle/${f}`, "utf8").split("--> statement-breakpoint").filter(x => x.trim())) await env.DB.prepare(s).run();
 const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]); privateKey = pair.privateKey;
 for (const [id, type, code] of [[brand.userId,"brand","BRAND"],[recipient.userId,"certification_body","RECIPIENT"],[other.userId,"retailer","OTHER"],["standing-lab","laboratory","LABSTANDING"]]) {
  await getDb().insert(organizations).values({ id, name: id, slug: id, organizationType: type, ownerUserId: id, ownerEmail: `${id}@example.test`, issuerCode: code, issuerStatus: "verified", ...(type === "laboratory" ? { issuerKeyId: "standing-test", issuerKeyAlgorithm: "Ed25519", issuerKeyVerifiedAt: new Date().toISOString(), issuerPublicKeyJwk: JSON.stringify(await crypto.subtle.exportKey("jwk", pair.publicKey)) } : {}) });
  await getDb().insert(organizationMembers).values({ organizationId: id, userId: id, email: `${id}@example.test`, role: "owner" });
 }
 [lab] = await getDb().select().from(organizations).where(eq(organizations.id,"standing-lab"));
 for (const actor of [recipient, other]) {
  const request = await createEvidenceRequest(actor, { controllerOrganizationCode: "BRAND", programName: "Fixture", purpose: "Synthetic test", productName: payload.sampleName, productSku: payload.productSku, accessLevel: "selected_analytes", analytes: ["Lead"], deliveryMode: "future_sku" });
  const grant = await respondToEvidenceRequest(brand, request.id, { decision: "accept" });
  if (actor === recipient) grantId = grant.grantId!; else unselectedGrantId = grant.grantId!;
 }
}, 60000);
afterAll(async () => { await mf?.dispose(); });
it("requires explicit controller-owned active grants and creates a revocable tokenless authority", async () => {
 const input = { authorizationKind: "standing", laboratoryOrganizationCode: "LABSTANDING", productName: payload.sampleName, productSku: payload.productSku };
 await expect(createRoutingAuthorization(brand, input)).rejects.toThrow(/grant/);
 await expect(createRoutingAuthorization(brand, { ...input, grantIds: ["foreign-grant"] })).rejects.toThrow();
 const result = await createRoutingAuthorization(brand, { ...input, grantIds: [grantId] }); authorizationId = result.id;
 expect(result.plainTextToken).toBeNull(); expect(result.expiresAt).toBeNull();
 expect((await authorizeRoutingAuthorizationId(result.id)).grants.map(g => g.id)).toEqual([grantId]);
});
it("automatically queues and routes a matching signed issuance without a lab token, limiting the snapshot", async () => {
 env.TECRID_DELIVERY_ENABLED = "false";
 await expect(issue("UNAUTHORIZED-SKU")).rejects.toThrow(/routing authorization/);
 const issued = await issue();
 expect(await getDb().select().from(evidenceDeliveries)).toHaveLength(0);
 const jobs = await getDb().select().from(credentialRoutingJobs); expect(jobs).toHaveLength(1); expect(jobs[0].status).toBe("queued");
 await processStandingRoutingJobs();
 const deliveries = await getDb().select().from(evidenceDeliveries);
 expect(deliveries).toHaveLength(1); expect(deliveries[0].grantId).toBe(grantId);
 expect(JSON.parse(deliveries[0].snapshotJson).results.map((r: { analyte: string }) => r.analyte)).toEqual(["Lead"]);
 expect(deliveries[0].snapshotJson).not.toContain("9.87");
 expect(await getDb().select().from(controllerEvidenceReceipts)).toHaveLength(1);
 await processStandingRoutingJobs();
 expect(await getDb().select().from(evidenceDeliveries)).toHaveLength(1);
 expect((await getDb().select().from(organizationNotifications)).filter(n => n.organizationId === brand.userId && n.eventType === "laboratory_report.received")).toHaveLength(1);
 expect((await getDb().select().from(credentialRoutingJobs))[0].status).toBe("completed");
 expect(issued.status).toBe("issued");
});
it("routes immediately when automation is enabled and retains the cryptographic gate", async () => {
 env.TECRID_DELIVERY_ENABLED = "true";
 const immediate = await issue();
 expect((await getDb().select().from(evidenceDeliveries)).some(d => d.credentialIdentifier === immediate.identifier)).toBe(true);
 env.TECRID_DELIVERY_ENABLED = "false";
 const tampered = await issue();
 await getDb().update(credentials).set({ fingerprint: "0".repeat(64) }).where(eq(credentials.identifier, tampered.identifier));
 await processStandingRoutingJobs();
 expect((await getDb().select().from(controllerEvidenceReceipts)).some(r => r.credentialIdentifier === tampered.identifier)).toBe(false);
 const [job] = await getDb().select().from(credentialRoutingJobs).where(eq(credentialRoutingJobs.credentialIdentifier, tampered.identifier));
 expect(job.status).toBe("canceled");
});
it("never trusts a cached authorization after the controller revokes a grant", async () => {
 const stale = await authorizeRoutingAuthorizationId(authorizationId);
 await revokeEvidenceGrant(brand, grantId);
 const issued = await issue();
 await deliverCredentialWithAuthorization(stale, issued.identifier);
 expect((await getDb().select().from(evidenceDeliveries)).some(d => d.credentialIdentifier === issued.identifier)).toBe(false);
 expect((await getDb().select().from(evidenceDeliveries)).some(d => d.grantId === unselectedGrantId)).toBe(false);
});
it("revocation stops queued work and future controlled issuance", async () => {
 const pending = await issue();
 await revokeRoutingAuthorization(brand, authorizationId);
 await processStandingRoutingJobs();
 const [job] = await getDb().select().from(credentialRoutingJobs).where(eq(credentialRoutingJobs.credentialIdentifier, pending.identifier));
 expect(job.status).toBe("canceled");
 await expect(issue()).rejects.toThrow(/routing authorization/);
 expect((await getDb().select().from(controllerEvidenceReceipts)).some(r => r.credentialIdentifier === pending.identifier)).toBe(false);
});

it("preserves the exact pre-ingredient signature format and rejects empty ingredient codes", () => {
 const old = JSON.parse(canonicalizeCredential(payload).canonicalPayload);
 expect(old).not.toHaveProperty("ingredientCode"); expect(old).not.toHaveProperty("signatureVersion");
 expect(canonicalizeCredential(payload).canonicalPayload).toBe(JSON.stringify({ type: "TestEvidenceCredential", sampleName: payload.sampleName, productSku: payload.productSku, lotNumber: payload.lotNumber, matrix: null, method: null, submittingParty: null, collectedAt: null, receivedAt: null, testedAt: null, releasedAt: null, visibility: "controlled", sourceDocument: null, results: payload.results.map(r => ({ analyte: r.analyte, symbol: null, resultText: r.resultText, numericValue: r.numericValue, unit: r.unit, loqText: null, method: null })) }));
 expect(() => canonicalizeCredential({ ...payload, ingredientCode: " " })).toThrow(/nonempty/);
 const v2 = JSON.parse(canonicalizeCredential({ ...payload, ingredientCode: "  SHARED-CACAO  " }).canonicalPayload);
 expect(v2.signatureVersion).toBe("tec-credential/2"); expect(v2.ingredientCode).toBe("shared-cacao");
});

let sharedGrantA: string, sharedGrantB: string;
const brandB = user("ingredient-brand-b"), recipientB = user("ingredient-recipient-b");
async function grantFor(controllerCode: string, controller: ReturnType<typeof user>, requester: ReturnType<typeof user>, sku: string, accessLevel: string) {
 const request = await createEvidenceRequest(requester, { controllerOrganizationCode: controllerCode, programName: "Shared ingredient fixture", purpose: "Synthetic routing", productName: sku, productSku: sku, accessLevel, analytes: accessLevel === "selected_analytes" ? ["Lead"] : [], deliveryMode: "future_sku" });
 return (await respondToEvidenceRequest(controller, request.id, { decision: "accept" })).grantId!;
}
it("routes one signed ingredient to two brands' own grants without crossing their scopes", async () => {
 for (const [actor, type, code] of [[brandB,"brand","BRANDB"],[recipientB,"retailer","RECIPIENTB"]] as const) {
  await getDb().insert(organizations).values({ id: actor.userId, name: actor.userId, slug: actor.userId, organizationType: type, ownerUserId: actor.userId, ownerEmail: actor.email, issuerCode: code, issuerStatus: "verified" });
  await getDb().insert(organizationMembers).values({ organizationId: actor.userId, userId: actor.userId, email: actor.email, role: "owner" });
 }
 sharedGrantA = await grantFor("BRAND", brand, recipient, "A-FINISHED", "selected_analytes");
 sharedGrantB = await grantFor("BRANDB", brandB, recipientB, "B-FINISHED", "status_only");
 for (const [actor, grantId] of [[brand, sharedGrantA], [brandB, sharedGrantB]] as const) await createRoutingAuthorization(actor, { authorizationKind: "standing", laboratoryOrganizationCode: "LABSTANDING", productName: "Shared source", ingredientCode: " SHARED-CACAO ", grantIds: [grantId] });
 await expect(createRoutingAuthorization(brand, { authorizationKind: "standing", laboratoryOrganizationCode: "LABSTANDING", productName: "Forbidden cross-brand", ingredientCode: "other-code", grantIds: [sharedGrantB] })).rejects.toThrow();
 const issued = await issue("RAW-SOURCE", "Shared-Cacao"); await processStandingRoutingJobs();
 const deliveries = (await getDb().select().from(evidenceDeliveries)).filter(d => d.credentialIdentifier === issued.identifier);
 expect(deliveries).toHaveLength(2);
 const a = deliveries.find(d => d.controllerOrganizationId === brand.userId)!;
 const b = deliveries.find(d => d.controllerOrganizationId === brandB.userId)!;
 expect(a.grantId).toBe(sharedGrantA); expect(a.recipientOrganizationId).toBe(recipient.userId);
 expect(b.grantId).toBe(sharedGrantB); expect(b.recipientOrganizationId).toBe(recipientB.userId);
 expect(JSON.parse(a.snapshotJson).results.map((r: { analyte: string }) => r.analyte)).toEqual(["Lead"]);
 expect(JSON.parse(b.snapshotJson).results).toEqual([]);
});
it("uses the most specific ingredient plus SKU rule separately for each brand", async () => {
 const specific = await grantFor("BRAND", brand, other, "RAW-SOURCE", "full_record");
 await createRoutingAuthorization(brand, { authorizationKind: "standing", laboratoryOrganizationCode: "LABSTANDING", productName: "RAW-SOURCE", ingredientCode: "shared-cacao", productSku: " raw-source ", grantIds: [specific] });
 const issued = await issue("RAW-SOURCE", "shared-cacao"); await processStandingRoutingJobs();
 const deliveries = (await getDb().select().from(evidenceDeliveries)).filter(d => d.credentialIdentifier === issued.identifier);
 expect(deliveries).toHaveLength(2);
 expect(deliveries.find(d => d.controllerOrganizationId === brand.userId)?.grantId).toBe(specific);
 expect(deliveries.find(d => d.controllerOrganizationId === brandB.userId)?.grantId).toBe(sharedGrantB);
 expect(deliveries.some(d => d.grantId === sharedGrantA)).toBe(false);
});
it("rejects a tampered ingredientCode at signature verification", async () => {
 const input = { ...payload, sourceDocument: syntheticSourceDocument(), visibility: "public", ingredientCode: "signed-source" };
 const canonical = canonicalizeCredential(input).canonicalPayload;
 const proof = { keyId: "standing-test", algorithm: "Ed25519", signature: Buffer.from(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(canonical))).toString("base64url") };
 await expect(createCredential(lab, null, { ...input, ingredientCode: "tampered-source", proof })).rejects.toThrow(/Issuer signature verification failed/);
});

it("supports controlled two-pass finalization without a routing token", async () => {
 const reservation = await reserveReportTecrid(lab, { productName: "RAW-SOURCE", productSku: "RAW-SOURCE" });
 const input = { ...payload, productSku: "RAW-SOURCE", ingredientCode: "shared-cacao", sourceDocument: { sha256: "b".repeat(64), filename: "synthetic-final.pdf" } };
 const canonical = canonicalizeCredential(input).canonicalPayload;
 const proof = { keyId: "standing-test", algorithm: "Ed25519", signature: Buffer.from(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(canonical))).toString("base64url") };
 env.TECRID_DELIVERY_ENABLED = "true";
 const result = await finalizeReportTecrid(lab, reservation.id, { ...input, proof });
 const deliveries = (await getDb().select().from(evidenceDeliveries)).filter(d => d.credentialIdentifier === result.credential?.tecrid);
 expect(deliveries).toHaveLength(2);
});
it("keeps other brands' standing delivery when a lab attaches one brand's explicit token", async () => {
 const token = await createRoutingAuthorization(brand, { laboratoryOrganizationCode: "LABSTANDING", productName: "RAW-SOURCE", productSku: "RAW-SOURCE" });
 const key = await createApiKey(user("standing-lab"), "isolated issuance", ["credentials:write"]);
 const input = { ...payload, sourceDocument: syntheticSourceDocument(), productSku: "RAW-SOURCE", ingredientCode: "shared-cacao" };
 const canonical = canonicalizeCredential(input).canonicalPayload;
 const proof = { keyId: "standing-test", algorithm: "Ed25519", signature: Buffer.from(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(canonical))).toString("base64url") };
 const response = await issueViaApi(new Request("https://tecrid.com/api/v1/credentials", { method: "POST", headers: { authorization: `Bearer ${key.plainTextKey}`, "content-type": "application/json", "idempotency-key": "standing-api-issue" }, body: JSON.stringify({ ...input, proof, routingToken: token.plainTextToken }) }));
 expect(response.status).toBe(201);
 const body = await response.json();
 const deliveries = (await getDb().select().from(evidenceDeliveries)).filter(d => d.credentialIdentifier === body.credential.tecrid);
 expect(new Set(deliveries.map(d => d.controllerOrganizationId))).toEqual(new Set([brand.userId, brandB.userId]));
});

it("routes an ingredient-only signed credential without requiring a SKU", async () => {
 const input = { ...payload, sourceDocument: syntheticSourceDocument(), productSku: undefined, ingredientCode: "shared-cacao" };
 const canonical = canonicalizeCredential(input).canonicalPayload;
 const proof = { keyId: "standing-test", algorithm: "Ed25519", signature: Buffer.from(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(canonical))).toString("base64url") };
 const issued = await createCredential(lab, null, { ...input, proof }); await processStandingRoutingJobs();
 const deliveries = (await getDb().select().from(evidenceDeliveries)).filter(d => d.credentialIdentifier === issued.identifier);
 expect(deliveries).toHaveLength(2);
 expect(deliveries.find(d => d.controllerOrganizationId === brand.userId)?.grantId).toBe(sharedGrantA);
});
it("keeps the legacy SKU whitespace normalization consistent across grants, standing scopes, and signed records", async () => {
 const grant = await grantFor("BRAND", brand, recipient, "SKU ONE", "status_only");
 await createRoutingAuthorization(brand, { authorizationKind: "standing", laboratoryOrganizationCode: "LABSTANDING", productName: "SKU ONE", productSku: "  sku one  ", grantIds: [grant] });
 const issued = await issue("SKU ONE"); await processStandingRoutingJobs();
 expect((await getDb().select().from(evidenceDeliveries)).some(d => d.credentialIdentifier === issued.identifier && d.grantId === grant)).toBe(true);
});
