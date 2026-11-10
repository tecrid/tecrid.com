import { redirect } from 'next/navigation';
import { getOrganizationForUser } from '../../../lib/tec';
import { requireChatGPTUser } from '../../chatgpt-auth';
import { listWorkspaceAccess } from '../../../lib/workspace-access';
import { AccessPanel } from './access-panel';
export const dynamic = 'force-dynamic';
export const metadata = {title:'Who can see my results | TECRID',robots:{index:false,follow:false}};
export default async function AccessPage() {
  const user = await requireChatGPTUser('/dashboard/access');
  const membership = await getOrganizationForUser(user.userId);
  if (!membership || !["brand","supplier"].includes(membership.organization.organizationType)) redirect("/dashboard");
  const data = await listWorkspaceAccess(user);
  return <div className="product-page app-page"><header className="app-heading"><p className="section-kicker">{data.organizationName}</p><h1>Who can see my results</h1><p>Review access and sharing permissions by organization.</p></header><AccessPanel organizations={data.organizations} history={data.history} canRevoke={data.canRevoke}/></div>;
}
