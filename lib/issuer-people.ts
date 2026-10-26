import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, getRawDb } from "../db";
import { apiKeys, credentials, issuerPeople, organizations } from "../db/schema";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { getOrganizationForUser, isIcsAdmin, TecAuthorizationError, TecInputError } from "./tec";

const clean = (value: unknown, max = 160) => typeof value === "string" ? value.trim().slice(0,max) : "";
const id = (prefix: string) => prefix + crypto.randomUUID().replaceAll("-","");
type Lab = typeof organizations.$inferSelect;
export type IssuerAuthority = { person: typeof issuerPeople.$inferSelect; organization: Lab; apiKeyId: string | null };

// No public/provider callback can mark identity verified in this patch.
// A separately approved provider integration must establish that state.
export async function requireIssuerPerson(organizationId: string, userId: string | null, apiKeyId?: string | null): Promise<IssuerAuthority> {
 const db=getDb();
 const [organization]=await db.select().from(organizations).where(eq(organizations.id,organizationId)).limit(1);
 if(!organization || organization.organizationType!=="laboratory" || organization.issuerStatus!=="verified")
  throw new TecAuthorizationError("Only a currently verified laboratory can issue.");
 if(!userId?.startsWith("email:"))throw new TecAuthorizationError("A named, identity-verified laboratory person with a passkey is required.");
 const [person]=await db.select().from(issuerPeople).where(and(eq(issuerPeople.organizationId,organizationId),eq(issuerPeople.userId,userId))).limit(1);
 if(!person || person.status!=="active" || person.identityStatus!=="verified" || !person.identityVerifiedAt || !person.approvedAt)
  throw new TecAuthorizationError("Your laboratory membership and personal identity verification must be active before issuing.");
 const live=await db.get(sql`SELECT u.id FROM auth_user u JOIN organization_members m ON m.user_id=${userId} AND m.organization_id=${organizationId}
 WHERE u.id=${userId.slice(6)} AND u.email_verified=1 AND lower(u.email)=${person.email}
 AND EXISTS(SELECT 1 FROM auth_passkey p WHERE p.user_id=u.id)`);
 if(!live || !organization.verifiedEmailDomain || person.emailDomain!==organization.verifiedEmailDomain ||
    person.email.split("@")[1]!==organization.verifiedEmailDomain)
  throw new TecAuthorizationError("Use your verified laboratory-domain account and register your own device passkey.");
 if(apiKeyId){
  const [key]=await db.select().from(apiKeys).where(and(eq(apiKeys.id,apiKeyId),eq(apiKeys.organizationId,organizationId))).limit(1);
  if(!key || key.revokedAt || key.createdByUserId!==userId || key.issuerPersonId!==person.id)
   throw new TecAuthorizationError("This key is not bound to the active verified issuer person.");
 }
 return {person,organization,apiKeyId:apiKeyId??null};
}
async function verifiedAccount(user: ChatGPTUser) {
 if(!user.userId.startsWith("email:"))throw new TecAuthorizationError("Sign in with your confirmed work email.");
 const account=await getDb().get<{id:string;email:string;name:string}>(sql`SELECT id,email,name FROM auth_user WHERE id=${user.userId.slice(6)} AND email_verified=1 AND lower(email)=${user.email.toLowerCase()}`);
 if(!account)throw new TecAuthorizationError("Confirm your own work email first.");
 return account;
}
async function laboratory(code: unknown) {
 const [lab]=await getDb().select().from(organizations).where(eq(organizations.issuerCode,clean(code,80).toUpperCase())).limit(1);
 if(!lab || lab.organizationType!=="laboratory")throw new TecAuthorizationError("Laboratory not found.");
 return lab;
}
async function canManage(user: ChatGPTUser, lab: Lab) {
 const member=await getOrganizationForUser(user.userId);
 return lab.ownerUserId===user.userId || (member?.organization.id===lab.id && ["owner","admin"].includes(member.role));
}
export async function requestLabMembership(user: ChatGPTUser, code: unknown) {
 const account=await verifiedAccount(user);const lab=await laboratory(code);
 const email=account.email.toLowerCase();const domain=email.split("@")[1];
 if(lab.issuerStatus!=="verified" || !lab.verifiedEmailDomain || domain!==lab.verifiedEmailDomain)
  throw new TecAuthorizationError("Your confirmed email must be on this laboratory's verified domain.");
 const prior=await getDb().get(sql`SELECT id FROM issuer_people WHERE organization_id=${lab.id} AND user_id=${user.userId}`);
 if(prior)throw new TecInputError("A request already exists. Ask the laboratory administrator about its status.");
 const personId=id("person_");const at=new Date().toISOString();const db=getRawDb();
 await db.batch([
  db.prepare("INSERT INTO issuer_people(id,organization_id,user_id,email,email_domain,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)")
   .bind(personId,lab.id,user.userId,email,domain,account.name,at,at),
  db.prepare("INSERT INTO audit_events(id,organization_id,actor_user_id,event_type,entity_type,entity_id,payload,created_at) VALUES(?,?,?,'issuer_person.requested','issuer_person',?,?,?)")
   .bind(id("evt_"),lab.id,user.userId,personId,JSON.stringify({issuerPersonId:personId,identityStatus:"pending"}),at),
 ]);
 return {id:personId,status:"requested",identityStatus:"pending"};
}
export async function changeLabPerson(user: ChatGPTUser, code: unknown, personId: unknown, action: unknown, reasonValue: unknown) {
 await verifiedAccount(user);const lab=await laboratory(code);
 const admin=await canManage(user,lab);const ics=isIcsAdmin(user);
 const reason=clean(reasonValue,600);if(!reason)throw new TecInputError("A reason is required.");
 if(action==="suspend_lab"){
  if(!ics)throw new TecAuthorizationError("ICS administrator access required.");
  const at=new Date().toISOString();const db=getRawDb();
  await db.batch([
   db.prepare("UPDATE organizations SET issuer_status='suspended',updated_at=? WHERE id=?").bind(at,lab.id),
   db.prepare("UPDATE api_keys SET revoked_at=COALESCE(revoked_at,?) WHERE organization_id=?").bind(at,lab.id),
   db.prepare("INSERT INTO audit_events(id,organization_id,actor_user_id,event_type,entity_type,entity_id,payload,created_at) VALUES(?,?,?,'issuer.suspended','organization',?,?,?)").bind(id("evt_"),lab.id,user.userId,lab.id,JSON.stringify({reason}),at),
  ]);
  return {status:"suspended"};
 }
 if(!["approve","remove","suspend"].includes(String(action)))throw new TecInputError("Choose approve, remove, suspend, or suspend_lab.");
 if((action==="suspend"&&!ics)||(action!=="suspend"&&!admin))throw new TecAuthorizationError("Laboratory administrator access required; only ICS may suspend.");
 const [person]=await getDb().select().from(issuerPeople).where(and(eq(issuerPeople.id,clean(personId,80)),eq(issuerPeople.organizationId,lab.id))).limit(1);
 if(!person)throw new TecAuthorizationError("Person not found for this laboratory.");
 if(action==="approve" && person.status!=="requested")throw new TecInputError("Only a pending request can be approved. Offboarded people require ICS recovery.");
 const at=new Date().toISOString();const db=getRawDb();const statements=[];
 if(action==="approve"){
  const other=await db.prepare("SELECT organization_id FROM organization_members WHERE user_id=? AND organization_id<>?").bind(person.userId,lab.id).first();
  if(other)throw new TecInputError("This person belongs to another workspace. Resolve membership before approval.");
  statements.push(db.prepare("INSERT INTO organization_members(organization_id,user_id,email,role) SELECT ?,?,?,'member' WHERE NOT EXISTS(SELECT 1 FROM organization_members WHERE user_id=?)").bind(lab.id,person.userId,person.email,person.userId));
  statements.push(db.prepare("UPDATE issuer_people SET status='active',approved_by_user_id=?,approved_at=?,status_reason=?,updated_at=? WHERE id=? AND status='requested'").bind(user.userId,at,reason,at,person.id));
 }else{
  const status=action==="remove"?"removed":"suspended";const dateColumn=action==="remove"?"removed_at":"suspended_at";
  statements.push(db.prepare("UPDATE issuer_people SET status=?,"+dateColumn+"=?,status_reason=?,updated_at=? WHERE id=?").bind(status,at,reason,at,person.id));
  statements.push(db.prepare("UPDATE api_keys SET revoked_at=COALESCE(revoked_at,?) WHERE organization_id=? AND (issuer_person_id=? OR created_by_user_id=?)").bind(at,lab.id,person.id,person.userId));
 }
 statements.push(db.prepare("INSERT INTO audit_events(id,organization_id,actor_user_id,event_type,entity_type,entity_id,payload,created_at) VALUES(?,?,?,?, 'issuer_person',?,?,?)")
  .bind(id("evt_"),lab.id,user.userId,"issuer_person."+String(action),person.id,JSON.stringify({reason,issuerPersonId:person.id,identityStatus:person.identityStatus}),at));
 await db.batch(statements);
 return {id:person.id,status:action==="approve"?"active":action==="remove"?"removed":"suspended"};
}
export async function labTeamForUser(user: ChatGPTUser, code?: string) {
 await verifiedAccount(user);const membership=await getOrganizationForUser(user.userId);
 const lab=code?await laboratory(code):membership?.organization;
 const ownRequests=await getDb().select().from(issuerPeople).where(eq(issuerPeople.userId,user.userId));
 if(!lab || lab.organizationType!=="laboratory")return {lab:null,people:[],issuedRecords:[],ownRequests,canManage:false,isIcsAdmin:isIcsAdmin(user)};
 const manage=await canManage(user,lab);const ics=isIcsAdmin(user);
 if(!manage&&!ics&&membership?.organization.id!==lab.id)throw new TecAuthorizationError("Laboratory team access required.");
 const [people,issuedRecords]=await Promise.all([
  getDb().select().from(issuerPeople).where(eq(issuerPeople.organizationId,lab.id)),
  getDb().select({identifier:credentials.identifier,issuerPersonId:credentials.issuerPersonId,issuerDisplayName:credentials.issuerDisplayName,issuedAt:credentials.issuedAt,issuingApiKeyId:credentials.issuingApiKeyId})
   .from(credentials).where(and(eq(credentials.organizationId,lab.id),eq(credentials.publicRecord,true))).orderBy(desc(credentials.issuedAt)).limit(50),
 ]);
 return {lab:{name:lab.name,issuerCode:lab.issuerCode,status:lab.issuerStatus,verifiedEmailDomain:lab.verifiedEmailDomain},people,issuedRecords,ownRequests,canManage:manage,isIcsAdmin:ics};
}
