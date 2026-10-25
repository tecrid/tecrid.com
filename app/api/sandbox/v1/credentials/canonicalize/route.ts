import { canonicalizeSandboxCredential, sandboxRegistryPrincipal } from "../../../../../../lib/sandbox-registry";
import { TecAuthorizationError, TecInputError } from "../../../../../../lib/tec";
export async function POST(request:Request) {
 try { await sandboxRegistryPrincipal(request); return Response.json(canonicalizeSandboxCredential(await request.json()),{headers:{"cache-control":"no-store"}}); }
 catch(error) { const known=error instanceof TecInputError || error instanceof TecAuthorizationError; return Response.json({error:known?error.message:"Sandbox canonicalization failed."},{status:known?error.status:400}); }
}
