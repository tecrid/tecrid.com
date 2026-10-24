import {getChatGPTUser} from "../../../../../chatgpt-auth";
import {authenticateSandboxApiRequest} from "../../../../../../lib/sandbox";
import {sampleLabCanonical,sampleLabReference} from "../../../../../../lib/sample-lab";
import {getSampleLabProof,issueSampleLabProof} from "../../../../../../lib/sample-lab-storage";
import {rejectCrossOriginWrite} from "../../../../../../lib/request-security";
export const dynamic="force-dynamic";
const headers={"cache-control":"no-store"};
type Context={params:Promise<{identifier:string}>};
async function identity(request:Request) {
 if(request.headers.has("authorization")) {
  const authenticated=await authenticateSandboxApiRequest(request);
  if(!authenticated) throw new Error("Use a personal tec_sandbox_ key, never a production key.");
  return authenticated.session.userId;
 }
 return (await getChatGPTUser())?.userId ?? null;
}
export async function GET(request:Request,{params}:Context){
 const {identifier}=await params;const reference=sampleLabReference(identifier);
 if(!reference)return Response.json({error:"Unknown sample-lab identifier."},{status:404,headers});
 let userId;try{userId=await identity(request);}catch{return Response.json({error:"Invalid sandbox credentials."},{status:401,headers});}
 if(!userId)return Response.json({reference,canonicalPayload:null,personalProof:null,signInRequired:true},{headers});
 return Response.json({reference,canonicalPayload:await sampleLabCanonical(userId,identifier),personalProof:await getSampleLabProof(userId,identifier)},{headers});
}
export async function POST(request:Request,{params}:Context){
 const crossOrigin=rejectCrossOriginWrite(request);if(crossOrigin)return crossOrigin;
 let userId;try{userId=await identity(request);}catch{return Response.json({error:"Invalid sandbox credentials."},{status:401,headers});}
 if(!userId)return Response.json({error:"Sign in or supply a personal sandbox API key."},{status:401,headers});
 const {identifier}=await params;if(!sampleLabReference(identifier))return Response.json({error:"Unknown sample-lab identifier."},{status:404,headers});
 if(Number(request.headers.get("content-length"))>4096)return Response.json({error:"Proof too large."},{status:413,headers});
 try{
  const text=await request.text();if(text.length>4096)return Response.json({error:"Proof too large."},{status:413,headers});
  const body=JSON.parse(text);const result=await issueSampleLabProof(userId,identifier,body);
  return Response.json(result,{status:result.idempotent?200:201,headers});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Sample signing failed."},{status:400,headers});}
}
