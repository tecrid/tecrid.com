// @vitest-environment node
import { syntheticSourceDocument } from "./support/source-document";
import { afterAll, beforeAll, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createECDH, createHmac } from "node:crypto";
import { createRequire } from "node:module";
import webPush from "web-push";
import { eq } from "drizzle-orm";
import { env } from "./support/cloudflare-env";
import { getDb } from "../db";
import { credentials, evidenceDeliveries, notificationDeliveries, notificationOutbox, organizations, organizationMembers } from "../db/schema";
import { createEvidenceRequest, respondToEvidenceRequest, createRoutingAuthorization } from "../lib/evidence-routing";
import { canonicalizeCredential, createApiKey } from "../lib/tec";
import { saveNotificationChannel } from "../lib/notification-delivery";
import { acknowledgeOwnedNotification } from "../lib/notification-acknowledgments";
import { brandDeliveryTimeline } from "../lib/delivery-timeline";
const ece = createRequire(import.meta.url)("http_ece");
const actor = (id: string) => ({ userId: id, email: `${id}@example.test`, displayName: id, fullName: id });
const brand = actor("flow-brand"), labUser = actor("flow-lab"), certifier = actor("flow-certifier"), marketplace = actor("flow-marketplace"), gated = actor("flow-gated");
const receiver = createECDH("prime256v1"); receiver.generateKeys(); const auth = Buffer.alloc(16, 8);
const calls: { url: string; headers: Headers; body: Buffer; at: number }[] = [];
const channels = new Map<string, Awaited<ReturnType<typeof saveNotificationChannel>>>();
let proofEvidence: Record<string, unknown> = {};
let mf: Miniflare, privateKey: CryptoKey, apiKey: string, identifier: string, pushEvent: string;
const input = { sourceDocument: syntheticSourceDocument(), sampleName: "SYNTHETIC sandbox lab flow", productSku: "FLOW-SKU", ingredientCode: "synthetic-cacao", lotNumber: "SYNTHETIC-LOT", publish: true, visibility: "controlled", results: [{ analyte: "Lead", resultText: "PRIVATE-LEAD-0.12", unit: "ppb" }, { analyte: "Cadmium", resultText: "PRIVATE-CADMIUM-9.99", unit: "ppb" }] };
async function drain() { const result = await mf.dispatchFetch("https://tecrid.com/api/internal/notification-worker", { method: "POST", headers: { authorization: "Bearer isolated-flow-worker" } }); expect(result.status).toBe(200); await result.json(); }
beforeAll(async () => {
 const vapid = webPush.generateVAPIDKeys();
 const bindings = { TECRID_CHANNEL_SECRET: Buffer.alloc(32,6).toString("base64url"), TECRID_DELIVERY_ENABLED: "true", TECRID_DELIVERY_WORKER_SECRET: "isolated-flow-worker", TECRID_VAPID_PUBLIC_KEY: vapid.publicKey, TECRID_VAPID_PRIVATE_KEY: vapid.privateKey, TECRID_VAPID_SUBJECT: "mailto:fixture@example.org", TECRID_WEBHOOK_HOSTS: "certifier.example.org,marketplace.example.org,gated.example.org" };
 mf = new Miniflare({ modulesRoot: resolve("dist/server"), modules: [{ type: "ESModule", path: resolve("dist/server/index.js") }, ...readdirSync("dist/server", { recursive: true }).filter((file): file is string => typeof file === "string" && file.endsWith(".js") && file !== "index.js").map(file => ({ type: "ESModule" as const, path: resolve("dist/server", file) }))], compatibilityDate: "2026-05-22", compatibilityFlags: ["nodejs_compat"], d1Databases: ["DB"], bindings, outboundService: async (request: Request) => { calls.push({ url: request.url, headers: request.headers, body: Buffer.from(await request.arrayBuffer()), at: Date.now() }); return new Response(null, { status: 202 }); } });
 env.DB = await mf.getD1Database("DB"); Object.assign(env, bindings);
 for (const f of readdirSync("drizzle").filter(x => x.endsWith(".sql")).sort()) for (const s of readFileSync(`drizzle/${f}`, "utf8").split("--> statement-breakpoint").filter(x => x.trim())) await env.DB.prepare(s).run();
 const pair = await crypto.subtle.generateKey("Ed25519",true,["sign","verify"]); privateKey = pair.privateKey;
 for (const [user, type, code] of [[brand,"brand","FLOWBRAND"],[labUser,"laboratory","FLOWLAB"],[certifier,"certification_body","FLOWCERT"],[marketplace,"marketplace","FLOWMARKET"],[gated,"retailer","FLOWGATED"],[actor("flow-other-brand"),"brand","FLOWOTHER"]] as const) {
  await getDb().insert(organizations).values({ id: user.userId, name: `SYNTHETIC ${user.userId}`, slug: user.userId, organizationType: type, ownerUserId: user.userId, ownerEmail: user.email, issuerCode: code, identityStatus: user === gated ? "unreviewed" : "verified", issuerStatus: user === gated ? "pending" : "verified", ...(type === "laboratory" ? { issuerKeyId: "flow-key", issuerKeyAlgorithm: "Ed25519", issuerKeyVerifiedAt: new Date().toISOString(), issuerPublicKeyJwk: JSON.stringify(await crypto.subtle.exportKey("jwk",pair.publicKey)) } : {}) });
  await getDb().insert(organizationMembers).values({ organizationId: user.userId, userId: user.userId, email: user.email, role: "owner" });
 }
 channels.set(brand.userId, await saveNotificationChannel(brand,{ kind:"push", label:"SYNTHETIC phone", subscription:{ endpoint:"https://web.push.apple.com/SyntheticFlow", keys:{p256dh:receiver.getPublicKey().toString("base64url"),auth:auth.toString("base64url")} } }));
 const grantIds: string[] = [];
 for (const [user,host,scope] of [[certifier,"certifier","selected_analytes"],[marketplace,"marketplace","status_only"],[gated,"gated","full_record"]] as const) {
  channels.set(user.userId, await saveNotificationChannel(user,{kind:"webhook",url:`https://${host}.example.org/events`,label:"SYNTHETIC receiver"}));
  const requested = await createEvidenceRequest(user,{controllerOrganizationCode:"FLOWBRAND",programName:"SYNTHETIC",purpose:"Isolated end-to-end test",productName:input.sampleName,productSku:input.productSku,accessLevel:scope,analytes:["Lead"],deliveryMode:"future_sku"});
  grantIds.push((await respondToEvidenceRequest(brand,requested.id,{decision:"accept"})).grantId!);
 }
 await createRoutingAuthorization(brand,{authorizationKind:"standing",laboratoryOrganizationCode:"FLOWLAB",productName:input.sampleName,productSku:input.productSku,ingredientCode:input.ingredientCode,grantIds});
 apiKey = (await createApiKey(labUser,"SYNTHETIC isolated issuance",["credentials:write"])).plainTextKey;
 await drain(); calls.length = 0;
},60000);
afterAll(async () => { await mf?.dispose(); });
it("issues through the built Worker and delivers push and both UNGATED webhooks under 60 seconds, with no GATED disclosure", async () => {
 const canonical = canonicalizeCredential(input).canonicalPayload;
 const proof = {keyId:"flow-key",algorithm:"Ed25519",signature:Buffer.from(await crypto.subtle.sign("Ed25519",privateKey,new TextEncoder().encode(canonical))).toString("base64url")};
 const result = await mf.dispatchFetch("https://tecrid.com/api/v1/credentials",{method:"POST",headers:{authorization:`Bearer ${apiKey}`,"content-type":"application/json","idempotency-key":"synthetic-flow-issue"},body:JSON.stringify({...input,proof})});
 const responseBody = await result.json() as {credential:{tecrid:string}}; expect(result.status, JSON.stringify(responseBody)).toBe(201); identifier = responseBody.credential.tecrid;
 await drain();
 const until = Date.now()+15000;
 while (calls.length < 3 && Date.now()<until) await new Promise(resolve => setTimeout(resolve,50));
 const [record] = await getDb().select().from(credentials).where(eq(credentials.identifier,identifier));
 const push = calls.find(call => call.url.includes("web.push.apple.com"))!; expect(push).toBeTruthy();
 const payload = JSON.parse(ece.decrypt(push.body,{version:"aes128gcm",privateKey:receiver,authSecret:auth}).toString()); pushEvent = payload.eventId;
 expect(Object.keys(payload).sort()).toEqual(["event","eventId","sku","url"]); expect(JSON.stringify(payload)).not.toContain("PRIVATE"); expect(payload.sku).toBe("FLOW-SKU");
 const cert = calls.find(call => call.url.includes("certifier.example.org"))!, market = calls.find(call => call.url.includes("marketplace.example.org"))!;
 expect(cert).toBeTruthy(); expect(market).toBeTruthy(); expect(calls.some(call => call.url.includes("gated.example.org"))).toBe(false);
 for (const [call,user] of [[cert,certifier],[market,marketplace]] as const) {
  const body = JSON.parse(call.body.toString()); expect(body.delivery.tecrid).toBe(identifier);
  const [stamp,sig] = call.headers.get("x-tecrid-signature")!.split(","); expect(sig).toBe(`v1=${createHmac("sha256",channels.get(user.userId)!.webhookSecret!).update(`${stamp.slice(2)}.${call.body.toString()}`).digest("hex")}`);
 }
 expect(JSON.parse(JSON.parse(cert.body.toString()).delivery.snapshotJson).results.map((r:{analyte:string})=>r.analyte)).toEqual(["Lead"]);
 expect(market.body.toString()).not.toContain("PRIVATE");
 expect((await getDb().select().from(evidenceDeliveries)).filter(row => row.recipientOrganizationId===gated.userId)).toEqual([]);
 const measurements = { pushMs:push.at-Date.parse(record.issuedAt!),certifierMs:cert.at-Date.parse(record.issuedAt!),marketplaceMs:market.at-Date.parse(record.issuedAt!) };
 for (const value of Object.values(measurements)) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThan(60000); }
 proofEvidence = {synthetic:true,tecrid:identifier,...measurements,pushPayload:payload,gatedSnapshotCount:0,gatedNetworkCount:0};
 console.info("MINT_LATENCY_PROOF "+JSON.stringify(proofEvidence));
 if (process.env.TECRID_MINT_PROOF_PATH) writeFileSync(process.env.TECRID_MINT_PROOF_PATH, JSON.stringify(proofEvidence,null,2)+"\n");
},30000);
it("records signed durable acknowledgments and authenticated push opens separately from transport acceptance", async () => {
 const before = await brandDeliveryTimeline(brand); const flow = before.find(row=>row.tecrid===identifier)!;
 expect(flow.mintedAt).toBeTruthy(); expect(flow.events.filter(row=>row.deliveredAt)).toHaveLength(3); expect(flow.events.every(row=>!row.acknowledgedAt)).toBe(true);
 for (const user of [certifier,marketplace]) {
  const call = calls.find(call=>call.url.includes(user===certifier?"certifier.example.org":"marketplace.example.org"))!;
  const eventId = JSON.parse(call.body.toString()).eventId, channel = channels.get(user.userId)!;
  const body = JSON.stringify({eventId,channelId:channel.id}), stamp = String(Math.floor(Date.now()/1000));
  const signature = `t=${stamp},v1=${createHmac("sha256",channel.webhookSecret!).update(`${stamp}.${body}`).digest("hex")}`;
  const send = () => mf.dispatchFetch("https://tecrid.com/api/notification-acknowledgments",{method:"POST",headers:{"content-type":"application/json","x-tecrid-signature":signature},body});
  const response = await send(); expect(response.status).toBe(200); const first = await response.json(); expect(await (await send()).json()).toEqual(first);
  const concurrent = await Promise.all([send(),send()]); for (const repeated of concurrent) expect(await repeated.json()).toEqual(first);
  const expiredStamp = String(Number(stamp)-301);
  const expired = await mf.dispatchFetch("https://tecrid.com/api/notification-acknowledgments",{method:"POST",headers:{"x-tecrid-signature":`t=${expiredStamp},v1=${createHmac("sha256",channel.webhookSecret!).update(`${expiredStamp}.${body}`).digest("hex")}`},body}); expect(expired.status).toBe(403);
  const denied = await mf.dispatchFetch("https://tecrid.com/api/notification-acknowledgments",{method:"POST",headers:{"x-tecrid-signature":`t=${stamp},v1=${"0".repeat(64)}`},body}); expect(denied.status).toBe(403);
 }
 await expect(acknowledgeOwnedNotification(certifier,{eventId:pushEvent,channelId:channels.get(brand.userId)!.id})).rejects.toThrow();
 await acknowledgeOwnedNotification(brand,{eventId:pushEvent,channelId:channels.get(brand.userId)!.id});
 const after = (await brandDeliveryTimeline(brand)).find(row=>row.tecrid===identifier)!;
 expect(after.events.filter(row=>row.acknowledgedAt)).toHaveLength(3); expect(after.events.filter(row=>row.deliveredAt).every(row=>row.latencyMs!<60000)).toBe(true);
 expect(await brandDeliveryTimeline(actor("flow-other-brand"))).toEqual([]);
 proofEvidence.timeline = after;
 if (process.env.TECRID_MINT_PROOF_PATH) writeFileSync(process.env.TECRID_MINT_PROOF_PATH, JSON.stringify(proofEvidence,null,2)+"\n");
 expect(JSON.stringify(after)).not.toContain("PRIVATE"); expect(JSON.stringify(after)).not.toContain("SYNTHETIC phone");
 const [event] = await getDb().select().from(notificationOutbox).where(eq(notificationOutbox.id,pushEvent)); expect(event.organizationId).toBe(brand.userId);
 expect((await getDb().select().from(notificationDeliveries)).filter(row=>row.acknowledgedAt)).toHaveLength(3);
},30000);
