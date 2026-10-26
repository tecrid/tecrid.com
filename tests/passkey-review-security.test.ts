// @vitest-environment node
import { beforeAll,afterAll,it,expect } from "vitest";
import { Miniflare } from "miniflare";
import { readdirSync,readFileSync } from "node:fs";
import { env } from "./support/cloudflare-env";
import { signedReviewerDecision,syntheticReview,syntheticReviewerSession } from "./support/passkey-fixtures";
import { reviewIssuerApplication } from "../lib/tec";
let mf:Miniflare;
const first={userId:"email:security-a",email:"security-a@ics.test",displayName:"Synthetic first",fullName:null};
const second={userId:"email:security-b",email:"security-b@ics.test",displayName:"Synthetic second",fullName:null};
let sequence=0;
beforeAll(async()=>{
 mf=new Miniflare({modules:true,script:"export default{fetch(){return new Response('test')}}",compatibilityDate:"2026-05-22",d1Databases:["DB"]});env.DB=await mf.getD1Database("DB");env.ICS_ADMIN_EMAILS=`${first.email},${second.email}`;
 for(const f of readdirSync("drizzle").filter(f=>f.endsWith(".sql")).sort())for(const sql of readFileSync(`drizzle/${f}`,"utf8").split("--> statement-breakpoint"))if(sql.trim())await env.DB.prepare(sql).run();
},60000);
afterAll(async()=>{await mf?.dispose()});
async function fixture(){const id=`synthetic-security-app-${sequence++}`,org=`org-${id}`;
 await env.DB.prepare("INSERT INTO organizations(id,name,slug,organization_type,owner_user_id,owner_email,issuer_code,issuer_status) VALUES(?,?,?,'laboratory',?,'quality@synthetic.test',?,'application_submitted')").bind(org,"Synthetic Laboratory",org,`owner-${id}`,id).run();
 await env.DB.prepare("INSERT INTO issuer_applications(id,organization_id,legal_name,laboratory_address,laboratory_website,scope_summary,method_families,contact_name,contact_email,public_key_jwk,key_id) VALUES(?,?,?,'Synthetic address','https://synthetic.test','Synthetic scope','Synthetic method','Synthetic contact','quality@synthetic.test','{}','synthetic-signing-key')").bind(id,org,"Synthetic Laboratory").run();
 await env.DB.prepare("INSERT INTO audit_events(id,organization_id,event_type,entity_type,entity_id,payload) VALUES(?,?,'issuer.application_submitted','issuer_application',?,'{\"signupVerificationVersion\":1}')").bind(`audit-${id}`,org,id).run();
 await env.DB.prepare("INSERT INTO issuer_application_documents(id,application_id,organization_id,document_type,object_key,filename,mime_type,size,sha256,uploaded_by_user_id) VALUES(?,?,?,'accreditation_scope','synthetic','scope.pdf','application/pdf',5,'synthetic','synthetic')").bind(`doc-${id}`,id,org).run();
 for(const type of ["key_control","conformance"])await env.DB.prepare("INSERT INTO issuer_verification_checks(id,application_id,organization_id,check_type,status) VALUES(?,?,?,?,'passed')").bind(`${id}-${type}`,id,org,type).run();
 return {id,org};}
const approve={decision:"approve",reviewNote:"Synthetic independent review"};
it("refuses a stolen valid session with no fresh assertion and a forged success flag",async()=>{
 const {id}=await fixture();const session=await syntheticReviewerSession(first);
 for(const extra of [{},{stepUpPassed:true},{stepUp:{id:"invented",response:{id:"invented"}}}])await expect(reviewIssuerApplication(first,id,{...approve,confirmations:{identity:true,accreditation:true,scope:true},registerUrl:"https://synthetic-register.test",registerResult:"Synthetic match",registerCheckedAt:"2026-01-01",...extra},session)).rejects.toThrow();
 expect((await env.DB.prepare("SELECT id FROM issuer_review_approvals WHERE application_id=?").bind(id).all()).results).toHaveLength(0);
});
it("requires user verification, exact origin, decision reason and session binding",async()=>{
 const {id}=await fixture();
 for(const options of [{verified:false},{origin:"https://attacker.test"}]){const p=await signedReviewerDecision(first,id,approve,options);await expect(reviewIssuerApplication(first,id,p.input,p.session)).rejects.toThrow("device verification");}
 const p=await signedReviewerDecision(first,id,approve);
 await expect(reviewIssuerApplication(first,id,{...p.input,reviewNote:"Changed after confirmation"},p.session)).rejects.toThrow("expired or changed");
 await expect(reviewIssuerApplication(first,id,p.input,{...p.session,id:"stolen-different-session"})).rejects.toThrow();
 await reviewIssuerApplication(first,id,p.input,p.session);
 await expect(reviewIssuerApplication(first,id,p.input,p.session)).rejects.toThrow();
});
it("rejects expired challenges, changed evidence and deleted credentials",async()=>{
 for(const mode of ["expired","evidence","credential"]){const {id}=await fixture();const p=await signedReviewerDecision(first,id,approve);
 if(mode==="expired")await env.DB.prepare("UPDATE issuer_decision_challenges SET expires_at='2000-01-01' WHERE id=?").bind(p.input.stepUp.id).run();
 if(mode==="evidence")await env.DB.prepare("UPDATE issuer_verification_checks SET evidence_note='Changed evidence' WHERE application_id=?").bind(id).run();
 if(mode==="credential")await env.DB.prepare("DELETE FROM auth_passkey WHERE user_id=?").bind(p.session.userId).run();
 await expect(reviewIssuerApplication(first,id,p.input,p.session)).rejects.toThrow();}
});
it("commits two simultaneous different approvals once, with fresh-passkey audit and one lab notice",async()=>{
 const {id}=await fixture();const a=await signedReviewerDecision(first,id,approve),b=await signedReviewerDecision(second,id,approve);
 const results=await Promise.all([reviewIssuerApplication(first,id,a.input,a.session),reviewIssuerApplication(second,id,b.input,b.session)]);
 expect(results.some(r=>r.status==="approved")).toBe(true);
 expect((await env.DB.prepare("SELECT status FROM issuer_applications WHERE id=?").bind(id).first()).status).toBe("approved");
 const audits=(await env.DB.prepare("SELECT payload FROM audit_events WHERE entity_id=? AND event_type IN ('issuer.application_approval_recorded','issuer.application_approved')").bind(id).all()).results;
 expect(audits).toHaveLength(2);for(const row of audits){const p=JSON.parse(row.payload);expect(p.passkeyUserVerified).toBe(true);expect(p.credentialId).toBeTruthy();expect(p.passkeyVerifiedAt).toBeTruthy();}
 expect((await env.DB.prepare("SELECT id FROM organization_notifications WHERE entity_id=? AND event_type='issuer.application_approved'").bind(id).all()).results).toHaveLength(1);
});
it("rolls back the passkey receipt, approval and notice on an audit failure",async()=>{
 const {id}=await fixture(),p=await signedReviewerDecision(first,id,approve);
 await env.DB.exec("CREATE TRIGGER synthetic_review_audit_outage BEFORE INSERT ON audit_events WHEN NEW.event_type='issuer.application_approval_recorded' BEGIN SELECT RAISE(ABORT,'synthetic audit outage'); END;");
 await expect(reviewIssuerApplication(first,id,p.input,p.session)).rejects.toThrow();
 for(const table of ["issuer_decision_receipts","issuer_review_approvals"])expect((await env.DB.prepare(`SELECT id FROM ${table} WHERE application_id=?`).bind(id).all()).results).toHaveLength(0);
 await env.DB.exec("DROP TRIGGER synthetic_review_audit_outage");
 await reviewIssuerApplication(first,id,p.input,p.session);
});
it.each(["needs_information","reject"])("requires a fresh passkey and a reason for %s, then notifies the lab exactly once",async decision=>{
 const {id}=await fixture();await expect(syntheticReview(first,id,{decision,reviewNote:""})).rejects.toThrow("reason");
 await syntheticReview(first,id,{decision,reviewNote:"Synthetic reason for this decision"});
 await expect(syntheticReview(first,id,{decision,reviewNote:"Repeated"})).rejects.toThrow();
 const status=decision==="reject"?"rejected":"needs_information";
 expect((await env.DB.prepare("SELECT id FROM organization_notifications WHERE entity_id=? AND event_type=?").bind(id,`issuer.application_${status}`).all()).results).toHaveLength(1);
});
