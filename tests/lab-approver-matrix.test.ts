import { syntheticReview } from "./support/passkey-fixtures";
// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { env } from "./support/cloudflare-env";
import { onboardOrganization, submitIssuerApplication, getOrganizationForUser, isIcsAdmin } from "../lib/tec";
import { createIssuerKeyChallenge, verifyIssuerKeyChallenge, reviewIssuerVerificationCheck } from "../lib/issuer-verification";
// Exactly four synthetic identities. No real approver address or config value.
const reviewers = ["a", "b", "c", "d"].map(id => ({userId:`email:synthetic-reviewer-${id}`,email:`synthetic-reviewer-${id}@ics.test`,displayName:`Synthetic reviewer ${id}`,fullName:null}));
const pairs = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]] as const;
const lookup = {registerUrl:"https://synthetic-register.test/FAKE",registerResult:"SYNTHETIC ISO/IEC 17025 identity, certificate and scope match",registerCheckedAt:"2026-01-01"};
let mf:Miniflare;
let sequence=0;
beforeAll(async()=>{
 mf=new Miniflare({modules:true,script:"export default {fetch(){return new Response('test')}}",compatibilityDate:"2026-05-22",d1Databases:["DB"],r2Buckets:["DOCUMENTS"]});
 env.DB=await mf.getD1Database("DB");env.DOCUMENTS=await mf.getR2Bucket("DOCUMENTS");
 for(const file of readdirSync("drizzle").filter(name=>name.endsWith(".sql")).sort())for(const sql of readFileSync(`drizzle/${file}`,"utf8").split("--> statement-breakpoint"))if(sql.trim())await env.DB.prepare(sql).run();
 env.ICS_ADMIN_EMAILS=reviewers.map(reviewer=>reviewer.email).join(",");
},60000);
afterAll(async()=>{await mf?.dispose()});
async function application(owner?:typeof reviewers[number]){
 const index=sequence++;
 const lab=owner??{userId:`email:synthetic-matrix-${index}`,email:`quality@matrix-${index}.test`,displayName:"Synthetic laboratory",fullName:null};
 await env.DB.prepare("INSERT OR IGNORE INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,0,0)").bind(lab.userId.slice(6),lab.displayName,lab.email).run();
 await onboardOrganization(lab,{name:`Synthetic Matrix Laboratory ${index}`,organizationType:"laboratory"});
 const key=await crypto.subtle.generateKey("Ed25519",true,["sign","verify"]);
 const app=await submitIssuerApplication(lab,{legalName:`Synthetic Matrix Laboratory ${index}`,laboratoryAddress:"Synthetic fixture only",laboratoryWebsite:`https://${lab.email.split("@")[1]}`,authorityRole:"Synthetic quality director",accreditationStatus:"accredited",accreditationBody:"SYNTHETIC body",accreditationNumber:"FAKE",accreditationUrl:lookup.registerUrl,scopeSummary:"Synthetic scope",methodFamilies:"Synthetic method",contactName:"Synthetic",contactEmail:lab.email,keyId:`synthetic-matrix-key-${index}`,publicKeyJwk:JSON.stringify(await crypto.subtle.exportKey("jwk",key.publicKey)),attested:true},new File(["%PDF-1.7 SYNTHETIC SCOPE"],"scope.pdf"));
 const challenge=await createIssuerKeyChallenge(lab);
 const signature=Buffer.from(await crypto.subtle.sign("Ed25519",key.privateKey,new TextEncoder().encode(challenge.canonicalPayload))).toString("base64url");
 await verifyIssuerKeyChallenge(lab,{challengeId:challenge.id,signature});
 return {app,lab,organization:(await getOrganizationForUser(lab.userId))!.organization};
}
async function manual(reviewer:typeof reviewers[number],applicationId:string){
 for(const checkType of ["identity","accreditation","scope"])await reviewIssuerVerificationCheck(reviewer,applicationId,{checkType,status:"passed",evidenceNote:"Synthetic independent identity, accreditation and scope review",...lookup});
}
it.each(pairs)("accepts independent reviewer pair %i and %i, refusing the same reviewer twice",async(a,b)=>{
 expect(reviewers).toHaveLength(4);
 const {app,organization}=await application();
 await manual(reviewers[a],app.id);
 await syntheticReview(reviewers[a],app.id,{decision:"approve",reviewNote:"First synthetic independent review"});
 await expect(syntheticReview(reviewers[a],app.id,{decision:"approve",reviewNote:"Same synthetic reviewer twice"})).rejects.toThrow("same person");
 expect((await getOrganizationForUser(organization.ownerUserId))!.organization.issuerStatus).toBe("application_submitted");
 await syntheticReview(reviewers[b],app.id,{decision:"approve",reviewNote:"Synthetic second independent review of identity, accreditation and scope"});
 expect((await getOrganizationForUser(organization.ownerUserId))!.organization.issuerStatus).toBe("verified");
 await expect(syntheticReview(reviewers[b],app.id,{decision:"approve",reviewNote:"Duplicate"})).rejects.toThrow("submitted");
 const audit=(await env.DB.prepare("SELECT actor_user_id FROM audit_events WHERE entity_id=? AND event_type='issuer.application_approved'").bind(app.id).all()).results;
 expect(audit).toHaveLength(1);expect(audit[0].actor_user_id).toBe(reviewers[b].userId);
 expect((await env.DB.prepare("SELECT id FROM organization_notifications WHERE entity_id=? AND event_type='issuer.application_approved'").bind(app.id).all()).results).toHaveLength(1);
});
it("refuses an applicant who is one of the configured four ICS approvers",async()=>{
 const {app}=await application(reviewers[0]);
 expect(isIcsAdmin(reviewers[0])).toBe(true);
 await expect(manual(reviewers[0],app.id)).rejects.toThrow("independent");
 await manual(reviewers[1],app.id);
 await expect(syntheticReview(reviewers[0],app.id,{decision:"approve",reviewNote:"Applicant is on the four-person list"})).rejects.toThrow("independent");
 expect((await env.DB.prepare("SELECT id FROM audit_events WHERE entity_id=? AND event_type='issuer.application_approved'").bind(app.id).all()).results).toHaveLength(0);
});
it("refuses a first reviewer who becomes associated with the lab before second signoff",async()=>{
 const {app,organization}=await application();
 await manual(reviewers[2],app.id);
 await syntheticReview(reviewers[2],app.id,{decision:"approve",reviewNote:"First independent review"});
 await env.DB.prepare("INSERT INTO organization_members(organization_id,user_id,email,role) VALUES(?,?,?,'member')").bind(organization.id,reviewers[2].userId,reviewers[2].email).run();
 await expect(syntheticReview(reviewers[3],app.id,{decision:"approve",reviewNote:"First reviewer now belongs to the applicant"})).rejects.toThrow("independent");
 expect((await getOrganizationForUser(organization.ownerUserId))!.organization.issuerStatus).toBe("application_submitted");
});
it("does not count a changed user ID or email casing as a second person, and fails closed with an empty roster",async()=>{
 const {app}=await application();await manual(reviewers[1],app.id);
 await expect(syntheticReview({...reviewers[1],userId:"email:another-session-id",email:reviewers[1].email.toUpperCase()},app.id,{decision:"approve",reviewNote:"Same normalized mailbox"})).rejects.toThrow();
 await expect(syntheticReview({...reviewers[2],userId:reviewers[1].userId},app.id,{decision:"approve",reviewNote:"Same user ID"})).rejects.toThrow();
 const configured=env.ICS_ADMIN_EMAILS;
 env.ICS_ADMIN_EMAILS="";expect(isIcsAdmin(reviewers[0])).toBe(false);
 await expect(syntheticReview(reviewers[0],app.id,{decision:"approve",reviewNote:"Empty configured list"})).rejects.toThrow("approver");
 delete env.ICS_ADMIN_EMAILS;expect(isIcsAdmin(reviewers[0])).toBe(false);
 env.ICS_ADMIN_EMAILS=`  ${reviewers.map(reviewer=>reviewer.email.toUpperCase()).join(" , ")}  `;
 for(const reviewer of reviewers)expect(isIcsAdmin(reviewer)).toBe(true);
 env.ICS_ADMIN_EMAILS=configured;
});
