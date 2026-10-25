// @vitest-environment node
import {afterAll,beforeAll,expect,it} from 'vitest';
import {eq} from 'drizzle-orm';
import {evidenceFixture,actor} from './support/evidence-fixture';
import {getDb} from '../db';
import {apiKeys,organizationMembers} from '../db/schema';
import {createApiKey,revokeApiKey} from '../lib/tec';
import {createEvidenceRequest,respondToEvidenceRequest,revokeEvidenceGrant,createRoutingAuthorization,revokeRoutingAuthorization} from '../lib/evidence-routing';
import {createEvidenceShareCode,revokeEvidenceShareCode} from '../lib/sharing';
let f:Awaited<ReturnType<typeof evidenceFixture>>,keyId:string,shareId:string;
beforeAll(async()=>{f=await evidenceFixture();keyId=(await createApiKey(f.brand,'Synthetic',['read'])).id;shareId=(await createEvidenceShareCode(f.brand,{recipientOrganizationCode:'SECRECIPIENT',label:'Synthetic',purpose:'Role test',scopeMode:'sku_set',scopeValues:['SEC-SKU'],accessLevel:'full_record'})).id;},60000);
afterAll(async()=>{await f?.mf.dispose();});
for(const role of ['member','viewer','editor','revoked'])it(`denies ${role} approval, routing, share and key mutations`,async()=>{
 const user=actor('security-'+role);await getDb().insert(organizationMembers).values({organizationId:f.brand.userId,userId:user.userId,email:user.email,role});
 const request=await createEvidenceRequest(f.recipient,{controllerOrganizationCode:'SECBRAND',programName:'Synthetic',purpose:'Role regression',productName:'Synthetic evidence',productSku:'ROLE-'+role.toUpperCase(),accessLevel:'full_record',deliveryMode:'future_sku'});
 const operations=[()=>respondToEvidenceRequest(user,request.id,{decision:'accept'}),()=>revokeEvidenceGrant(user,f.grantId),()=>createRoutingAuthorization(user,{laboratoryOrganizationCode:'SECLAB',productName:'Synthetic evidence',productSku:'SEC-SKU'}),()=>revokeRoutingAuthorization(user,f.authorization.id),()=>createEvidenceShareCode(user,{recipientOrganizationCode:'SECRECIPIENT',label:'Synthetic',purpose:'Role regression',scopeMode:'sku_set',scopeValues:['SEC-SKU'],accessLevel:'full_record'}),()=>revokeEvidenceShareCode(user,shareId),()=>createApiKey(user,'Synthetic',['read']),()=>revokeApiKey(user,keyId)];
 for(const operation of operations)expect(await operation().then(()=>200,(e:{status?:number})=>e.status??500)).toBe(403);
});
for(const role of ['owner','admin'])it(`allows ${role} to manage keys without exposing existing plaintext`,async()=>{
 const user=role==='owner'?f.brand:actor('security-admin');if(role==='admin')await getDb().insert(organizationMembers).values({organizationId:f.brand.userId,userId:user.userId,email:user.email,role});
 const key=await createApiKey(user,'Synthetic',['read']);expect(typeof key.plainTextKey).toBe('string');
 const [stored]=await getDb().select().from(apiKeys).where(eq(apiKeys.id,key.id));expect(stored.keyHash===key.plainTextKey).toBe(false);expect('plainTextKey' in stored).toBe(false);
 expect((await revokeApiKey(user,key.id)).id).toBe(key.id);
});
