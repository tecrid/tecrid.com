// @vitest-environment node
import {afterAll,beforeAll,expect,it} from "vitest";
import {createHmac} from "node:crypto";
import {writeFileSync} from "node:fs";
import {eq,asc} from "drizzle-orm";
import {evidenceFixture,actor} from "./support/evidence-fixture";
import {env} from "./support/cloudflare-env";
import {syntheticSourceDocument} from "./support/source-document";
import {getDb} from "../db";
import {evidenceDeliveries,marketplaceStreamEvents,marketplaceStreamJobs,organizations,notificationOutbox} from "../db/schema";
import {canonicalizeCredential,canonicalizeCredentialRevision,createCredential,createCredentialRevision} from "../lib/tec";
import {authorizeRoutingAuthorizationId,createEvidenceRequest,respondToEvidenceRequest,createRoutingAuthorization,deliverCredentialWithAuthorization,processStandingRoutingJobs,revokeEvidenceGrant} from "../lib/evidence-routing";
import {marketplaceEventGate,processMarketplaceStreamJobs,reviewMarketplaceMapping,setMarketplaceGrantSettings} from "../lib/marketplace-stream";
import {processNotificationOutbox,saveNotificationChannel} from "../lib/notification-delivery";
let f:Awaited<ReturnType<typeof evidenceFixture>>,tecrid:string,deliveryId:string,secondGrant:string;
const operator=actor("stream-operator"),supplier="stream-supplier";
const input={sampleName:"Synthetic stream",productSku:"SEC-SKU",ingredientCode:"synthetic-ingredient",lotNumber:"SYNTHETIC-LOT",originatingSupplier:supplier,publish:true,visibility:"controlled",sourceDocument:syntheticSourceDocument(),results:[{analyte:"Synthetic analyte",resultText:"SYNTHETIC-PRIVATE",unit:"test-unit"}]};
const events=()=>getDb().select().from(marketplaceStreamEvents).orderBy(asc(marketplaceStreamEvents.sequence));
beforeAll(async()=>{
 f=await evidenceFixture();env.ICS_ADMIN_EMAILS=operator.email;
 await getDb().update(organizations).set({organizationType:"marketplace"}).where(eq(organizations.id,f.recipient.userId));
 await getDb().insert(organizations).values({id:supplier,name:"Synthetic supplier",slug:supplier,organizationType:"supplier",ownerUserId:supplier,ownerEmail:"supplier@stream.test",issuerCode:"STREAMSUPPLIER",identityStatus:"verified"});
 await createRoutingAuthorization(f.brand,{authorizationKind:"standing",laboratoryOrganizationCode:"SECLAB",productName:"Synthetic evidence",productSku:"SEC-SKU",ingredientCode:"synthetic-ingredient",grantIds:[f.grantId]});
 const canonical=canonicalizeCredential(input).canonicalPayload;
 const proof={keyId:"security-fixture-key",algorithm:"Ed25519",signature:Buffer.from(await crypto.subtle.sign("Ed25519",f.privateKey,new TextEncoder().encode(canonical))).toString("base64url")};
 tecrid=(await createCredential(f.laboratory,null,{...input,proof})).identifier;
 await processStandingRoutingJobs();
 [ {id:deliveryId} ]=await getDb().select().from(evidenceDeliveries).where(eq(evidenceDeliveries.credentialIdentifier,tecrid));
},60000);
afterAll(async()=>{if(process.env.TECRID_VLE_CONTRACT_FIXTURES){const rows=await events();const bodies=rows.map(r=>JSON.parse(r.bodyJson)).filter(b=>b.operation==="tombstone"||b.grant.accessLevel==="status_only");writeFileSync(process.env.TECRID_VLE_CONTRACT_FIXTURES,JSON.stringify(bodies,null,2)+"\n");}await f?.mf.dispose();});
it("withholds unmapped evidence with a clear durable reason, and rejects caller-created mappings",async()=>{
 expect((await processMarketplaceStreamJobs()).appended).toBe(0);
 expect((await getDb().select().from(marketplaceStreamJobs)).some(j=>j.heldReason==="reviewed_supplier_mapping_required")).toBe(true);
 await expect(reviewMarketplaceMapping(f.brand,{supplierOrganizationId:supplier,recipientOrganizationId:f.recipient.userId,externalSupplierId:"vle-supplier",active:true,reviewNote:"Synthetic operator review of both organizations"})).rejects.toThrow(/operator/);
});
it("uses a reviewed mapping, native middle-dot identity, analytical program and false/empty consent",async()=>{
 await reviewMarketplaceMapping(operator,{supplierOrganizationId:supplier,recipientOrganizationId:f.recipient.userId,externalSupplierId:"vle-supplier",active:true,reviewNote:"Synthetic operator review of both organizations"});
 expect((await processMarketplaceStreamJobs()).appended).toBe(1);
 const [row]=await events(),body=JSON.parse(row.bodyJson);
 expect(body).toMatchObject({schemaVersion:"vle-evidence/1",operation:"upsert",sequence:1,credential:{tecrid,program:"analytical-record",identity:{originatingSupplier:supplier,originatingSupplierId:"vle-supplier",supplierLotId:"SYNTHETIC-LOT"}},grant:{id:f.grantId,publicStatus:false,brandOrganizationIds:[]}});
 expect(body.credential.tecrid).toContain("·");expect(body.snapshot.results[0].resultText).toBe("SYNTHETIC-PRIVATE");
 const outbox=await getDb().select().from(notificationOutbox).where(eq(notificationOutbox.id,row.id));expect(JSON.stringify(outbox)).not.toContain("SYNTHETIC-PRIVATE");
 await expect(getDb().update(marketplaceStreamEvents).set({bodyJson:"{}"}).where(eq(marketplaceStreamEvents.id,row.id))).rejects.toThrow();
 await expect(getDb().delete(marketplaceStreamEvents).where(eq(marketplaceStreamEvents.id,row.id))).rejects.toThrow();
});
it("supports multiple grants in one monotonic stream and concurrent retry is idempotent",async()=>{
 const request=await createEvidenceRequest(f.recipient,{controllerOrganizationCode:"SECBRAND",programName:"Synthetic",purpose:"Second scope",productName:"Synthetic evidence",productSku:"SEC-SKU",accessLevel:"status_only",deliveryMode:"future_sku"});
 secondGrant=(await respondToEvidenceRequest(f.brand,request.id,{decision:"accept"})).grantId!;
 const authorization=await createRoutingAuthorization(f.brand,{laboratoryOrganizationCode:"SECLAB",productName:"Synthetic evidence",productSku:"SEC-SKU"});
 await deliverCredentialWithAuthorization(await authorizeRoutingAuthorizationId(authorization.id,f.lab.userId),tecrid);
 await Promise.all(Array.from({length:4},()=>processMarketplaceStreamJobs()));
 const rows=await events();expect(rows).toHaveLength(2);expect(rows.map(r=>r.sequence)).toEqual([1,2]);expect(new Set(rows.map(r=>r.streamId)).size).toBe(1);expect(new Set(rows.map(r=>r.grantId)).size).toBe(2);
 expect(JSON.parse(rows[1].bodyJson).snapshot.results).toEqual([]);
});
it("requires controlling-brand consent and delivers stable native bodies with valid raw-byte HMAC",async()=>{
 env.TECRID_DELIVERY_ENABLED="true";env.TECRID_CHANNEL_SECRET=Buffer.alloc(32,8).toString("base64url");env.TECRID_WEBHOOK_HOSTS="stream.example.org";
 const channel=await saveNotificationChannel(f.recipient,{kind:"webhook",url:"https://stream.example.org/events",label:"Synthetic capture"});
 await expect(setMarketplaceGrantSettings(f.other,f.grantId,{publicStatus:true,brandOrganizationIds:["vle-brand"]})).rejects.toThrow();
 await new Promise(resolve=>setTimeout(resolve,5));
 await setMarketplaceGrantSettings(f.brand,f.grantId,{publicStatus:true,brandOrganizationIds:["vle-brand"]});
 await processMarketplaceStreamJobs();const rows=await events(),event=rows.at(-1)!;expect(JSON.parse(event.bodyJson).grant).toMatchObject({publicStatus:true,brandOrganizationIds:["vle-brand"]});
 const bodies:string[]=[];
 const transport=async(_url:RequestInfo|URL,init?:RequestInit)=>{const raw=String(init?.body),headers=new Headers(init?.headers),[time,sig]=headers.get("x-tecrid-signature")!.split(",");expect(sig).toBe(`v1=${createHmac("sha256",channel.webhookSecret!).update(`${time.slice(2)}.${raw}`).digest("hex")}`);expect(headers.get("x-tecrid-event-id")).toBe(JSON.parse(raw).eventId);bodies.push(raw);return new Response(null,{status:bodies.length===1?503:202});};
 await processNotificationOutbox({transport});await processNotificationOutbox({transport,at:Date.now()+60000});
 expect(bodies).toEqual([event.bodyJson,event.bodyJson]);
});
it("keeps signed supplier identity through correction and emits an ordered current version",async()=>{
 const revision={action:"correct",reason:"Synthetic correction",...input,results:[{analyte:"Synthetic analyte",resultText:"SYNTHETIC-CORRECTED",unit:"test-unit"}]};
 const canonical=(await canonicalizeCredentialRevision(f.laboratory,tecrid,revision)).canonicalPayload;
 const proof={keyId:"security-fixture-key",algorithm:"Ed25519",signature:Buffer.from(await crypto.subtle.sign("Ed25519",f.privateKey,new TextEncoder().encode(canonical))).toString("base64url")};
 await createCredentialRevision(f.laboratory,null,tecrid,{...revision,proof});await processMarketplaceStreamJobs();
 const rows=await events(),latest=JSON.parse(rows.at(-1)!.bodyJson);expect(latest.event).toBe("credential.corrected");expect(latest.credential.version).toBe(2);expect(latest.credential.identity.originatingSupplier).toBe(supplier);
 expect(rows.map(r=>r.sequence)).toEqual(rows.map((_,i)=>i+1));
 const stale=rows.find(r=>JSON.parse(r.bodyJson).credential.version===1)!;expect((await marketplaceEventGate({id:stale.id,entityId:stale.id,organizationId:f.recipient.userId},"unrelated-channel")).mode).toBe("cancel");
});
it("emits metadata-only revocation after access closes and never drops another grant's identity",async()=>{
 await revokeEvidenceGrant(f.brand,secondGrant);await processMarketplaceStreamJobs();
 const rows=await events(),last=rows.at(-1)!,body=JSON.parse(last.bodyJson);expect(body).toMatchObject({event:"grant.revoked",operation:"tombstone",grant:{id:secondGrant,status:"revoked",publicStatus:false,brandOrganizationIds:[]}});
 expect(body).not.toHaveProperty("snapshot");expect(last.bodyJson).not.toContain("SYNTHETIC-PRIVATE");expect(last.bodyJson).not.toContain("SYNTHETIC-CORRECTED");
 expect((await marketplaceEventGate({id:last.id,entityId:last.id,organizationId:f.recipient.userId},"unrelated-channel")).mode).toBe("allow");
 expect((await marketplaceEventGate({id:last.id,entityId:last.id,organizationId:f.other.userId},"unrelated-channel")).mode).toBe("cancel");
 expect(rows.filter(r=>r.grantId===f.grantId).at(-1)?.operation).toBe("upsert");
});
it("withdraws a revoked mapping with a tombstone even when recipient gate would block evidence",async()=>{
 await reviewMarketplaceMapping(operator,{supplierOrganizationId:supplier,recipientOrganizationId:f.recipient.userId,externalSupplierId:"vle-supplier",active:false,reviewNote:"Synthetic mapping withdrawal decision"});await processMarketplaceStreamJobs();
 const last=(await events()).filter(e=>e.grantId===f.grantId).at(-1)!;expect(JSON.parse(last.bodyJson)).toMatchObject({operation:"tombstone",reason:"reviewed_supplier_mapping_required"});expect(last.bodyJson).not.toContain("SYNTHETIC-CORRECTED");
 expect((await getDb().select().from(evidenceDeliveries).where(eq(evidenceDeliveries.id,deliveryId)))).toHaveLength(1);
});
it("records replacement grants without allowing a superseded grant to restore its payload",async()=>{
 const request=await createEvidenceRequest(f.recipient,{controllerOrganizationCode:"SECBRAND",programName:"Synthetic",purpose:"Replacement",productName:"Synthetic evidence",productSku:"SEC-SKU",accessLevel:"status_only",deliveryMode:"future_sku"});
 const replacement=(await respondToEvidenceRequest(f.brand,request.id,{decision:"accept"})).grantId!;
 await setMarketplaceGrantSettings(f.brand,replacement,{publicStatus:false,brandOrganizationIds:[],supersedesGrantId:f.grantId});
 const auth=await createRoutingAuthorization(f.brand,{laboratoryOrganizationCode:"SECLAB",productName:"Synthetic evidence",productSku:"SEC-SKU"});
 await deliverCredentialWithAuthorization(await authorizeRoutingAuthorizationId(auth.id,f.lab.userId),tecrid);
 await reviewMarketplaceMapping(operator,{supplierOrganizationId:supplier,recipientOrganizationId:f.recipient.userId,externalSupplierId:"vle-supplier",active:true,reviewNote:"Synthetic mapping reviewed and restored"});await processMarketplaceStreamJobs();
 const rows=await events();expect(JSON.parse(rows.filter(r=>r.grantId===replacement).at(-1)!.bodyJson).grant.supersedesGrantId).toBe(f.grantId);
 expect(rows.filter(r=>r.grantId===f.grantId).at(-1)?.operation).toBe("tombstone");
 await expect(setMarketplaceGrantSettings(f.brand,f.grantId,{publicStatus:false,brandOrganizationIds:[],supersedesGrantId:replacement})).rejects.toThrow();
 await expect(reviewMarketplaceMapping(operator,{supplierOrganizationId:supplier,recipientOrganizationId:f.recipient.userId,externalSupplierId:"wrong-supplier",active:true,reviewNote:"Synthetic attempt to change identity"})).rejects.toThrow(/identity/);
});
it("captures recipient identity withdrawal and signed credential revocation without retained result payloads",async()=>{
 await getDb().update(organizations).set({identityStatus:"revoked"}).where(eq(organizations.id,f.recipient.userId));await processMarketplaceStreamJobs();
 const withdrawn=(await events()).at(-1)!;expect(JSON.parse(withdrawn.bodyJson).operation).toBe("tombstone");expect(withdrawn.bodyJson).not.toContain("SYNTHETIC-CORRECTED");
 await getDb().update(organizations).set({identityStatus:"verified"}).where(eq(organizations.id,f.recipient.userId));await processMarketplaceStreamJobs();
 const revision={action:"revoke",reason:"Synthetic final withdrawal"};const canonical=(await canonicalizeCredentialRevision(f.laboratory,tecrid,revision)).canonicalPayload;
 const proof={keyId:"security-fixture-key",algorithm:"Ed25519",signature:Buffer.from(await crypto.subtle.sign("Ed25519",f.privateKey,new TextEncoder().encode(canonical))).toString("base64url")};
 await createCredentialRevision(f.laboratory,null,tecrid,{...revision,proof});await processMarketplaceStreamJobs();
 const rows=await events(),revoked=JSON.parse(rows.at(-1)!.bodyJson);expect(revoked).toMatchObject({operation:"tombstone",event:"credential.revoked",credential:{version:3,status:"revoked"}});expect(JSON.stringify(revoked)).not.toContain("SYNTHETIC-CORRECTED");
 expect(rows.map(r=>r.sequence)).toEqual(rows.map((_,i)=>i+1));
});
it("holds oversized full records while preserving the authorized status-only stream",async()=>{
 const request=await createEvidenceRequest(f.recipient,{controllerOrganizationCode:"SECBRAND",programName:"Synthetic",purpose:"Bounded payload",productName:"Synthetic evidence",productSku:"SEC-SKU",accessLevel:"full_record",deliveryMode:"future_sku"});
 const full=(await respondToEvidenceRequest(f.brand,request.id,{decision:"accept"})).grantId!;
 const large={...input,sourceDocument:syntheticSourceDocument(),results:Array.from({length:100},(_,i)=>({analyte:`Synthetic-${i}`,resultText:"S".repeat(80),unit:"U".repeat(40),method:"M".repeat(120),loqText:"L".repeat(80)}))};
 const canonical=canonicalizeCredential(large).canonicalPayload,proof={keyId:"security-fixture-key",algorithm:"Ed25519",signature:Buffer.from(await crypto.subtle.sign("Ed25519",f.privateKey,new TextEncoder().encode(canonical))).toString("base64url")};
 const issued=await createCredential(f.laboratory,null,{...large,proof});await processStandingRoutingJobs();
 const authorization=await createRoutingAuthorization(f.brand,{laboratoryOrganizationCode:"SECLAB",productName:"Synthetic evidence",productSku:"SEC-SKU"});
 await deliverCredentialWithAuthorization(await authorizeRoutingAuthorizationId(authorization.id,f.lab.userId),issued.identifier);await processMarketplaceStreamJobs();
 const rows=(await events()).filter(r=>r.credentialIdentifier===issued.identifier);
 expect(rows.length).toBeGreaterThan(0);expect(rows.some(r=>r.grantId===full)).toBe(false);expect(rows.every(r=>JSON.parse(r.bodyJson).snapshot.results.length===0)).toBe(true);
 expect((await getDb().select().from(marketplaceStreamJobs)).some(j=>j.heldReason==="marketplace_payload_too_large")).toBe(true);
});
