// @vitest-environment node
import {beforeAll,afterAll,it,expect} from "vitest";
import {Miniflare} from "miniflare";
import {readdirSync,readFileSync} from "node:fs";
import {env} from "./support/cloudflare-env";
import {getDb} from "../db";
import {organizations} from "../db/schema";
import {eq} from "drizzle-orm";
import {requestLabMembership,changeLabPerson,requireIssuerPerson,labTeamForUser} from "../lib/issuer-people";
import {createApiKey,authenticateApiRequest,canonicalizeCredential,createCredential,getCredential,publicCredentialDocument,submitIssuerApplication,createCredentialRevision,canonicalizeCredentialRevision} from "../lib/tec";
import {syntheticReviewerSession} from "./support/passkey-fixtures";
import {POST as teamPost} from "../app/api/lab-team/route";
import type {ChatGPTUser} from "../app/chatgpt-auth";
let mf:Miniflare;let privateKey:CryptoKey;let lab:typeof organizations.$inferSelect;
const owner={userId:"email:people-owner",email:"owner@people.test",displayName:"Synthetic Lab Owner",fullName:"Synthetic Lab Owner"};
const ics={...owner,userId:"email:people-ics",email:"ics@synthetic.test"};
const input={sampleName:"Synthetic test only",publish:true,results:[{analyte:"Example",resultText:"ND",unit:"ppb"}]};
async function person(label:string,email=label+"@people.test"):Promise<ChatGPTUser>{
 const user={userId:"email:people-"+label,email,displayName:"Synthetic "+label,fullName:"Synthetic "+label};
 await syntheticReviewerSession(user);
 await env.DB.prepare("UPDATE auth_user SET name=? WHERE id=?").bind(user.displayName,user.userId.slice(6)).run();return user;
}
async function joined(label:string){
 const user=await person(label);const row=await requestLabMembership(user,lab.issuerCode);
 await changeLabPerson(owner,lab.issuerCode,row.id,"approve","Synthetic test approval");
 return {user,id:row.id};
}
async function verify(id:string){
 // Explicit synthetic identity-provider result in disposable D1. No product route can do this.
 await env.DB.prepare("UPDATE issuer_people SET identity_status='verified',identity_verified_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
}
async function signed(){return {...input,proof:{keyId:"people-key",algorithm:"Ed25519",signature:Buffer.from(await crypto.subtle.sign("Ed25519",privateKey,new TextEncoder().encode(canonicalizeCredential(input).canonicalPayload))).toString("base64url")}};}
beforeAll(async()=>{
 mf=new Miniflare({modules:true,script:"export default {fetch(){return new Response('test')}}",compatibilityDate:"2026-05-22",d1Databases:["DB"]});
 env.DB=await mf.getD1Database("DB");env.ICS_ADMIN_EMAILS=ics.email;
 for(const file of readdirSync("drizzle").filter(f=>f.endsWith(".sql")).sort())for(const stmt of readFileSync("drizzle/"+file,"utf8").split("--> statement-breakpoint"))if(stmt.trim())await env.DB.prepare(stmt).run();
 await syntheticReviewerSession(owner);await syntheticReviewerSession(ics);
 const pair=await crypto.subtle.generateKey("Ed25519",true,["sign","verify"]);privateKey=pair.privateKey;
 await getDb().insert(organizations).values({id:"people-lab",name:"Synthetic People Laboratory",slug:"synthetic-people-lab",organizationType:"laboratory",ownerUserId:owner.userId,ownerEmail:owner.email,issuerCode:"PEOPLE",issuerStatus:"verified",verifiedEmailDomain:"people.test",issuerKeyId:"people-key",issuerPublicKeyJwk:JSON.stringify(await crypto.subtle.exportKey("jwk",pair.publicKey)),issuerKeyVerifiedAt:new Date().toISOString(),issuerKeyAlgorithm:"Ed25519"});
 await env.DB.prepare("INSERT INTO organization_members(organization_id,user_id,email,role) VALUES('people-lab',?,?,'owner')").bind(owner.userId,owner.email).run();
 [lab]=await getDb().select().from(organizations).where(eq(organizations.id,"people-lab"));
},60000);
afterAll(async()=>{await mf?.dispose();});
it("requires a real verified session and explicit same-origin for team changes",async()=>{
 const foreign=await teamPost(new Request("https://tecrid.com/api/lab-team",{method:"POST",headers:{origin:"https://foreign.test","Content-Type":"application/json"},body:JSON.stringify({action:"suspend_lab",lab:"PEOPLE"})}));
 expect(foreign.status).toBe(403);expect(foreign.headers.get("cache-control")).toContain("no-store");
 const missing=await teamPost(new Request("https://tecrid.com/api/lab-team",{method:"POST"}));expect(missing.status).toBe(403);
 const forged=await teamPost(new Request("https://tecrid.com/api/lab-team",{method:"POST",headers:{origin:"https://tecrid.com","oai-authenticated-user-id":owner.userId,"oai-authenticated-user-email":owner.email}}));expect(forged.status).toBe(401);
});
it("rejects wrong-domain, unconfirmed, and spoofed-account requests; domain is pinned to reviewed identity",async()=>{
 const wrong=await person("wrong","wrong@elsewhere.test");
 await expect(requestLabMembership(wrong,lab.issuerCode)).rejects.toThrow("verified domain");
 const unconfirmed=await person("unconfirmed");await env.DB.prepare("UPDATE auth_user SET email_verified=0 WHERE id=?").bind(unconfirmed.userId.slice(6)).run();
 await expect(requestLabMembership(unconfirmed,lab.issuerCode)).rejects.toThrow("Confirm");
 await expect(requestLabMembership({...wrong,email:"wrong@people.test"},lab.issuerCode)).rejects.toThrow("Confirm");
 await env.DB.prepare("UPDATE organizations SET website='https://elsewhere.test' WHERE id='people-lab'").run();
 await expect(requestLabMembership(wrong,lab.issuerCode)).rejects.toThrow("verified domain");
});
it("requires owner approval AND own identity verification AND own passkey; no request can verify itself",async()=>{
 const {user,id}=await joined("pending");
 await expect(requireIssuerPerson(lab.id,user.userId)).rejects.toThrow("identity verification");
 await expect(createCredential(lab,user.userId,await signed())).rejects.toThrow("identity verification");
 await expect(createApiKey(user,"blocked",["credentials:write"])).rejects.toThrow("identity verification");
 await expect(changeLabPerson(user,lab.issuerCode,id,"approve","Self approval")).rejects.toThrow("administrator");
 await expect(changeLabPerson(owner,lab.issuerCode,id,"verify","No provider shortcut")).rejects.toThrow("Choose");
 await verify(id);await expect(requireIssuerPerson(lab.id,user.userId)).resolves.toBeTruthy();
 await env.DB.prepare("DELETE FROM auth_passkey WHERE user_id=?").bind(user.userId.slice(6)).run();
 await expect(requireIssuerPerson(lab.id,user.userId)).rejects.toThrow("passkey");
});
it("records immutable internal person/user/name/key/time and public stable id, including version actors",async()=>{
 const {user,id}=await joined("issuer");await verify(id);
 const key=await createApiKey(user,"Synthetic issuance",["credentials:write"]);
 const authenticated=await authenticateApiRequest(new Request("https://tecrid.com/api/v1/credentials",{method:"POST",headers:{authorization:"Bearer "+key.plainTextKey}}));
 expect(authenticated.key.issuerPersonId).toBe(id);
 const result=await createCredential(lab,user.userId,await signed(),{apiKeyId:key.id});
 const record=(await getCredential(result.identifier))!;
 expect(record.credential).toMatchObject({issuerPersonId:id,issuerUserId:user.userId,issuerDisplayName:user.displayName,issuingApiKeyId:key.id});
 expect(record.credential.issuedAt).toBeTruthy();
 const audit=await env.DB.prepare("SELECT * FROM audit_events WHERE entity_id=? AND event_type='credential.issued'").bind(result.identifier).first();
 expect(audit.actor_user_id).toBe(user.userId);expect(JSON.parse(audit.payload)).toMatchObject({issuerPersonId:id,issuingApiKeyId:key.id,laboratoryId:lab.id});
 const publicDocument=publicCredentialDocument(record);expect(publicDocument.issuer.personId).toBe(id);
 const publicText=JSON.stringify(publicDocument);for(const secret of [user.email,user.displayName,user.userId,key.id])expect(publicText).not.toContain(secret);
 const change={...input,action:"correct",reason:"Synthetic correction"};
 const canonical=await canonicalizeCredentialRevision(lab,result.identifier,change);
 const proof={keyId:"people-key",algorithm:"Ed25519",signature:Buffer.from(await crypto.subtle.sign("Ed25519",privateKey,new TextEncoder().encode(canonical.canonicalPayload))).toString("base64url")};
 await createCredentialRevision(lab,user.userId,result.identifier,{...change,proof},{apiKeyId:key.id});
 const version=await env.DB.prepare("SELECT issuer_person_id,issuer_user_id,issuing_api_key_id FROM credential_versions WHERE credential_identifier=? AND version=2").bind(result.identifier).first();
 expect(version).toMatchObject({issuer_person_id:id,issuer_user_id:user.userId,issuing_api_key_id:key.id});
 await changeLabPerson(owner,lab.issuerCode,id,"remove","Synthetic offboarding");
 await expect(authenticateApiRequest(new Request("https://tecrid.com/api/v1/credentials",{method:"POST",headers:{authorization:"Bearer "+key.plainTextKey}}))).rejects.toThrow("revoked");
 await expect(createCredential(lab,user.userId,await signed(),{apiKeyId:key.id})).rejects.toThrow();
 const past=(await getCredential(result.identifier))!;
 expect(past.credential.issuerPersonId).toBe(id);expect(past.integrity.issuerSignatureVerified).toBe(true);
 await expect(env.DB.prepare("UPDATE credentials SET issuer_person_id='changed' WHERE identifier=?").bind(result.identifier).run()).rejects.toThrow("immutable");
});
it("blocks unowned legacy write keys and stale authority at database commit; preserves private drafts",async()=>{
 const {user,id}=await joined("race");await verify(id);
 const key=await createApiKey(user,"Race key",["credentials:write"]);
 await env.DB.prepare("UPDATE api_keys SET issuer_person_id=NULL WHERE id=?").bind(key.id).run();
 await expect(authenticateApiRequest(new Request("https://tecrid.com/api/v1/credentials",{method:"POST",headers:{authorization:"Bearer "+key.plainTextKey}}))).rejects.toThrow("bound");
 const stale=await requireIssuerPerson(lab.id,user.userId);expect(stale.person.id).toBe(id);
 await env.DB.prepare("UPDATE issuer_people SET identity_status='failed' WHERE id=?").bind(id).run();
 const revoked=await env.DB.prepare("SELECT revoked_at FROM api_keys WHERE id=?").bind(key.id).first();expect(revoked.revoked_at).toBeTruthy();
 await expect(env.DB.prepare("INSERT INTO credentials(identifier,organization_id,status,sample_name,public_record,issuer_person_id,issuer_user_id,issuer_display_name) VALUES('SYNTHETIC-RACE','people-lab','issued','Synthetic',1,?,?,?)").bind(id,user.userId,user.displayName).run()).rejects.toThrow("verified issuer person");
 expect((await createCredential(lab,null,{...input,publish:false})).status).toBe("draft");
});
it("limits named roster to own lab or ICS; owner removes, ICS suspends and atomically revokes",async()=>{
 const {user,id}=await joined("suspended");await verify(id);const key=await createApiKey(user,"Suspend",["reports:write"]);
 const stranger=await person("stranger","stranger@elsewhere.test");
 await expect(labTeamForUser(stranger,lab.issuerCode)).rejects.toThrow("team access");
 expect((await labTeamForUser(ics,lab.issuerCode)).people.some(p=>p.id===id)).toBe(true);
 await expect(changeLabPerson(owner,lab.issuerCode,id,"suspend","No ICS role")).rejects.toThrow();
 await changeLabPerson(ics,lab.issuerCode,id,"suspend","Synthetic ICS suspension");
 expect((await env.DB.prepare("SELECT revoked_at FROM api_keys WHERE id=?").bind(key.id).first()).revoked_at).toBeTruthy();
 expect((await env.DB.prepare("SELECT event_type FROM audit_events WHERE entity_id=? AND event_type='issuer_person.suspend'").bind(id).first()).event_type).toBe("issuer_person.suspend");
});
it("rolls back person status and key revocation together when the audit insert fails",async()=>{
 const {user,id}=await joined("atomic");await verify(id);const key=await createApiKey(user,"Atomic key",["credentials:write"]);
 await env.DB.prepare("CREATE TRIGGER fail_offboard_audit BEFORE INSERT ON audit_events WHEN NEW.event_type='issuer_person.remove' BEGIN SELECT RAISE(ABORT,'Synthetic audit failure'); END").run();
 try{
  await expect(changeLabPerson(owner,lab.issuerCode,id,"remove","Synthetic failure")).rejects.toThrow("Synthetic audit failure");
  expect((await env.DB.prepare("SELECT status FROM issuer_people WHERE id=?").bind(id).first()).status).toBe("active");
  expect((await env.DB.prepare("SELECT revoked_at FROM api_keys WHERE id=?").bind(key.id).first()).revoked_at).toBeNull();
 }finally{await env.DB.prepare("DROP TRIGGER fail_offboard_audit").run();}
});
it("suspends the whole lab and revokes every key; fresh and stale lab objects cannot issue",async()=>{
 const {user,id}=await joined("lab-suspend");await verify(id);
 const key=await createApiKey(user,"Lab suspension",["credentials:write"]);const read=await createApiKey(user,"Read",["read"]);
 await expect(changeLabPerson(owner,lab.issuerCode,null,"suspend_lab","No ICS")).rejects.toThrow("ICS");
 await changeLabPerson(ics,lab.issuerCode,null,"suspend_lab","Synthetic full lab suspension");
 for(const k of [key,read])expect((await env.DB.prepare("SELECT revoked_at FROM api_keys WHERE id=?").bind(k.id).first()).revoked_at).toBeTruthy();
 await expect(createCredential(lab,user.userId,await signed())).rejects.toThrow("currently verified");
 await expect(submitIssuerApplication(owner,{})).rejects.toThrow("suspended");
 await expect(env.DB.prepare("UPDATE organizations SET issuer_status='application_submitted' WHERE id='people-lab'").run()).rejects.toThrow("cannot be cleared");

 expect((await env.DB.prepare("SELECT event_type FROM audit_events WHERE entity_id='people-lab' AND event_type='issuer.suspended'").first()).event_type).toBe("issuer.suspended");
});
