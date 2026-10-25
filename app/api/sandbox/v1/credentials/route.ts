import { issueSandboxCredential, listSandboxCredentials, sandboxRegistryPrincipal } from "../../../../../lib/sandbox-registry";
import { TecAuthorizationError, TecInputError } from "../../../../../lib/tec";
const headers = {"cache-control":"no-store"};
function failure(error:unknown) { const known=error instanceof TecInputError || error instanceof TecAuthorizationError; return Response.json({error:known?error.message:"Sandbox registry operation failed."},{status:known?error.status:400,headers}); }
export async function GET(request:Request) { try { const principal=await sandboxRegistryPrincipal(request); return Response.json({environment:"sandbox",credentials:await listSandboxCredentials(principal.organization.id)},{headers}); } catch(error) { return failure(error); } }
export async function POST(request:Request) { try { const principal=await sandboxRegistryPrincipal(request); const result=await issueSandboxCredential(principal,await request.json(),request.headers.get("idempotency-key")); return Response.json(result,{status:result.idempotent?200:201,headers}); } catch(error) { return failure(error); } }
