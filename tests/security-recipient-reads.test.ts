// @vitest-environment node
import {afterAll,beforeAll,beforeEach,expect,it} from 'vitest';
import {eq} from 'drizzle-orm';
import {evidenceFixture} from './support/evidence-fixture';
import {getDb} from '../db';
import {credentials,deliveryPolicy,evidenceAccessGrants,evidenceDeliveries,organizations,routingAuthorizations} from '../db/schema';
import {listEvidenceDeliveriesForOrganization,listEvidenceRoutingForUser} from '../lib/evidence-routing';
import {getEvidenceInsightsForOrganization} from '../lib/insights';
import {createEvidenceShareCode,redeemEvidenceShareCode,listSharingForUser} from '../lib/sharing';
let f:Awaited<ReturnType<typeof evidenceFixture>>;
beforeAll(async()=>{f=await evidenceFixture();},60000);
afterAll(async()=>{await f?.mf.dispose();});
beforeEach(async()=>{await getDb().update(evidenceAccessGrants).set({status:'active'}).where(eq(evidenceAccessGrants.id,f.grantId));await getDb().update(routingAuthorizations).set({status:'active'}).where(eq(routingAuthorizations.id,f.authorization.id));await getDb().update(organizations).set({identityStatus:'verified'}).where(eq(organizations.id,f.recipient.userId));await getDb().update(deliveryPolicy).set({termsRequired:false}).where(eq(deliveryPolicy.id,'global'));});
async function assertHidden(){expect((await listEvidenceDeliveriesForOrganization(f.recipient.userId)).length).toBe(0);expect((await listEvidenceRoutingForUser(f.recipient)).deliveries.length).toBe(0);expect((await getEvidenceInsightsForOrganization(f.recipient.userId)).evidence.length).toBe(0);expect((await listEvidenceDeliveriesForOrganization(f.brand.userId)).length).toBe(1);expect((await getDb().select().from(evidenceDeliveries)).length).toBe(1);}
it('permits only the current named recipient and preserves controller audit',async()=>{expect((await listEvidenceDeliveriesForOrganization(f.recipient.userId)).length).toBe(1);expect((await listEvidenceDeliveriesForOrganization(f.other.userId)).length).toBe(0);});
it('removes API, dashboard and insight payloads after the exact grant is revoked',async()=>{await getDb().update(evidenceAccessGrants).set({status:'revoked'}).where(eq(evidenceAccessGrants.id,f.grantId));await assertHidden();});
it('removes prior payloads after recipient identity revocation',async()=>{await getDb().update(organizations).set({identityStatus:'revoked'}).where(eq(organizations.id,f.recipient.userId));await assertHidden();});
it('requires the current terms version on every read',async()=>{await getDb().update(deliveryPolicy).set({termsRequired:true,termsVersion:'new-version',termsUrl:'https://terms.security.test/current'}).where(eq(deliveryPolicy.id,'global'));await assertHidden();});
it('removes prior payloads after routing authorization withdrawal',async()=>{await getDb().update(routingAuthorizations).set({status:'revoked'}).where(eq(routingAuthorizations.id,f.authorization.id));await assertHidden();});
it('removes all recipient and share payloads when the underlying credential is withdrawn',async()=>{
 const share=await createEvidenceShareCode(f.brand,{recipientOrganizationCode:'SECRECIPIENT',label:'Synthetic',purpose:'Withdrawal test',scopeMode:'sku_set',scopeValues:['SEC-SKU'],accessLevel:'full_record'});
 const input={code:share.plainTextCode,recipientOrganizationCode:'SECRECIPIENT'};
 await redeemEvidenceShareCode(input,f.recipient);
 await getDb().update(credentials).set({status:'revoked'}).where(eq(credentials.identifier,f.credential.identifier));
 await assertHidden();
 expect(await redeemEvidenceShareCode(input,f.recipient).then(()=>200,(e:{status:number})=>e.status)).toBe(403);
 expect((await listSharingForUser(f.recipient)).redemptions.length).toBe(0);
 expect((await listSharingForUser(f.brand)).redemptions.length).toBe(1);
});
