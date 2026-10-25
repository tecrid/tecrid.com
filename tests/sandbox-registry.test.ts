// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { resolve } from "node:path";
import { getDb } from "../db";
import { env } from "./support/cloudflare-env";
import { credentials, notificationOutbox, sandboxRegistryCredentials, organizations, organizationMembers } from "../db/schema";
import { createApiKey, getCredential } from "../lib/tec";
import { canonicalizeSandboxCredential } from "../lib/sandbox-registry";
import { createSandboxApiKey, revokeSandboxApiKey } from "../lib/sandbox";
const actor=(id:string)=>({userId:id,email:`${id}@example.test`,displayName:id,fullName:id});
const user=actor("registry-lab"),other=actor("registry-other");
let mf:Miniflare, privateKey:CryptoKey, jwk:JsonWebKey, sandboxKey:Awaited<ReturnType<typeof createSandboxApiKey>>,otherKey:string,liveKey:string,identifier:string;
const input={sampleName:"SYNTHETIC real sandbox issuance",productSku:"SANDBOX-SKU",ingredientCode:"test-cacao",lotNumber:"SYNTHETIC-LOT",sourceDocument:{sha256:"e".repeat(64),filename:"synthetic.pdf"},publish:true,visibility:"controlled",results:[{analyte:"Lead",resultText:"PRIVATE-SANDBOX-ONLY",unit:"ppb"}]};
const network:string[]=[];
async function signed(subject:Record<string,unknown>=input){return{...subject,proof:{algorithm:"Ed25519",keyId:"sandbox-test-key",publicKeyJwk:jwk,signature:Buffer.from(await crypto.subtle.sign("Ed25519",privateKey,new TextEncoder().encode(canonicalizeSandboxCredential(subject).canonicalPayload))).toString("base64url")}};}
function post(path:string,body:unknown,bearer=sandboxKey.plainTextKey,key="sandbox-job"){return mf.dispatchFetch(`https://tecrid.com${path}`,{method:"POST",headers:{authorization:`Bearer ${bearer}`,"content-type":"application/json","idempotency-key":key},body:JSON.stringify(body)});}
beforeAll(async()=>{
 mf=new Miniflare({modulesRoot:resolve("dist/server"),modules:[{type:"ESModule",path:resolve("dist/server/index.js")},...readdirSync("dist/server",{recursive:true}).filter((file):file is string=>typeof file==="string"&&file.endsWith(".js")&&file!=="index.js").map(file=>({type:"ESModule" as const,path:resolve("dist/server",file)}))],compatibilityDate:"2026-05-22",compatibilityFlags:["nodejs_compat"],d1Databases:["DB"],bindings:{TECRID_DELIVERY_ENABLED:"true"},outboundService:async(request:Request)=>{network.push(request.url);return new Response(null,{status:202});}});env.DB=await mf.getD1Database("DB");
 for(const f of readdirSync("drizzle").filter(x=>x.endsWith(".sql")).sort())for(const s of readFileSync(`drizzle/${f}`,"utf8").split("--> statement-breakpoint").filter(x=>x.trim()))await env.DB.prepare(s).run();
 for(const user of [actor("registry-lab"),other]){await getDb().insert(organizations).values({id:user.userId,name:`SYNTHETIC ${user.userId}`,slug:user.userId,organizationType:"laboratory",ownerUserId:user.userId,ownerEmail:user.email,issuerCode:user===other?"SBXOTHER":"SBXLAB",issuerStatus:"pending"});await getDb().insert(organizationMembers).values({organizationId:user.userId,userId:user.userId,email:user.email,role:"owner"});}
 const pair=await crypto.subtle.generateKey("Ed25519",true,["sign","verify"]);privateKey=pair.privateKey;jwk=await crypto.subtle.exportKey("jwk",pair.publicKey);
 sandboxKey=await createSandboxApiKey(user,"Synthetic sandbox");otherKey=(await createSandboxApiKey(other,"Synthetic other")).plainTextKey;liveKey=(await createApiKey(user,"Synthetic production prefix",["read","credentials:write"])).plainTextKey;
},60000);
afterAll(async()=>{await mf?.dispose();});
it("enforces key tiers on the built API before any production write",async()=>{
 expect((await post("/api/v1/credentials",await signed())).status).toBe(403);
 expect((await mf.dispatchFetch("https://tecrid.com/api/v1/credentials",{headers:{authorization:`Bearer ${sandboxKey.plainTextKey}`}})).status).toBe(403);
 expect((await post("/api/sandbox/v1/credentials",await signed(),liveKey)).status).toBe(403);
 expect(await getDb().select().from(credentials)).toEqual([]);expect(await getDb().select().from(notificationOutbox)).toEqual([]);
});
it("canonicalizes and issues verified signed test records in separate storage, with concurrent retry safety",async()=>{
 const prepared=await post("/api/sandbox/v1/credentials/canonicalize",input);expect(prepared.status).toBe(200);expect((await prepared.json() as {canonicalPayload:string}).canonicalPayload).toBe(canonicalizeSandboxCredential(input).canonicalPayload);
 const body=await signed();const responses=await Promise.all([post("/api/sandbox/v1/credentials",body),post("/api/sandbox/v1/credentials",body)]);expect(responses.map(response=>response.status).sort()).toEqual([200,201]);
 const documents=await Promise.all(responses.map(response=>response.json() as Promise<{credential:{tecrid:string}}>));identifier=documents[0].credential.tecrid;expect(identifier).toMatch(/^SBX/);expect(documents[1].credential.tecrid).toBe(identifier);
 const fetched=await mf.dispatchFetch(`https://tecrid.com/api/sandbox/v1/credentials/${encodeURIComponent(identifier)}`,{headers:{authorization:`Bearer ${sandboxKey.plainTextKey}`}});expect(fetched.status).toBe(200);expect((await fetched.json() as {credential:unknown}).credential).toMatchObject({environment:"sandbox",productionAuthority:false,status:"sandbox_issued",issuer:{identityVerified:false,testKey:true}});
 expect(await getDb().select().from(sandboxRegistryCredentials)).toHaveLength(1);expect(await getDb().select().from(credentials)).toEqual([]);expect(await getDb().select().from(notificationOutbox)).toEqual([]);expect(network).toEqual([]);expect(await getCredential(identifier)).toBeNull();
 const publicRecord=await mf.dispatchFetch(`https://tecrid.com/api/v1/credentials/${encodeURIComponent(identifier)}`);expect(publicRecord.status).toBe(404);
});
it("rejects another laboratory, private keys, tampering, conflicts and revoked sandbox keys",async()=>{
 const denied=await mf.dispatchFetch(`https://tecrid.com/api/sandbox/v1/credentials/${encodeURIComponent(identifier)}`,{headers:{authorization:`Bearer ${otherKey}`}});expect(denied.status).toBe(404);
 const list=await mf.dispatchFetch("https://tecrid.com/api/sandbox/v1/credentials",{headers:{authorization:`Bearer ${otherKey}`}});expect((await list.json() as {credentials:unknown[]}).credentials).toEqual([]);
 const body=await signed();
 // Even a reviewed production key pair cannot promote a sandbox-domain signature.
 await getDb().update(organizations).set({issuerStatus:"verified",issuerKeyId:"sandbox-test-key",issuerKeyAlgorithm:"Ed25519",issuerKeyVerifiedAt:new Date().toISOString(),issuerPublicKeyJwk:JSON.stringify(jwk)}).where(eq(organizations.id,user.userId));
 const promotion=await post("/api/v1/credentials",await signed({...input,visibility:"public"}),liveKey,"forbidden-promotion");expect(promotion.status).toBe(403);expect(JSON.stringify(await promotion.json())).toContain("signature verification failed");
 expect((await post("/api/sandbox/v1/credentials",{...body,ingredientCode:"tampered"})).status).toBe(403);
 expect((await post("/api/sandbox/v1/credentials",{...body,proof:{...body.proof,publicKeyJwk:{...jwk,d:"FORBIDDEN-PRIVATE-KEY"}}})).status).toBe(400);
 expect((await post("/api/sandbox/v1/credentials",await signed({...input,sourceDocument:{...input.sourceDocument,sha256:"f".repeat(64)}}))).status).toBe(409);
 expect((await post("/api/sandbox/v1/credentials",body,sandboxKey.plainTextKey,"new-key-same-source")).status).toBe(200);
 await revokeSandboxApiKey(user,sandboxKey.id);expect((await post("/api/sandbox/v1/credentials",body)).status).toBe(403);
 expect(await getDb().select().from(credentials)).toEqual([]);expect(network).toEqual([]);
});
