import {Miniflare} from 'miniflare';
import {readFileSync,readdirSync} from 'node:fs';
import {eq} from 'drizzle-orm';
import {env} from './cloudflare-env';
import {syntheticSourceDocument} from './source-document';
import {getDb} from '../../db';
import {organizations,organizationMembers} from '../../db/schema';
import {canonicalizeCredential,createCredential} from '../../lib/tec';
import {createEvidenceRequest,respondToEvidenceRequest,createRoutingAuthorization,processStandingRoutingJobs} from '../../lib/evidence-routing';
export const actor=(id:string)=>({userId:id,email:`${id}@security.test`,displayName:id,fullName:null});
export async function evidenceFixture(){
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-05-22',d1Databases:['DB']});
 env.DB=await mf.getD1Database('DB');
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const s of readFileSync(`drizzle/${f}`,'utf8').split('--> statement-breakpoint'))if(s.trim())await env.DB.prepare(s).run();
 const brand=actor('security-brand'),recipient=actor('security-recipient'),other=actor('security-other'),lab=actor('security-lab');
 const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
 for(const [user,type,code] of [[brand,'brand','SECBRAND'],[recipient,'retailer','SECRECIPIENT'],[other,'retailer','SECOTHER'],[lab,'laboratory','SECLAB']] as const){
  await getDb().insert(organizations).values({id:user.userId,name:`Synthetic ${user.userId}`,slug:user.userId,organizationType:type,ownerUserId:user.userId,ownerEmail:user.email,issuerCode:code,issuerStatus:'verified',identityStatus:'verified',...(type==='laboratory'?{issuerKeyId:'security-fixture-key',issuerKeyAlgorithm:'Ed25519',issuerKeyVerifiedAt:new Date().toISOString(),issuerPublicKeyJwk:JSON.stringify(await crypto.subtle.exportKey('jwk',pair.publicKey))}:{})});
  await getDb().insert(organizationMembers).values({organizationId:user.userId,userId:user.userId,email:user.email,role:'owner'});
 }
 const request=await createEvidenceRequest(recipient,{controllerOrganizationCode:'SECBRAND',programName:'Synthetic',purpose:'Security regression',productName:'Synthetic evidence',productSku:'SEC-SKU',accessLevel:'full_record',deliveryMode:'future_sku'});
 const grantId=(await respondToEvidenceRequest(brand,request.id,{decision:'accept'})).grantId!;
 const authorization=await createRoutingAuthorization(brand,{authorizationKind:'standing',laboratoryOrganizationCode:'SECLAB',productName:'Synthetic evidence',productSku:'SEC-SKU',grantIds:[grantId]});
 const [laboratory]=await getDb().select().from(organizations).where(eq(organizations.id,lab.userId));
 const input={sampleName:'Synthetic evidence',productSku:'SEC-SKU',lotNumber:'SYNTHETIC-LOT',publish:true,visibility:'controlled',sourceDocument:syntheticSourceDocument(),results:[{analyte:'Synthetic analyte',resultText:'ND',unit:'test-unit'}]};
 const canonical=canonicalizeCredential(input).canonicalPayload;
 const proof={keyId:'security-fixture-key',algorithm:'Ed25519',signature:Buffer.from(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(canonical))).toString('base64url')};
 const credential=await createCredential(laboratory,null,{...input,proof});
 await processStandingRoutingJobs();
 return {mf,brand,recipient,other,lab,laboratory,grantId,authorization,credential};
}
