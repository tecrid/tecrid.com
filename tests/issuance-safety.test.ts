// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { env } from "./support/cloudflare-env";
import { getDb } from "../db";
import { credentials, credentialVersions, notificationOutbox, organizations, organizationMembers, controllerEvidenceReceipts, evidenceDeliveries } from "../db/schema";
import { canonicalizeCredential, canonicalizeCredentialRevision, createCredentialRevision, createApiKey, createCredential, getCredential } from "../lib/tec";
import { authorizeRoutingAuthorizationId, createEvidenceRequest, respondToEvidenceRequest, createRoutingAuthorization, deliverCredentialWithAuthorization } from "../lib/evidence-routing";
import { POST } from "../app/api/v1/credentials/route";
const actor=(id:string)=>({userId:id,email:`${id}@example.test`,displayName:id,fullName:id});
const labUser=actor("safe-lab"), otherLab=actor("safe-lab-two"), brand=actor("safe-brand"), recipient=actor("safe-recipient");
const hash=(value:string)=>createHash("sha256").update(`SYNTHETIC ${value}`).digest("hex");
let mf:Miniflare, privateKey:CryptoKey, lab:typeof organizations.$inferSelect, key:string, secondKey:string, firstIdentifier:string;
const base={sampleName:"SYNTHETIC source retry",productSku:"SAFE-SKU",lotNumber:"SAFE-LOT",publish:true,sourceDocument:{sha256:hash("source one"),filename:"synthetic-source.pdf"},results:[{analyte:"Lead",resultText:"PRIVATE-RESULT",unit:"ppb"}]};
async function signed(input:Record<string,unknown>) { return {...input,proof:{keyId:"safe-key",algorithm:"Ed25519",signature:Buffer.from(await crypto.subtle.sign("Ed25519",privateKey,new TextEncoder().encode(canonicalizeCredential(input).canonicalPayload))).toString("base64url")}}; }
function post(body:unknown,idempotencyKey?:string,bearer=key) { return POST(new Request("https://tecrid.com/api/v1/credentials",{method:"POST",headers:{authorization:`Bearer ${bearer}`,"content-type":"application/json",...(idempotencyKey?{"idempotency-key":idempotencyKey}:{})},body:JSON.stringify(body)})); }
beforeAll(async()=>{
 mf=new Miniflare({modules:true,script:"export default {fetch(){return new Response('test')}}",compatibilityDate:"2026-05-22",d1Databases:["DB"]});env.DB=await mf.getD1Database("DB");env.TECRID_DELIVERY_ENABLED="false";
 for(const f of readdirSync("drizzle").filter(x=>x.endsWith(".sql")).sort())for(const s of readFileSync(`drizzle/${f}`,"utf8").split("--> statement-breakpoint").filter(x=>x.trim()))await env.DB.prepare(s).run();
 const pair=await crypto.subtle.generateKey("Ed25519",true,["sign","verify"]);privateKey=pair.privateKey;
 for(const [user,type,code] of [[labUser,"laboratory","SAFELAB"],[otherLab,"laboratory","SAFELABTWO"],[brand,"brand","SAFEBRAND"],[recipient,"certification_body","SAFERECIPIENT"]] as const){
  await getDb().insert(organizations).values({id:user.userId,name:user.userId,slug:user.userId,organizationType:type,ownerUserId:user.userId,ownerEmail:user.email,issuerCode:code,issuerStatus:"verified",...(type==="laboratory"?{issuerKeyId:"safe-key",issuerKeyAlgorithm:"Ed25519",issuerKeyVerifiedAt:new Date().toISOString(),issuerPublicKeyJwk:JSON.stringify(await crypto.subtle.exportKey("jwk",pair.publicKey))}:{})});
  await getDb().insert(organizationMembers).values({organizationId:user.userId,userId:user.userId,email:user.email,role:"owner"});
 }
 [lab]=await getDb().select().from(organizations).where(eq(organizations.id,labUser.userId));key=(await createApiKey(labUser,"Synthetic",["credentials:write"])).plainTextKey;secondKey=(await createApiKey(otherLab,"Synthetic",["credentials:write"])).plainTextKey;
},60000);
afterAll(async()=>{await mf?.dispose();});
it("requires an issuance key and signed source hash before creating anything",async()=>{
 expect((await post(await signed(base))).status).toBe(400);
 expect((await post(await signed({...base,sourceDocument:undefined}),"missing-source")).status).toBe(400);
 expect(await getDb().select().from(credentials)).toEqual([]);expect(await getDb().select().from(notificationOutbox)).toEqual([]);
});
it("atomically deduplicates concurrent requests and source-hash retries without duplicate events",async()=>{
 const body=await signed(base);const responses=await Promise.all(Array.from({length:4},()=>post(body,"same-request")));
 expect(responses.map(response=>response.status).sort()).toEqual([200,200,200,201]);
 const bodies=await Promise.all(responses.map(response=>response.json()));expect(new Set(bodies.map(body=>body.credential.tecrid)).size).toBe(1);firstIdentifier=bodies[0].credential.tecrid;
 expect(await getDb().select().from(credentials)).toHaveLength(1);expect(await getDb().select().from(credentialVersions)).toHaveLength(1);expect(await getDb().select().from(notificationOutbox)).toHaveLength(1);
 const sourceRetry=await post(body,"different-key-same-source");expect(sourceRetry.status).toBe(200);expect((await sourceRetry.json()).credential.tecrid).toBe(firstIdentifier);
 expect((await getCredential(firstIdentifier))!.integrity.issuerSignatureVerified).toBe(true);
 const change={...base,action:"revoke",reason:"SYNTHETIC revoked-source retry"};const canonical=await canonicalizeCredentialRevision(lab,firstIdentifier,change);
 await createCredentialRevision(lab,null,firstIdentifier,{...change,proof:{keyId:"safe-key",algorithm:"Ed25519",signature:Buffer.from(await crypto.subtle.sign("Ed25519",privateKey,new TextEncoder().encode(canonical.canonicalPayload))).toString("base64url")}});
 const afterRevocation=await post(body,"after-revocation");expect(afterRevocation.status).toBe(200);expect((await afterRevocation.json()).credential.tecrid).toBe(firstIdentifier);
 expect(await getDb().select().from(credentials)).toHaveLength(1);expect(await getDb().select().from(credentialVersions)).toHaveLength(2);expect(await getDb().select().from(notificationOutbox)).toHaveLength(2);
});
it("rejects key/content and source/content conflicts while isolating each laboratory",async()=>{
 expect((await post(await signed({...base,sourceDocument:{...base.sourceDocument,sha256:hash("source two")}}),"same-request")).status).toBe(409);
 expect((await post(await signed({...base,lotNumber:"CHANGED"}),"conflicting-source")).status).toBe(409);
 const other=await post(await signed(base),"same-request",secondKey);expect(other.status).toBe(201);expect((await other.json()).credential.tecrid).not.toBe(firstIdentifier);
 await expect(getDb().insert(credentials).values({identifier:"FORBIDDEN-DUPLICATE",organizationId:lab.id,status:"issued",sampleName:"Synthetic",sourceDocumentHash:base.sourceDocument.sha256})).rejects.toThrow();
 await expect(getDb().insert(credentials).values({identifier:"FORBIDDEN-NO-SOURCE",organizationId:lab.id,status:"issued",sampleName:"Synthetic"})).rejects.toThrow();
});
it("requires signed lot or sample linkage before issuing or routing a SKU",async()=>{
 const request=await createEvidenceRequest(recipient,{controllerOrganizationCode:"SAFEBRAND",programName:"SYNTHETIC",purpose:"Linkage guard",productName:base.sampleName,productSku:base.productSku,accessLevel:"status_only",deliveryMode:"future_sku"});
 const grantId=(await respondToEvidenceRequest(brand,request.id,{decision:"accept"})).grantId!;
 await createRoutingAuthorization(brand,{authorizationKind:"standing",laboratoryOrganizationCode:"SAFELAB",productName:base.sampleName,productSku:base.productSku,grantIds:[grantId]});
 const unlinked={...base,lotNumber:undefined,visibility:"controlled",sourceDocument:{...base.sourceDocument,sha256:hash("unlinked")}};
 expect((await post(await signed(unlinked),"unlinked")).status).toBe(400);
 const linked={...unlinked,sourceDocument:{...unlinked.sourceDocument,intakeId:"SYNTHETIC-SAMPLE-REF"}};
 const linkedResponse=await post(await signed(linked),"sample-linked");expect(linkedResponse.status).toBe(201);
 const linkedIdentifier=(await linkedResponse.json()).credential.tecrid;
 const revised=await canonicalizeCredentialRevision(lab,linkedIdentifier,{...linked,action:"correct",reason:"SYNTHETIC preserve sample link"});
 expect(revised.normalizedRevision.credential.sourceDocument.intakeId).toBe("SYNTHETIC-SAMPLE-REF");
 const unsafe={...base,productSku:"LATER-ROUTE",lotNumber:undefined,sourceDocument:{...base.sourceDocument,sha256:hash("later route")}};
 const made=await createCredential(lab,null,await signed(unsafe));
 const next=await createEvidenceRequest(recipient,{controllerOrganizationCode:"SAFEBRAND",programName:"SYNTHETIC",purpose:"Later route linkage",productName:base.sampleName,productSku:unsafe.productSku,accessLevel:"status_only",deliveryMode:"future_sku"});
 const nextGrant=(await respondToEvidenceRequest(brand,next.id,{decision:"accept"})).grantId!;
 const authorization=await createRoutingAuthorization(brand,{authorizationKind:"standing",laboratoryOrganizationCode:"SAFELAB",productName:base.sampleName,productSku:unsafe.productSku,grantIds:[nextGrant]});
 await expect(deliverCredentialWithAuthorization(await authorizeRoutingAuthorizationId(authorization.id),made.identifier)).rejects.toThrow(/signed lot or sample/);
 await expect(getDb().insert(controllerEvidenceReceipts).values({id:"forbidden-link",routingAuthorizationId:authorization.id,controllerOrganizationId:brand.userId,laboratoryOrganizationId:lab.id,credentialIdentifier:made.identifier,credentialVersion:1,snapshotJson:"{}",snapshotFingerprint:"0".repeat(64)})).rejects.toThrow();
 await expect(getDb().insert(evidenceDeliveries).values({id:"forbidden-link-recipient",grantId:nextGrant,routingAuthorizationId:authorization.id,controllerOrganizationId:brand.userId,recipientOrganizationId:recipient.userId,credentialIdentifier:made.identifier,credentialVersion:1,accessLevel:"status_only",snapshotJson:"{}",snapshotFingerprint:"0".repeat(64)})).rejects.toThrow();
});
