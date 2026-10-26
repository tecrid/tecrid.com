// @vitest-environment node
import {beforeAll,afterAll,it,expect} from "vitest";
import {Miniflare} from "miniflare";
import {readFileSync,readdirSync} from "node:fs";
import {getDb} from "../db";
import {env} from "./support/cloudflare-env";
import {approverInbox,waitingReviewMailStatements,deliverIssuerReviewMail} from "../lib/issuer-review-notices";
let mf:Miniflare;
const reviewers=["a","b","c","d"].map(id=>({userId:`email:notice-${id}`,email:`notice-${id}@ics.test`,displayName:"Synthetic reviewer",fullName:null}));
beforeAll(async()=>{
 mf=new Miniflare({modules:true,script:"export default{fetch(){return new Response('test')}}",compatibilityDate:"2026-05-22",d1Databases:["DB"]});env.DB=await mf.getD1Database("DB");env.ICS_ADMIN_EMAILS=reviewers.map(r=>r.email).join(",");
 for(const f of readdirSync("drizzle").filter(f=>f.endsWith(".sql")).sort())for(const sql of readFileSync(`drizzle/${f}`,"utf8").split("--> statement-breakpoint"))if(sql.trim())await env.DB.prepare(sql).run();
 await env.DB.prepare("INSERT INTO organizations(id,name,slug,organization_type,owner_user_id,owner_email,issuer_code,issuer_status) VALUES('notice-lab','Synthetic Laboratory','notice-lab','laboratory','synthetic-owner','quality@synthetic.test','SYNTHETIC','application_submitted')").run();
 await env.DB.prepare("INSERT INTO issuer_applications(id,organization_id,legal_name,laboratory_address,scope_summary,method_families,contact_name,contact_email) VALUES('notice-app','notice-lab','Synthetic Laboratory','Synthetic address','Synthetic scope','Synthetic method','Synthetic contact','quality@synthetic.test')").run();
 await getDb().batch(waitingReviewMailStatements("notice-app",new Date().toISOString()) as [ReturnType<typeof waitingReviewMailStatements>[number],...ReturnType<typeof waitingReviewMailStatements>]);
},60000);
afterAll(async()=>{await mf?.dispose()});
it("shows waiting notices only to independent current approvers, with personal read state",async()=>{
 const one=await approverInbox(reviewers[0]);expect(one).toHaveLength(1);expect(one[0].read).toBe(false);
 await approverInbox(reviewers[0],one[0].id);expect((await approverInbox(reviewers[0]))[0].read).toBe(true);expect((await approverInbox(reviewers[1]))[0].read).toBe(false);
 expect(await approverInbox({...reviewers[0],userId:"outsider",email:"outsider@synthetic.test"})).toHaveLength(0);
 await env.DB.prepare("INSERT INTO organization_members(organization_id,user_id,email,role) VALUES('notice-lab',?,?,'member')").bind(reviewers[3].userId,reviewers[3].email).run();
 expect(await approverInbox(reviewers[3])).toHaveLength(0);
});
it("queues four recipient-specific messages, stays off by default and sends through an intercepted adapter only once",async()=>{
 expect((await env.DB.prepare("SELECT id FROM issuer_review_mail").all()).results).toHaveLength(4);
 let calls=0;const fake:typeof fetch=async(_input,init)=>{calls++;const body=JSON.parse(String(init?.body));expect(body.subject).toBe("A laboratory is waiting for ICS review");expect(body.text).not.toContain("quality@");expect(new Headers(init?.headers).get("Idempotency-Key")).toBeTruthy();return Response.json({id:"synthetic-no-send"});};
 expect(await deliverIssuerReviewMail(fake)).toEqual({sent:0,enabled:false});expect(calls).toBe(0);
 env.TECRID_REVIEW_MAIL_ENABLED="true";env.TECRID_REVIEW_MAIL_URL="https://mail.synthetic.test/review";env.TECRID_REVIEW_MAIL_SECRET="synthetic-only-review-mail";
 const results=await Promise.all([deliverIssuerReviewMail(fake),deliverIssuerReviewMail(fake)]);expect(results.reduce((total,r)=>total+r.sent,0)).toBe(3);expect(calls).toBe(3);
 await deliverIssuerReviewMail(fake);expect(calls).toBe(3);
 expect((await env.DB.prepare("SELECT id FROM issuer_review_mail WHERE status='cancelled'").all()).results).toHaveLength(1);
});
it("retries a failed intercepted send with the same idempotency identity and cancels stale waiting mail",async()=>{
 await env.DB.prepare("UPDATE issuer_review_mail SET status='retry' WHERE recipient_email=?").bind(reviewers[0].email).run();
 const identities:string[]=[];let failures=0;
 const fake:typeof fetch=async(_input,init)=>{identities.push(new Headers(init?.headers).get("Idempotency-Key")!);return new Response(null,{status:failures++===0?503:200});};
 expect((await deliverIssuerReviewMail(fake)).sent).toBe(0);expect((await deliverIssuerReviewMail(fake)).sent).toBe(1);expect(identities[0]).toBe(identities[1]);
 await env.DB.prepare("UPDATE issuer_review_mail SET status='retry' WHERE recipient_email=?").bind(reviewers[1].email).run();await env.DB.prepare("UPDATE issuer_applications SET status='approved' WHERE id='notice-app'").run();
 const before=identities.length;await deliverIssuerReviewMail(fake);expect(identities).toHaveLength(before);
});
