import {and,eq} from 'drizzle-orm';
import {getDb} from '../db';
import {evidenceAccessGrants,evidenceDeliveries,routingAuthorizations} from '../db/schema';
import {grantDeliveryGate} from './organization-access';
import {getCredential} from './tec';
export async function currentEvidenceVersion(identifier:string,version:number){
 const record=await getCredential(identifier);
 return record && record.credential.status==='issued' && record.credential.version===version && record.integrity.issuerSignatureVerified && record.integrity.fingerprintValid && record.integrity.currentVersionConsistent ? record : null;
}
// Controller audit retention never supplies a recipient read capability.
export async function currentRecipientDelivery(id:string,recipientId:string){
 const [row]=await getDb().select({delivery:evidenceDeliveries,grant:evidenceAccessGrants,authorization:routingAuthorizations}).from(evidenceDeliveries)
  .innerJoin(evidenceAccessGrants,eq(evidenceDeliveries.grantId,evidenceAccessGrants.id))
  .innerJoin(routingAuthorizations,eq(evidenceDeliveries.routingAuthorizationId,routingAuthorizations.id))
  .where(and(eq(evidenceDeliveries.id,id),eq(evidenceDeliveries.recipientOrganizationId,recipientId))).limit(1);
 if(!row)return null;
 const {delivery,grant,authorization}=row;
 if(!(await grantDeliveryGate(grant)).ungated || authorization.status!=='active' || (authorization.authorizationKind!=='standing' && !(Date.parse(authorization.expiresAt)>Date.now())))return null;
 if(grant.controllerOrganizationId!==delivery.controllerOrganizationId || grant.recipientOrganizationId!==recipientId || grant.accessLevel!==delivery.accessLevel || authorization.controllerOrganizationId!==delivery.controllerOrganizationId)return null;
 if(authorization.authorizationKind==='standing' && !JSON.parse(authorization.grantIdsJson||'[]').includes(grant.id))return null;
 const record=await currentEvidenceVersion(delivery.credentialIdentifier,delivery.credentialVersion);
 if(!record || authorization.laboratoryOrganizationId!==record.credential.organizationId)return null;
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(delivery.snapshotJson))),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==delivery.snapshotFingerprint)return null;
 try{
  const snapshot=JSON.parse(delivery.snapshotJson);
  if(snapshot.tecrid!==delivery.credentialIdentifier || snapshot.version!==delivery.credentialVersion)return null;
  if(grant.accessLevel==='selected_analytes'){
   const allowed=new Set((JSON.parse(grant.analyteScopeJson||'[]') as string[]).map(a=>a.toLowerCase()));
   if((snapshot.results||[]).some((r:{analyte:string})=>!allowed.has(r.analyte.toLowerCase())))return null;
  }
 }catch{return null;}
 return {delivery,grant,record};
}
export async function visibleEvidenceDeliveries<T extends typeof evidenceDeliveries.$inferSelect>(rows:T[],organizationId:string):Promise<T[]>{
 const visible=await Promise.all(rows.map(async row=>row.controllerOrganizationId===organizationId || (row.recipientOrganizationId===organizationId && await currentRecipientDelivery(row.id,organizationId)) ? row : null));
 return visible.filter((row):row is T=>row!==null);
}
export async function currentShareEvidence(value:{evidence?:Array<{tecrid?:string;version?:number}>}){
 if(!Array.isArray(value.evidence)||!value.evidence.length)return false;
 for(const item of value.evidence)if(typeof item.tecrid!=='string'||typeof item.version!=='number'||!await currentEvidenceVersion(item.tecrid,item.version))return false;
 return true;
}
