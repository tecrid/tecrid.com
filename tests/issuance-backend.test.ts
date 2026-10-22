// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { env } from "./support/cloudflare-env";
import { getDb } from "../db";
import { organizations, organizationMembers, reportReservations } from "../db/schema";
import { eq } from "drizzle-orm";
import { canonicalizeCredential, canonicalizeCredentialRevision, createCredentialRevision, createCredential, getCredential, publicCredentialDocument, createApiKey, authenticateApiRequest, submitIssuerApplication, reviewIssuerApplication } from "../lib/tec";
import { createIssuerKeyChallenge, verifyIssuerKeyChallenge, reviewIssuerVerificationCheck } from "../lib/issuer-verification";
import { reserveReportTecrid, finalizeReportTecrid } from "../lib/report-issuance";
import { createLegacyReport, claimLegacyReport, getLegacySigningPayload, issueLegacyReport, getLegacyReportForUser, getLegacyDocument } from "../lib/legacy-reports";
import { sampleLabReports, sampleLabCanonical, sampleLabReference, verifySampleLabProof } from "../lib/sample-lab";
import { issueSampleLabProof, getSampleLabProof } from "../lib/sample-lab-storage";
import { verifyDocument } from "../integration/light-labs/connector.mjs";
import { GET as versions } from "../app/api/v1/credentials/[identifier]/versions/route";

let mf: Miniflare;
let lab: typeof organizations.$inferSelect;
let privateKey: CryptoKey;
const user = {userId:"fixture-lab",email:"lab@example.test",displayName:"Fixture laboratory",fullName:"Fixture laboratory"};
const admin = {...user,userId:"fixture-admin",email:"admin@example.test"};
const brandUser = {...user,userId:"fixture-brand",email:"brand@example.test"};
const payload = {sampleName:"EXAMPLE historical oil",productSku:"EXAMPLE-01",lotNumber:"EXAMPLE-LOT",testedAt:"2025-01-02",releasedAt:"2025-01-03",publish:true,sourceDocument:{sha256:"a".repeat(64),filename:"example.pdf",reportNumber:"EXAMPLE-1"},results:[{analyte:"Lead",resultText:"ND",unit:"ppb",loqText:"5.12 ppb",numericValue:null},{analyte:"Example",resultText:"NR",unit:"ppb",loqText:"0 ppb",numericValue:null}]};
async function sign(text:string) {return {keyId:"fixture-key",algorithm:"Ed25519" as const,signature:Buffer.from(await crypto.subtle.sign("Ed25519",privateKey,new TextEncoder().encode(text))).toString("base64url")};}
beforeAll(async () => {
  mf = new Miniflare({modules:true,script:"export default {fetch(){return new Response('test')}}",compatibilityDate:"2026-05-22",d1Databases:["DB"],r2Buckets:["DOCUMENTS"]});
  env.DB=await mf.getD1Database("DB"); env.DOCUMENTS=await mf.getR2Bucket("DOCUMENTS");env.ICS_ADMIN_EMAILS=admin.email;
  for(const f of readdirSync("drizzle").filter(f=>f.endsWith(".sql")).sort()) for(const sql of readFileSync(`drizzle/${f}`,"utf8").split("--> statement-breakpoint").filter(s=>s.trim())) await env.DB.prepare(sql).run();
  for (const [id,type] of [[user.userId,"laboratory"],[brandUser.userId,"brand"]]) {
    await getDb().insert(organizations).values({id,name:id,slug:id,organizationType:type,ownerUserId:id,ownerEmail:`${id}@example.test`,issuerCode:id.toUpperCase().replaceAll("-", ""),issuerStatus:"pending"});
    await getDb().insert(organizationMembers).values({organizationId:id,userId:id,email:`${id}@example.test`,role:"owner"});
  }
  const pair = await crypto.subtle.generateKey("Ed25519",true,["sign","verify"]); privateKey=pair.privateKey;
  const app=await submitIssuerApplication(user,{legalName:"EXAMPLE test lab",laboratoryAddress:"Test only",laboratoryWebsite:"https://example.test",authorityRole:"Test owner",accreditationStatus:"not_accredited",scopeSummary:"Synthetic test oil only",methodFamilies:"Test method",contactName:"Fixture",contactEmail:user.email,keyId:"fixture-key",publicKeyJwk:JSON.stringify(await crypto.subtle.exportKey("jwk",pair.publicKey)),attested:true});
  await expect(reviewIssuerApplication(admin,app.id,{decision:"approve",reviewNote:"Test"})).rejects.toThrow();
  const challenge=await createIssuerKeyChallenge(user);
  await verifyIssuerKeyChallenge(user,{challengeId:challenge.id,signature:(await sign(challenge.canonicalPayload)).signature});
  await expect(verifyIssuerKeyChallenge(user,{challengeId:challenge.id,signature:(await sign(challenge.canonicalPayload)).signature})).rejects.toThrow();
  for(const checkType of ["identity","accreditation","scope"]) await reviewIssuerVerificationCheck(admin,app.id,{checkType,status:"passed",evidenceNote:"Synthetic isolated test; no real lab approval."});
  await reviewIssuerApplication(admin,app.id,{decision:"approve",reviewNote:"Synthetic isolated test"});
  [lab]=await getDb().select().from(organizations).where(eq(organizations.id,user.userId));
},60000);
afterAll(async()=>{await mf?.dispose()});

describe("isolated real backend with D1/R2 and Ed25519",()=>{
 it("denies unverified issuers and scoped-key writes",async()=>{
  await expect(reserveReportTecrid({...lab,issuerStatus:"pending"},{productName:"X",productSku:"X"})).rejects.toThrow();
  await expect(createCredential({...lab,issuerStatus:"pending"},null,payload)).rejects.toThrow();
  const key=await createApiKey(user,"read test",["read"]);
  await expect(authenticateApiRequest(new Request("https://example.test/api/v1/report-reservations",{method:"POST",headers:{authorization:`Bearer ${key.plainTextKey}`}}))).rejects.toThrow();
  await expect(authenticateApiRequest(new Request("https://example.test/api/v1/report-reservations",{headers:{authorization:`Bearer ${key.plainTextKey}`}}))).resolves.toBeTruthy();
 });
 it("reserves once, denies changed retries, verifies signatures, and recovers finalization",async()=>{
  const input={productName:payload.sampleName,productSku:payload.productSku,laboratoryReportNumber:"EXAMPLE-1",idempotencyKey:"test-job-1"};
  const a=await reserveReportTecrid(lab,input);const b=await reserveReportTecrid(lab,input);expect(a.id).toBe(b.id);
  await expect(reserveReportTecrid(lab,{...input,productSku:"different"})).rejects.toThrow();
  await expect(finalizeReportTecrid(lab,a.id,payload)).rejects.toThrow();
  const signed={...payload,proof:await sign(canonicalizeCredential(payload).canonicalPayload)};
  const first=await finalizeReportTecrid(lab,a.id,signed);expect(first.idempotent).toBe(false);
  expect((await finalizeReportTecrid(lab,a.id,signed)).idempotent).toBe(true);
  await expect(finalizeReportTecrid(lab,a.id,{...signed,lotNumber:"changed"})).rejects.toThrow();
  await getDb().update(reportReservations).set({status:"finalizing",finalizedCredentialIdentifier:null}).where(eq(reportReservations.id,a.id));
  expect((await finalizeReportTecrid(lab,a.id,signed)).idempotent).toBe(true);
  const record=await getCredential(a.tecrid);expect(record!.integrity.issuerSignatureVerified).toBe(true);expect(verifyDocument(publicCredentialDocument(record!)).signatureVerified).toBe(true);
  expect(record!.results.map(r=>r.resultText)).toEqual(["ND","NR"]);expect(record!.results.every(r=>r.numericValue===null)).toBe(true);
  expect(record!.credential.issuedAt).not.toBe(payload.testedAt);
  for(const action of ["correct","revoke"]) {
   const change={...payload,action,reason:"Synthetic revision check"};const canonical=await canonicalizeCredentialRevision(lab,a.tecrid,change);
   await createCredentialRevision(lab,null,a.tecrid,{...change,proof:await sign(canonical.canonicalPayload)});
  }
  const revoked=await getCredential(a.tecrid);expect(revoked!.credential.status).toBe("revoked");expect(revoked!.versions).toHaveLength(3);expect(revoked!.integrity.issuerSignatureVerified).toBe(true);
 });
 it("redacts controlled findings from resolver AND version history",async()=>{
  const input={...payload,visibility:"controlled" as const};const proof=await sign(canonicalizeCredential(input).canonicalPayload);
  await expect(createCredential(lab,null,{...input,proof})).rejects.toThrow();
  const made=await createCredential(lab,null,{...input,proof},{controlledRoutingAuthorized:true});
  const record=await getCredential(made.identifier);const document=publicCredentialDocument(record!);
  expect(document.results).toEqual([]);expect(document.integrity.issuerProof?.signedPayload).toBeNull();
  const response=await versions(new Request("https://example.test"),{params:Promise.resolve({identifier:made.identifier})});
  const body=await response.json();expect(body.versions[0].signedPayload).toBeNull();expect(body.versions[0].canonicalPayload).toBeNull();
 });
 it("preserves legacy PDF, locks out strangers, requires disclosure consent, and issues once",async()=>{
  const form=new FormData();form.set("document",new File(["%PDF-1.7 synthetic test only"],"original.pdf"));
  for(const [key,value] of Object.entries({laboratoryName:"Fixture lab",confirmationEmail:user.email,sampleName:payload.sampleName,reportNumber:"LEGACY-1",testedAt:payload.testedAt,results:JSON.stringify(payload.results),attested:"on"}))form.set(key,value);
  const made=await createLegacyReport(brandUser,form);
  await expect(createLegacyReport(brandUser,form)).rejects.toThrow(/already/);
  expect(await getLegacyReportForUser({...user,userId:"stranger"},made.id)).toBeNull();
  const original=await getLegacyDocument(brandUser,made.id);expect(await original!.object.text()).toBe("%PDF-1.7 synthetic test only");
  const token=made.confirmationPath.split("/").pop()!;
  await expect(claimLegacyReport({...user,email:"wrong@example.test"},token)).rejects.toThrow();
  await claimLegacyReport(user,token);const canonical=await getLegacySigningPayload(user,token);const proof=await sign(canonical.canonicalPayload);
  await expect(issueLegacyReport(user,token,proof)).rejects.toThrow(/publish/);
  const issued=await issueLegacyReport(user,token,proof,true);expect((await issueLegacyReport(user,token,proof,true)).tecrid).toBe(issued.tecrid);
  const record=await getCredential(issued.tecrid);expect(record!.credential.testedAt).toBe(payload.testedAt);expect(record!.credential.sourceDocumentHash).toBe(made.sourceSha256);
 });
});


describe("personal sample laboratory",()=>{
 it("links all eight reports to distinct non-production references without publishing results",()=>{
  expect(sampleLabReports).toHaveLength(8);expect(new Set(sampleLabReports.map(r=>r.testIdentifier)).size).toBe(8);
  for(const r of sampleLabReports){const ref=sampleLabReference(r.testIdentifier)!;expect(ref.productionAuthority).toBe(false);expect(ref.productionTecrid).toBeNull();expect(ref.results).toEqual([]);expect(ref.status).toBe("test_reference");}
 });
 it("verifies, persists and replays test signatures while denying cross-account replay and private keys",async()=>{
  const r=sampleLabReports[0];const canonical=await sampleLabCanonical(user.userId,r.testIdentifier);
  const pair=await crypto.subtle.generateKey("Ed25519",true,["sign","verify"]);const jwk=await crypto.subtle.exportKey("jwk",pair.publicKey);
  const signature=Buffer.from(await crypto.subtle.sign("Ed25519",pair.privateKey,new TextEncoder().encode(canonical))).toString("base64url");
  const result=await issueSampleLabProof(user.userId,r.testIdentifier,{publicKeyJwk:jwk,signature});expect(result.status).toBe("test_signed");expect(result.productionAuthority).toBe(false);
  expect((await issueSampleLabProof(user.userId,r.testIdentifier,{publicKeyJwk:jwk,signature})).idempotent).toBe(true);
  expect(await getSampleLabProof("another-user",r.testIdentifier)).toBeNull();
  await expect(issueSampleLabProof("another-user",r.testIdentifier,{publicKeyJwk:jwk,signature})).rejects.toThrow();
  await expect(verifySampleLabProof(canonical,{...jwk,d:"never-upload-a-private-key"},signature)).rejects.toThrow(/private key/);
  expect(await getCredential(r.testIdentifier)).toBeNull();
 });
});
