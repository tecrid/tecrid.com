import {privateFetch} from './private-fetch';
import {env} from 'cloudflare:workers';
import {getEmailUser} from './email-auth';
import {sampleLabReference} from './sample-lab';
export const privateReportHeaders={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const failure=(error:string,status:number)=>Response.json({error},{status,headers:privateReportHeaders});
export async function protectedTestReport(request:Request,identifier:string,kind:'card'|'results'|'pdf',transport:typeof fetch=privateFetch){
 const report=sampleLabReference(identifier);if(!report)return failure('Unknown test report.',404);
 // Only the validated email session supplies identity. Ignore bearer keys and client identity headers.
 let user;try{user=await getEmailUser(request.headers);}catch{return failure('Unable to verify your session. Please sign in again.',401);}
 if(!user)return failure('Sign in with your work email to view this report.',401);
 const secret=(env as any).TECRID_EMAIL_RELAY_SECRET;if(!secret)return failure('Report access is temporarily unavailable.',503);
 try{
  const response=await transport('https://vle.exchange/api/tecrid-report-access',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},body:JSON.stringify({reportNumber:report.reportNumber,kind,actor:{userId:user.userId,email:user.email,emailVerified:true}})});
  if(!response.ok)return failure(response.status===403?'Kasandrinos approval is required for this report and scope.':'The protected report is temporarily unavailable.',response.status===403?403:503);
  if(kind==='pdf'){
   if(!response.headers.get('content-type')?.includes('application/pdf')||response.headers.get('x-report-sha256')!==report.sourceSha256)return failure('Report integrity check failed.',502);
   return new Response(response.body,{headers:{...privateReportHeaders,'Content-Type':'application/pdf','Content-Disposition':`inline; filename="Kasandrinos-TEST-${report.reportNumber}.pdf"`,'X-Report-SHA256':report.sourceSha256,'X-TECRID-Sandbox':'true'}});
  }
  const data=await response.json();if(data.reportNumber!==report.reportNumber||data.sourceSha256!==report.sourceSha256||data.sandbox!==true||data.productionAuthority!==false||data.reviewStatus!=='UNAPPROVED_TRANSCRIPTION'||!Array.isArray(data.results))return failure('Report integrity check failed.',502);
  return Response.json(kind==='card'?{...data,card:{identifier:report.testIdentifier,controller:report.reportDetails.customer,laboratory:report.sourceIssuer,sample:report.sampleName,lot:report.lotNumber,assay:report.reportDetails.assay,method:report.reportDetails.method,receivedAt:report.reportDetails.receivedAt,testedAt:report.testedAt,releasedAt:report.releasedAt,sourceFilename:report.sourceFilename,sourceSha256:report.sourceSha256,approval:'Pending Light Labs approval and signature'}}:data,{headers:{...privateReportHeaders,'X-TECRID-Sandbox':'true'}});
 }catch{return failure('The protected report is temporarily unavailable. Please retry.',503);}
}
