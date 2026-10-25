import {getChatGPTUser} from '../../../../chatgpt-auth';
import {manageLegacyConfirmation,LegacyReportConflictError} from '../../../../../lib/legacy-reports';
import {TecAuthorizationError,TecInputError} from '../../../../../lib/tec';
import {boundedText} from '../../../../../lib/service-assertion.js';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','Referrer-Policy':'no-referrer'};
export async function POST(request:Request,{params}:{params:Promise<{reportId:string}>}){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Same-origin request required.'},{status:403,headers});
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in is required.'},{status:401,headers});
 try{const {reportId}=await params,body=JSON.parse(await boundedText(request,1000));return Response.json(await manageLegacyConfirmation(user,decodeURIComponent(reportId),body.action),{headers});}
 catch(error){const known=error instanceof TecAuthorizationError||error instanceof TecInputError||error instanceof LegacyReportConflictError;return Response.json({error:known?error.message:'Confirmation management failed.'},{status:known?error.status:500,headers});}
}
