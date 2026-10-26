import { getVerifiedEmailSession } from "../../../../../../lib/email-auth";
import { prepareIssuerDecision } from "../../../../../../lib/passkey-review";
import { TecAuthorizationError, TecInputError } from "../../../../../../lib/tec";
export const dynamic="force-dynamic";
export async function POST(request:Request,{params}:{params:Promise<{applicationId:string}>}){
 const headers={"Cache-Control":"private, no-store",Vary:"Cookie"};
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Same-origin request required."},{status:403,headers});
 const identity=await getVerifiedEmailSession(request.headers);
 if(!identity)return Response.json({error:"Sign in is required."},{status:401,headers});
 try{const {applicationId}=await params;const body=await request.text();if(body.length>8000)return Response.json({error:"Request too large."},{status:413,headers});return Response.json(await prepareIssuerDecision(identity.user,identity.session,applicationId,JSON.parse(body)),{headers});}
 catch(error){const known=error instanceof TecInputError||error instanceof TecAuthorizationError;return Response.json({error:known?error.message:"Could not prepare device confirmation."},{status:known?error.status:503,headers});}
}
