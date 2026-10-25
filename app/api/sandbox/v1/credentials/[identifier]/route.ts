import { getSandboxCredential, sandboxRegistryPrincipal } from "../../../../../../lib/sandbox-registry";
import { TecAuthorizationError, TecInputError } from "../../../../../../lib/tec";
export async function GET(request:Request,{params}:{params:Promise<{identifier:string}>}) {
 try { const principal=await sandboxRegistryPrincipal(request); const {identifier}=await params; const credential=await getSandboxCredential(principal.organization.id,identifier); return Response.json(credential?{credential}:{error:"Sandbox credential not found."},{status:credential?200:404,headers:{"cache-control":"no-store"}}); }
 catch(error) { const known=error instanceof TecInputError || error instanceof TecAuthorizationError; return Response.json({error:known?error.message:"Sandbox credential unavailable."},{status:known?error.status:400}); }
}
