import {getChatGPTUser} from '../../../chatgpt-auth';
import {requireAdminFactor} from '../../../../lib/admin-mfa';
import {labQueue} from '../../../../lib/public-lab-applications';
import {errorResponse,reply} from '../../../../lib/onboarding-common.js';
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return reply({error:'Sign in required.'},401);
 try{await requireAdminFactor(user,request);return reply(await labQueue(user,new URL(request.url).searchParams));}
 catch(error){if(error instanceof Error&&'status' in error)return reply({error:error.message},Number(error.status));return errorResponse(error);}
}
