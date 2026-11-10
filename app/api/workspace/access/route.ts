import { getChatGPTUser } from '../../../chatgpt-auth';
import { revokeWorkspaceAccess } from '../../../../lib/workspace-access';
import { rejectCrossOriginWrite } from '../../../../lib/request-security';
import { TecAuthorizationError, TecInputError } from '../../../../lib/tec';
export async function POST(request: Request) {
  const blocked = rejectCrossOriginWrite(request);
  if (blocked) return blocked;
  const user = await getChatGPTUser();
  if (!user) return Response.json({error:'Sign in is required.'},{status:401});
  try {
    const body = await request.json();
    if (body.confirm !== true || typeof body.recipientId !== 'string' || !body.recipientId || body.recipientId.length > 180) throw new TecInputError('Confirm the organization and access to revoke.');
    if (body.item && (typeof body.item.id !== 'string' || !['grant','share','routing'].includes(body.item.kind))) throw new TecInputError('Choose a valid access item.');
    return Response.json(await revokeWorkspaceAccess(user,body.recipientId,body.item));
  } catch (error) {
    const known = error instanceof TecAuthorizationError || error instanceof TecInputError;
    return Response.json({error:known?error.message:'Access could not be revoked. Refresh and try again.'},{status:known?error.status:500});
  }
}
