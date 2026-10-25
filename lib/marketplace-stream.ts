import {and,asc,desc,eq,isNull} from "drizzle-orm";
import type {ChatGPTUser} from "../app/chatgpt-auth";
import {getDb} from "../db";
import {auditEvents,evidenceAccessGrants,evidenceDeliveries,marketplaceGrantSettings,marketplaceStreamEvents,marketplaceStreamJobs,marketplaceSupplierMappings,organizations,routingAuthorizations} from "../db/schema";
import {documentForGrant,standingAuthorizationMatches} from "./evidence-routing";
import {routingCode} from "./routing-codes";
import {grantDeliveryGate} from "./organization-access";
import {getCredential,isIcsAdmin,requireOrganizationAdmin,TecAuthorizationError,TecInputError} from "./tec";
import {sha256Hex} from "./issuance-safety";

const stamp=()=>new Date().toISOString();
const rawDb=()=>getDb().$client;
const id=(value:unknown)=>{if(typeof value!=="string"||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value))throw new TecInputError("An exact organization or grant ID is required.");return value;};
type Envelope={schemaVersion:"vle-evidence/1";environment:"production";streamId:string;eventId:string;deliveryId:string;sequence:number;event:string;occurredAt:string;operation:"upsert"|"tombstone";reason?:string;recipient:{type:"marketplace";organizationId:string};credential:Record<string,unknown>;grant:Record<string,unknown>;snapshot?:ReturnType<typeof documentForGrant>;snapshotFingerprint?:string};

// Only the reviewed operator path is implemented. A domain match, caller label
// or controller ID is never a cross-registry supplier mapping.
export async function reviewMarketplaceMapping(user:ChatGPTUser,input:Record<string,unknown>){
 if(!isIcsAdmin(user))throw new TecAuthorizationError("ICS operator review is required.");
 const supplierOrganizationId=id(input.supplierOrganizationId),recipientOrganizationId=id(input.recipientOrganizationId),externalSupplierId=id(input.externalSupplierId);
 const reviewNote=typeof input.reviewNote==="string"?input.reviewNote.trim():"";
 if(reviewNote.length<20||reviewNote.length>1000||typeof input.active!=="boolean")throw new TecInputError("A mapping decision and review evidence note are required.");
 const db=getDb(),[supplier]=await db.select().from(organizations).where(eq(organizations.id,supplierOrganizationId)).limit(1),[recipient]=await db.select().from(organizations).where(eq(organizations.id,recipientOrganizationId)).limit(1);
 if(!supplier||recipient?.organizationType!=="marketplace")throw new TecInputError("Both registry organizations must exist and the recipient must be a marketplace.");
 const [priorMapping]=await db.select().from(marketplaceSupplierMappings).where(and(eq(marketplaceSupplierMappings.supplierOrganizationId,supplierOrganizationId),eq(marketplaceSupplierMappings.recipientOrganizationId,recipientOrganizationId))).limit(1);
 if(priorMapping && priorMapping.externalSupplierId!==externalSupplierId)throw new TecInputError("A reviewed supplier mapping cannot silently change identity. Withdraw it and request a separate remapping review.");
 const reviewedAt=stamp(),mappingId=await sha256Hex(JSON.stringify([supplierOrganizationId,recipientOrganizationId]));
 await db.batch([
  db.insert(marketplaceSupplierMappings).values({id:mappingId,supplierOrganizationId,recipientOrganizationId,externalSupplierId,active:input.active,reviewedByUserId:user.userId,reviewNote,reviewedAt}).onConflictDoUpdate({target:marketplaceSupplierMappings.id,set:{externalSupplierId,active:input.active,reviewedByUserId:user.userId,reviewNote,reviewedAt}}),
  db.insert(auditEvents).values({id:crypto.randomUUID(),organizationId:supplierOrganizationId,actorUserId:user.userId,eventType:"marketplace.mapping_reviewed",entityType:"marketplace_mapping",entityId:mappingId,payload:JSON.stringify({recipientOrganizationId,externalSupplierId,active:input.active,reviewNote}),createdAt:reviewedAt}),
 ]);
 return {id:mappingId,reviewedAt};
}

export async function setMarketplaceGrantSettings(user:ChatGPTUser,grantId:string,input:Record<string,unknown>){
 const membership=await requireOrganizationAdmin(user),db=getDb();
 const [grant]=await db.select().from(evidenceAccessGrants).where(and(eq(evidenceAccessGrants.id,id(grantId)),eq(evidenceAccessGrants.controllerOrganizationId,membership.organization.id))).limit(1);
 const [recipient]=grant?await db.select().from(organizations).where(eq(organizations.id,grant.recipientOrganizationId)).limit(1):[];
 if(!grant||grant.status!=="active"||recipient?.organizationType!=="marketplace")throw new TecAuthorizationError("An active marketplace grant owned by this controller is required.");
 if(typeof input.publicStatus!=="boolean"||!Array.isArray(input.brandOrganizationIds)||input.brandOrganizationIds.length>100)throw new TecInputError("Explicit public and downstream consent fields are required.");
 const brandOrganizationIds=[...new Set(input.brandOrganizationIds.map(id))];
 if((input.publicStatus||brandOrganizationIds.length)&&membership.organization.organizationType!=="brand")throw new TecAuthorizationError("Only the controlling brand can authorize public or downstream proof.");
 const supersedesGrantId=input.supersedesGrantId==null?null:id(input.supersedesGrantId);
 if(supersedesGrantId){
  const [prior]=await db.select().from(evidenceAccessGrants).where(eq(evidenceAccessGrants.id,supersedesGrantId)).limit(1);
  if(!prior||prior.id===grant.id||prior.controllerOrganizationId!==grant.controllerOrganizationId||prior.recipientOrganizationId!==grant.recipientOrganizationId||prior.productSku!==grant.productSku)throw new TecInputError("A replacement must name a different grant for the same controller, recipient and SKU.");
  if(prior.createdAt>grant.createdAt)throw new TecInputError("A replacement must refer to an earlier grant.");
  const visited=new Set([grant.id]);let predecessor:string|null=supersedesGrantId;
  while(predecessor){if(visited.has(predecessor)||visited.size>100)throw new TecInputError("Replacement grants must not form a cycle.");visited.add(predecessor);const [link]=await db.select().from(marketplaceGrantSettings).where(eq(marketplaceGrantSettings.grantId,predecessor)).limit(1);predecessor=link?.supersedesGrantId??null;}
 }
 const [saved]=await db.select().from(marketplaceGrantSettings).where(eq(marketplaceGrantSettings.grantId,grant.id)).limit(1);
 if(saved?.supersedesGrantId&&saved.supersedesGrantId!==supersedesGrantId)throw new TecInputError("A recorded replacement identity cannot be changed.");
 const updatedAt=stamp(),values={grantId:grant.id,publicStatus:input.publicStatus,brandOrganizationIdsJson:JSON.stringify(brandOrganizationIds),supersedesGrantId,updatedByUserId:user.userId,updatedAt};
 await db.batch([db.insert(marketplaceGrantSettings).values(values).onConflictDoUpdate({target:marketplaceGrantSettings.grantId,set:values}),db.insert(auditEvents).values({id:crypto.randomUUID(),organizationId:grant.controllerOrganizationId,actorUserId:user.userId,eventType:"marketplace.grant_consent",entityType:"evidence_grant",entityId:grant.id,payload:JSON.stringify({publicStatus:input.publicStatus,brandOrganizationIds,supersedesGrantId}),createdAt:updatedAt})]);
 return {grantId:grant.id,updatedAt};
}

async function deliveryContext(deliveryId:string){
 const [row]=await getDb().select({delivery:evidenceDeliveries,grant:evidenceAccessGrants,authorization:routingAuthorizations,recipient:organizations}).from(evidenceDeliveries)
 .innerJoin(evidenceAccessGrants,eq(evidenceAccessGrants.id,evidenceDeliveries.grantId)).innerJoin(routingAuthorizations,eq(routingAuthorizations.id,evidenceDeliveries.routingAuthorizationId)).innerJoin(organizations,eq(organizations.id,evidenceDeliveries.recipientOrganizationId)).where(eq(evidenceDeliveries.id,deliveryId)).limit(1);
 if(!row||row.recipient.organizationType!=="marketplace")return null;
 const record=await getCredential(row.delivery.credentialIdentifier,true);
 const [settings]=await getDb().select().from(marketplaceGrantSettings).where(eq(marketplaceGrantSettings.grantId,row.grant.id)).limit(1);
 let subject:Record<string,unknown>|null=null;
 try{const signed=JSON.parse(record?.credential.signedPayload||"null");subject=signed?.type==="TestEvidenceCredentialRevision"?signed.credential:signed;}catch{/* Withhold incompatible signed identity. */}
 const supplier=subject?.signatureVersion==="tec-credential/3"&&typeof subject.originatingSupplier==="string"?subject.originatingSupplier:null;
 const [mapping]=supplier?await getDb().select().from(marketplaceSupplierMappings).where(and(eq(marketplaceSupplierMappings.supplierOrganizationId,supplier),eq(marketplaceSupplierMappings.recipientOrganizationId,row.recipient.id),eq(marketplaceSupplierMappings.active,true))).limit(1):[];
 let reason:string|null=null;
 if(!record||!record.integrity.issuerSignatureVerified||!record.integrity.fingerprintValid||!record.integrity.currentVersionConsistent)reason="credential_integrity_unavailable";
 else if(record.credential.status!=="issued")reason="credential_revoked";
 else if(!supplier)reason="signed_supplier_identity_required";
 else if(!mapping)reason="reviewed_supplier_mapping_required";
 else if(row.grant.status!=="active"||!(await grantDeliveryGate(row.grant)).ungated)reason="grant_or_recipient_withdrawn";
 else if(row.authorization.status!=="active"||(row.authorization.authorizationKind!=="standing"&&Date.parse(row.authorization.expiresAt)<=Date.now()))reason="routing_authority_withdrawn";
 else if(row.delivery.controllerOrganizationId!==row.grant.controllerOrganizationId||row.delivery.recipientOrganizationId!==row.grant.recipientOrganizationId||row.delivery.accessLevel!==row.grant.accessLevel||row.authorization.controllerOrganizationId!==row.grant.controllerOrganizationId||row.authorization.laboratoryOrganizationId!==record.credential.organizationId)reason="routing_scope_changed";
 else if(row.authorization.authorizationKind==="standing"&&!JSON.parse(row.authorization.grantIdsJson||"[]").includes(row.grant.id))reason="routing_scope_changed";
  else if(record && (routingCode(row.grant.productSku)!==routingCode(record.credential.productSku) || (row.authorization.authorizationKind==="standing"?!standingAuthorizationMatches(row.authorization,record.credential):row.authorization.productSku!==record.credential.productSku)))reason="routing_scope_changed";
 else if(!subject?.lotNumber&&!subject?.sourceDocument)reason="signed_lot_identity_required";
  // Replacement lineage remains authoritative after the replacement is revoked.
  const replacements=await getDb().select({id:marketplaceGrantSettings.grantId}).from(marketplaceGrantSettings).where(eq(marketplaceGrantSettings.supersedesGrantId,row.grant.id)).limit(1);
  if(replacements.length)reason="grant_superseded";
 return {...row,record,settings,mapping,subject,supplier,reason};
}

export async function processMarketplaceStreamJobs(limit=50){
 const db=getDb(),jobs=await db.select().from(marketplaceStreamJobs).where(isNull(marketplaceStreamJobs.processedAt)).orderBy(asc(marketplaceStreamJobs.id)).limit(limit);
 let appended=0;
 for(const job of jobs){
  const ctx=await deliveryContext(job.deliveryId);
  if(!ctx){await db.update(marketplaceStreamJobs).set({processedAt:stamp(),heldReason:"marketplace_delivery_required"}).where(eq(marketplaceStreamJobs.id,job.id));continue;}
  const streamId=await sha256Hex(JSON.stringify([ctx.delivery.credentialIdentifier,ctx.recipient.id]));
  const [prior]=await db.select().from(marketplaceStreamEvents).where(and(eq(marketplaceStreamEvents.streamId,streamId),eq(marketplaceStreamEvents.grantId,ctx.grant.id))).orderBy(desc(marketplaceStreamEvents.sequence)).limit(1);
  if(ctx.reason&&!prior){await db.update(marketplaceStreamJobs).set({processedAt:stamp(),heldReason:ctx.reason}).where(eq(marketplaceStreamJobs.id,job.id));continue;}
  const eventId=`vle:${crypto.randomUUID()}`,occurredAt=stamp();let body:Envelope;
  if(ctx.reason){
   const previous=JSON.parse(prior.bodyJson) as Envelope;
   body={...previous,eventId,deliveryId:eventId,sequence:0,event:ctx.reason==="credential_revoked"?"credential.revoked":"grant.revoked",occurredAt,operation:"tombstone",reason:ctx.reason,credential:{...previous.credential,verification:{signatureVerified:false,fingerprintVerified:false,currentVersion:false},...(ctx.reason==="credential_revoked"&&ctx.record?{version:ctx.record.credential.version,status:"revoked",fingerprint:ctx.record.credential.fingerprint}:{} )},grant:{...previous.grant,status:"revoked",publicStatus:false,brandOrganizationIds:[]}};
   delete body.snapshot;delete body.snapshotFingerprint;
  }else{
   const record=ctx.record!,snapshot=documentForGrant(record,ctx.grant);
   body={schemaVersion:"vle-evidence/1",environment:"production",streamId,eventId,deliveryId:eventId,sequence:0,event:record.credential.version===1?"credential.issued":"credential.corrected",occurredAt,operation:"upsert",recipient:{type:"marketplace",organizationId:ctx.recipient.id},credential:{tecrid:record.credential.identifier,version:record.credential.version,status:"active",program:"analytical-record",issuingLab:record.issuer.name,issuedAt:record.credential.issuedAt,retestDue:null,verificationUrl:`https://tecrid.com/records/${encodeURIComponent(record.credential.identifier)}`,fingerprint:record.credential.fingerprint,verification:{signatureVerified:true,fingerprintVerified:true,currentVersion:true},identity:{originatingSupplier:ctx.supplier,originatingSupplierId:ctx.mapping!.externalSupplierId,mappingId:ctx.mapping!.id,ingredientCode:record.credential.ingredientCode,productSku:record.credential.productSku,supplierLotId:record.credential.lotNumber}},grant:{id:ctx.grant.id,controllerOrganizationId:ctx.grant.controllerOrganizationId,recipientOrganizationId:ctx.recipient.id,status:"active",accessLevel:ctx.grant.accessLevel,publicStatus:ctx.settings?.publicStatus??false,brandOrganizationIds:JSON.parse(ctx.settings?.brandOrganizationIdsJson??"[]"),expiresAt:null,supersedesGrantId:ctx.settings?.supersedesGrantId??null},snapshot,snapshotFingerprint:await sha256Hex(JSON.stringify(snapshot))};
  }
 if(new TextEncoder().encode(JSON.stringify(body)).byteLength>65000){
  if(!prior){await db.update(marketplaceStreamJobs).set({processedAt:stamp(),heldReason:"marketplace_payload_too_large"}).where(eq(marketplaceStreamJobs.id,job.id));continue;}
  const previous=JSON.parse(prior.bodyJson) as Envelope;
  body={...previous,eventId,deliveryId:eventId,sequence:0,event:"grant.revoked",occurredAt,operation:"tombstone",reason:"marketplace_payload_too_large",credential:{...previous.credential,verification:{signatureVerified:false,fingerprintVerified:false,currentVersion:false}},grant:{...previous.grant,status:"revoked",publicStatus:false,brandOrganizationIds:[]}};delete body.snapshot;delete body.snapshotFingerprint;
 }
 const semantic={...body,eventId:null,deliveryId:null,sequence:0,occurredAt:null};const semanticHash=await sha256Hex(JSON.stringify(semantic)),createdAt=stamp();
  // Sequence allocation, immutable body and outbox receipt commit together. The
  // INSERT guard is inside the transaction, so concurrent workers cannot append
  // the same job or the same current state twice.
  await rawDb().batch([
   rawDb().prepare(`INSERT INTO marketplace_stream_events (id,job_id,stream_id,sequence,credential_identifier,recipient_organization_id,grant_id,delivery_id,operation,semantic_hash,body_json,created_at)
   SELECT ?,?,?,COALESCE((SELECT MAX(sequence) FROM marketplace_stream_events WHERE stream_id=?),0)+1,?,?,?,?,?,?,json_set(?,'$.sequence',COALESCE((SELECT MAX(sequence) FROM marketplace_stream_events WHERE stream_id=?),0)+1),?
   WHERE NOT EXISTS(SELECT 1 FROM marketplace_stream_events WHERE job_id=?) AND COALESCE((SELECT semantic_hash FROM marketplace_stream_events WHERE stream_id=? AND grant_id=? ORDER BY sequence DESC LIMIT 1),'')<>?`).bind(eventId,job.id,streamId,streamId,ctx.delivery.credentialIdentifier,ctx.recipient.id,ctx.grant.id,ctx.delivery.id,body.operation,semanticHash,JSON.stringify(body),streamId,createdAt,job.id,streamId,ctx.grant.id,semanticHash),
   rawDb().prepare(`INSERT OR IGNORE INTO notification_outbox(id,organization_id,event_type,product_sku,entity_id,action_path,occurred_at) SELECT id,recipient_organization_id,'marketplace.evidence',?,id,'/dashboard/evidence-routing',created_at FROM marketplace_stream_events WHERE id=?`).bind(ctx.record?.credential.productSku??null,eventId),
   rawDb().prepare("UPDATE marketplace_stream_jobs SET processed_at=?,held_reason=? WHERE id=?").bind(createdAt,body.operation==="tombstone"?body.reason??ctx.reason:ctx.reason,job.id),
  ]);
  if(await rawDb().prepare("SELECT id FROM marketplace_stream_events WHERE id=?").bind(eventId).first())appended++;
 }
 return {processed:jobs.length,appended};
}

export async function marketplaceEventGate(event:{id:string;entityId:string;organizationId:string},channelId:string){
 const [saved]=await getDb().select().from(marketplaceStreamEvents).where(and(eq(marketplaceStreamEvents.id,event.id),eq(marketplaceStreamEvents.id,event.entityId),eq(marketplaceStreamEvents.recipientOrganizationId,event.organizationId))).limit(1);
 if(!saved)return {mode:"cancel" as const,reason:"Marketplace stream event not found."};
 // Withdrawal outranks an unresponsive earlier delivery. A consumer's stream
 // watermark prevents delayed upserts from restoring any withdrawn payload.
 if(saved.operation==="tombstone")return {mode:"allow" as const,body:saved.bodyJson};
 if(saved.operation!=="tombstone"){
  const ctx=await deliveryContext(saved.deliveryId);const body=JSON.parse(saved.bodyJson) as Envelope;
  if(!ctx||ctx.reason||ctx.record?.credential.version!==body.credential.version)return {mode:"cancel" as const,reason:"Marketplace evidence is no longer current."};
  if(ctx.mapping?.id!==(body.credential.identity as {mappingId?:string})?.mappingId||ctx.mapping?.externalSupplierId!==(body.credential.identity as {originatingSupplierId?:string})?.originatingSupplierId||JSON.stringify(body.grant.brandOrganizationIds)!==(ctx.settings?.brandOrganizationIdsJson??"[]")||body.grant.publicStatus!==(ctx.settings?.publicStatus??false)||body.grant.supersedesGrantId!==(ctx.settings?.supersedesGrantId??null))return {mode:"cancel" as const,reason:"Marketplace mapping or consent changed."};
  if(!body.snapshot||await sha256Hex(JSON.stringify(documentForGrant(ctx.record!,ctx.grant)))!==body.snapshotFingerprint)return {mode:"cancel" as const,reason:"Marketplace disclosure scope changed."};
 }
 const earlier=await rawDb().prepare(`SELECT 1 FROM marketplace_stream_events e JOIN notification_deliveries d ON d.event_id=e.id WHERE e.stream_id=? AND e.sequence<? AND d.channel_id=? AND d.status NOT IN ('delivered','canceled') LIMIT 1`).bind(saved.streamId,saved.sequence,channelId).first();
 if(earlier)return {mode:"wait" as const,reason:"An earlier marketplace stream event is not acknowledged by this channel."};
 return {mode:"allow" as const,body:saved.bodyJson};
}

export async function marketplaceChannelFilter(event:{eventType:string;organizationId:string},kind:string){
 if(event.eventType==="marketplace.evidence")return kind==="webhook";
 if(kind!=="webhook"||(!event.eventType.startsWith("credential.")&&event.eventType!=="evidence_routing.delivered"))return true;
 const [organization]=await getDb().select({type:organizations.organizationType}).from(organizations).where(eq(organizations.id,event.organizationId)).limit(1);
 return organization?.type!=="marketplace";
}
