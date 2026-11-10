import { requireChatGPTUser } from '../../../chatgpt-auth';
import { listWorkspaceMembers } from '../../../../lib/workspace-members';
import { MembersPanel } from './members-panel';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Members | TECRID', robots: { index: false, follow: false } };
export default async function MembersPage() {
  const user = await requireChatGPTUser('/dashboard/settings/members');
  const data = await listWorkspaceMembers(user);
  return <div className="product-page app-page members-page"><header className="app-heading"><p className="section-kicker">{data.organization.name}</p><h1>Members</h1><p>Everyone who shares this workspace.</p></header>{data.inviteError ? <p role="alert">{data.inviteError}</p> : null}<MembersPanel people={data.people} pending={data.pending} canManage={data.canManage} laboratory={data.organization.organizationType === 'laboratory'} website={data.organization.website} /></div>;
}
