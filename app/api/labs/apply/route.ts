import {env} from 'cloudflare:workers';
import {admit} from '../../../../lib/onboarding-common.js';
import {submitPublicLabApplication} from '../../../../lib/public-lab-applications';
import {boundedRequest,errorResponse,sameOrigin,reply} from '../../../../lib/onboarding-common.js';
export async function POST(request:Request){
 try{
  sameOrigin(request);
  if(!request.headers.get('content-type')?.startsWith('multipart/form-data'))return reply({error:'A certificate upload is required.'},415);
  await admit(env.DB,'lab-request-ip',request.headers.get('cf-connecting-ip')||'unknown',10);
  const bounded=await boundedRequest(request,5*1024*1024+65536);
  const application=await submitPublicLabApplication(await bounded.formData(),request.headers.get('cf-connecting-ip')||'unknown');
  return reply({application},201);
 }catch(error){return errorResponse(error);}
}
