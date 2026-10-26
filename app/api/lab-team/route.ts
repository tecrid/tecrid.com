import { getVerifiedEmailSession } from "../../../lib/email-auth";
import { changeLabPerson,labTeamForUser,requestLabMembership } from "../../../lib/issuer-people";
import { TecAuthorizationError,TecInputError } from "../../../lib/tec";
const headers={"Cache-Control":"private, no-store",Vary:"Cookie","X-Content-Type-Options":"nosniff"};
export async function GET(request:Request){
 const identity=await getVerifiedEmailSession(request.headers);
 if(!identity)return Response.json({error:"Sign in with your verified email."},{status:401,headers});
 try{return Response.json(await labTeamForUser(identity.user,new URL(request.url).searchParams.get("lab")||undefined),{headers});}
 catch(error){return failure(error);}
}
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Same-origin request required."},{status:403,headers});
 const identity=await getVerifiedEmailSession(request.headers);
 if(!identity)return Response.json({error:"Sign in with your verified email."},{status:401,headers});
 try{
  const body=await request.json() as Record<string,unknown>;
  const result=body.action==="request"?await requestLabMembership(identity.user,body.lab):
   await changeLabPerson(identity.user,body.lab,body.personId,body.action,body.reason);
  return Response.json(result,{headers});
 }catch(error){return failure(error);}
}
function failure(error:unknown){
 const known=error instanceof TecAuthorizationError||error instanceof TecInputError;
 return Response.json({error:known?error.message:"Laboratory team operation failed."},{status:known?error.status:500,headers});
}
