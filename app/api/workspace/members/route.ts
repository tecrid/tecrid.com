import { getChatGPTUser } from '../../../chatgpt-auth';
import { changeWorkspaceMember, inviteWorkspaceMember } from '../../../../lib/workspace-members';
import { rejectCrossOriginWrite } from '../../../../lib/request-security';
import { TecAuthorizationError, TecInputError } from '../../../../lib/tec';
export async function POST(request: Request) {
  const blocked = rejectCrossOriginWrite(request);
  if (blocked) return blocked;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  try {
    const body = await request.json();
    if (body.action === 'invite') return Response.json({ result: await inviteWorkspaceMember(user, body) });
    if (!['role','remove'].includes(body.action) || !Number.isSafeInteger(body.memberId) || body.confirm !== true) throw new TecInputError('Confirm the member change before continuing.');
    await changeWorkspaceMember(user, body.memberId, body.action, body.role);
    return Response.json({ ok: true });
  } catch (error) {
    const known = error instanceof TecInputError || error instanceof TecAuthorizationError;
    return Response.json({ error: known ? error.message : 'The member change could not be saved. Refresh and try again.' }, { status: known ? error.status : 500 });
  }
}
