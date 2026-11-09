import {env} from 'cloudflare:workers';
import {getEmailUser} from './email-auth';
import {sampleLabReference} from './sample-lab';
import {reportPermission,sourcePdfKey,transcriptKey,validateTranscript} from './test-report-permissions';
export const privateReportHeaders={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const failure=(error:string,status:number)=>Response.json({error},{status,headers:privateReportHeaders});
type Storage={DB?:D1Database;DOCUMENTS?:R2Bucket};
// Permissions and private documents are read from TECRID's own database and bucket.
export async function protectedTestReport(request:Request,identifier:string,kind:'card'|'results'|'pdf',storage:Storage=env as unknown as Storage){
 const report=sampleLabReference(identifier);if(!report)return failure('Unknown test report.',404);
 // Only the validated email session supplies identity. Ignore bearer keys and client identity headers.
 let user;try{user=await getEmailUser(request.headers);}catch{return failure('Unable to verify your session. Please sign in again.',401);}
 if(!user)return failure('Sign in with your work email to view this report.',401);
 if(!storage.DB||!storage.DOCUMENTS)return failure('Report access is temporarily unavailable.',503);
 try{
  const permission=await reportPermission(storage.DB,user,report.reportNumber);
  if(!(kind==='pdf'?permission.canReadPdf:permission.canReadCard))return failure('Kasandrinos approval is required for this report and scope.',403);
  await storage.DB.prepare('INSERT INTO audit_events (id,organization_id,actor_user_id,event_type,entity_type,entity_id,payload,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'org_test_kasandrinos',user.userId,'test_report.viewed','test_report',report.testIdentifier,JSON.stringify({kind}),new Date().toISOString()).run();
  if(kind==='pdf'){
   const object=await storage.DOCUMENTS.get(sourcePdfKey(report.sourceSha256));if(!object)return failure('The protected report is temporarily unavailable.',503);
   const bytes=await object.arrayBuffer();
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   if(digest!==report.sourceSha256)return failure('Report integrity check failed.',502);
   return new Response(bytes,{headers:{...privateReportHeaders,'Content-Type':'application/pdf','Content-Disposition':`inline; filename="Kasandrinos-TEST-${report.reportNumber}.pdf"`,'X-Report-SHA256':report.sourceSha256,'X-TECRID-Sandbox':'true'}});
  }
  const object=await storage.DOCUMENTS.get(transcriptKey(report.sourceSha256));if(!object)return failure('Results are not yet available.',503);
  let data;try{data=validateTranscript(await object.json(),report);}catch{return failure('Report integrity check failed.',502);}
  return Response.json(kind==='card'?{...data,card:{identifier:report.testIdentifier,controller:report.reportDetails.customer,laboratory:report.sourceIssuer,sample:report.sampleName,lot:report.lotNumber,assay:report.reportDetails.assay,method:report.reportDetails.method,receivedAt:report.reportDetails.receivedAt,testedAt:report.testedAt,releasedAt:report.releasedAt,sourceFilename:report.sourceFilename,sourceSha256:report.sourceSha256,approval:'Pending Light Labs approval and signature'}}:data,{headers:{...privateReportHeaders,'X-TECRID-Sandbox':'true'}});
 }catch{return failure('The protected report is temporarily unavailable. Please retry.',503);}
}
