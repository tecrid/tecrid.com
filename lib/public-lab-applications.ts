import {env} from 'cloudflare:workers';
import {OnboardingError, admit, clean, companyKey, contactEmail, queuePage} from './onboarding-common.js';
import {scopePdf} from './lab-signup-policy';
import {isIcsAdmin, reviewIssuerApplication} from './tec';
import type {ChatGPTUser} from '../app/chatgpt-auth';

export async function submitPublicLabApplication(form:FormData, ip:string) {
  const db=env.DB;
  await admit(db,'lab-ip',ip,5);
  const labName=clean(form.get('labName'),180,'laboratory name');
  const email=contactEmail(form.get('contactEmail'));
  const nameKey=companyKey(labName);
  const body=clean(form.get('accreditationBody'),180,'accreditation body');
  const number=clean(form.get('accreditationNumber'),120,'ISO/IEC 17025 accreditation number');
  const metals=clean(form.get('scopeMetals'),1800,'scope of metals');
  await admit(db,'lab-email',email,3);
  const existing=await db.prepare('SELECT id FROM lab_applications WHERE contact_email=? OR normalized_name=? LIMIT 1').bind(email,nameKey).first();
  if(existing)throw new OnboardingError('An application already exists for this email or laboratory.',409);
  const file=form.get('certificate');
  if(!(file instanceof File)||file.size>5*1024*1024)throw new OnboardingError('Upload an accreditation certificate PDF up to 5 MB.');
  let pdf;
  try {pdf=await scopePdf(file);}catch {throw new OnboardingError('Upload a valid accreditation certificate PDF up to 5 MB.');}
  const id='lab_'+crypto.randomUUID(),at=new Date().toISOString();
  const key=`lab-applications/${id}/certificate.pdf`;
  await env.DOCUMENTS.put(key,pdf.bytes,{httpMetadata:{contentType:'application/pdf'}});
  try {
    await db.prepare(`INSERT INTO lab_applications (id,lab_name,normalized_name,contact_email,accreditation_body,accreditation_number,scope_metals,certificate_key,certificate_filename,certificate_sha256,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,'PENDING',?)`).bind(id,labName,nameKey,email,body,number,metals,key,pdf.filename,pdf.sha256,at).run();
  } catch(error) {
    await env.DOCUMENTS.delete(key);
    if(/UNIQUE constraint/i.test(String(error)))throw new OnboardingError('An application already exists for this email or laboratory.',409);
    throw error;
  }
  // Intake creates no account, issuer, key, or issuing authority.
  return {id,status:'PENDING',productionAuthority:false,submittedAt:at};
}
type LabRow={id:string;lab_name:string;contact_email:string;accreditation_body:string;accreditation_number:string;scope_metals:string;status:string;certificate_key:string;created_at:string};
export async function labQueue(user:ChatGPTUser,search:URLSearchParams) {
  if(!isIcsAdmin(user))throw new OnboardingError('ICS administrator access required.',403);
  const page=await queuePage(env.DB,'lab_applications',search);
  return {...page,applications:page.applications.map(({certificate_key,...application}:LabRow)=>application)};
}
export async function reviewPublicLab(user:ChatGPTUser,id:string,decision:string,note:string) {
  if(!isIcsAdmin(user))throw new OnboardingError('ICS administrator access required.',403);
  if(!['approve','reject'].includes(decision))throw new OnboardingError('Choose approve or reject.');
  const reviewNote=clean(note,1200,'review note');
  const row=await env.DB.prepare("SELECT * FROM lab_applications WHERE id=? AND status='PENDING'").bind(id).first<{contact_email:string;lab_name:string;accreditation_body:string;accreditation_number:string}>();
  if(!row)throw new OnboardingError('Pending application not found.',404);
  if(user.email.toLowerCase()===row.contact_email)throw new OnboardingError('Applicants cannot approve their own application.',403);
  let issuerId:string|null=null,organizationId:string|null=null;
  if(decision==='approve'){
    // Use the existing verified-mailbox, accreditation, key-control, conformance,
    // and two-independent-reviewer decision. Public intake cannot bypass it.
    const issuer=await env.DB.prepare(`SELECT id,organization_id FROM issuer_applications WHERE lower(contact_email)=? AND lower(trim(legal_name))=lower(trim(?)) AND accreditation_number=? AND lower(accreditation_body)=lower(?) AND status IN ('submitted','approved') ORDER BY submitted_at DESC LIMIT 1`).bind(row.contact_email,row.lab_name,row.accreditation_number,row.accreditation_body).first<{id:string;organization_id:string;status?:string}>();
    if(!issuer)throw new OnboardingError('The laboratory must complete verified work-email and signing-key setup in its laboratory workspace before approval.',409);
    const approved=await env.DB.prepare(`SELECT a.id FROM issuer_applications a JOIN organizations o ON o.id=a.organization_id WHERE a.id=? AND a.status='approved' AND o.issuer_status='verified' AND o.issuer_key_verified_at IS NOT NULL AND o.issuer_key_id=a.key_id AND o.issuer_public_key_jwk=a.public_key_jwk AND a.reviewed_at IS NOT NULL`).bind(issuer.id).first();
    if(!approved)await reviewIssuerApplication(user,issuer.id,{decision:'approve',reviewNote});
    issuerId=issuer.id;organizationId=issuer.organization_id;
  }
  const status=decision==='approve'?'APPROVED':'REJECTED';
  const result=await env.DB.prepare("UPDATE lab_applications SET status=?,issuer_application_id=?,organization_id=?,reviewed_by=?,review_note=?,reviewed_at=? WHERE id=? AND status='PENDING'").bind(status,issuerId,organizationId,user.email.toLowerCase(),reviewNote,new Date().toISOString(),id).run();
  if(result.meta.changes!==1)throw new OnboardingError('Another administrator reviewed this application. Reload the queue.',409);
  return {id,status,organizationId,productionAuthority:decision==='approve'};
}
