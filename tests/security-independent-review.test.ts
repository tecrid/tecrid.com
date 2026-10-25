// @vitest-environment node
import {beforeAll,beforeEach,afterAll,expect,it} from 'vitest';
import {eq} from 'drizzle-orm';
import {env} from './support/cloudflare-env';
import {evidenceFixture,actor} from './support/evidence-fixture';
import {getDb} from '../db';
import {issuerApplications,issuerVerificationChecks,organizationMembers,organizations} from '../db/schema';
import {submitIssuerApplication,reviewIssuerApplication} from '../lib/tec';
import {reviewIssuerVerificationCheck} from '../lib/issuer-verification';
let f:Awaited<ReturnType<typeof evidenceFixture>>,applicationId:string;
const independent=actor('security-independent-reviewer'),member=actor('security-review-member');
beforeAll(async()=>{f=await evidenceFixture();env.ICS_ADMIN_EMAILS=[f.lab.email,independent.email,member.email].join(',');await getDb().update(organizations).set({issuerStatus:'pending'}).where(eq(organizations.id,f.lab.userId));await getDb().insert(organizationMembers).values({organizationId:f.lab.userId,userId:member.userId,email:member.email,role:'admin'});const app=await submitIssuerApplication(f.lab,{legalName:'Synthetic laboratory',laboratoryAddress:'Test only',laboratoryWebsite:'https://lab.security.test',authorityRole:'Owner',accreditationStatus:'not_accredited',scopeSummary:'Synthetic security fixture only',methodFamilies:'Synthetic',contactName:'Synthetic',contactEmail:f.lab.email,keyId:'security-fixture-key',publicKeyJwk:f.laboratory.issuerPublicKeyJwk,attested:true});applicationId=app.id;for(const checkType of ['identity','accreditation','scope','key_control','conformance'])await getDb().insert(issuerVerificationChecks).values({id:crypto.randomUUID(),applicationId,organizationId:f.lab.userId,checkType,status:'passed',evidenceNote:'Synthetic completed verification fixture',reviewedByUserId:independent.userId,reviewedByEmail:independent.email,reviewedAt:new Date().toISOString()});},60000);
afterAll(async()=>{await f?.mf.dispose();});
beforeEach(async()=>{await getDb().update(issuerVerificationChecks).set({reviewedByUserId:independent.userId,reviewedByEmail:independent.email}).where(eq(issuerVerificationChecks.applicationId,applicationId));await getDb().update(issuerApplications).set({status:'submitted'}).where(eq(issuerApplications.id,applicationId));await getDb().update(organizations).set({issuerStatus:'pending'}).where(eq(organizations.id,f.lab.userId));});
const denied=async(promise:Promise<unknown>)=>expect(await promise.then(()=>200,(e:{status:number})=>e.status)).toBe(403);
it('an ICS admin cannot record manual checks for its own lab application',async()=>{await denied(reviewIssuerVerificationCheck(f.lab,applicationId,{checkType:'identity',status:'passed',evidenceNote:'Synthetic self review attempt'}));});
it('the owner cannot self-approve even with all five gates already passed',async()=>{await denied(reviewIssuerApplication(f.lab,applicationId,{decision:'approve',reviewNote:'Synthetic self approval attempt'}));});
it('a current applicant-organization member cannot review it',async()=>{await denied(reviewIssuerApplication(member,applicationId,{decision:'approve',reviewNote:'Synthetic related reviewer attempt'}));});
it('a separate authorized reviewer can record checks and approve',async()=>{await reviewIssuerVerificationCheck(independent,applicationId,{checkType:'identity',status:'passed',evidenceNote:'Synthetic independent review'});expect((await reviewIssuerApplication(independent,applicationId,{decision:'approve',reviewNote:'Synthetic independent review'})).status).toBe('approved');});

it('an independent final reviewer cannot rely on self-authored manual checks',async()=>{await getDb().update(issuerVerificationChecks).set({reviewedByUserId:f.lab.userId,reviewedByEmail:f.lab.email}).where(eq(issuerVerificationChecks.applicationId,applicationId));await denied(reviewIssuerApplication(independent,applicationId,{decision:'approve',reviewNote:'Synthetic inherited self review'}));});
