import type { ReactNode } from 'react';
import { Shell } from '../blue-atlas/shared';
export default function AdminLayout({children}: {children: ReactNode}) {
  return <Shell minimal className="atlas-workspace atlas-admin"><div className="admin-workspace-frame"><aside className="admin-workspace-sidebar"><a className="workspace-sidebar-brand" href="/dashboard"><img src="/icons/tecrid.svg" width="34" height="34" alt="" /><strong>TECRID</strong></a><p className="atlas-kicker">ICS administration</p><nav aria-label="Admin navigation"><a href="/dashboard">Workspace home</a><span>Review</span><a href="/admin/issuers">Issuer applications</a><a href="/admin/issuers/invite">Invite a lab</a><a href="/admin/reports">Report intake audit</a><a href="/admin/founding">Founding launches</a><span>Account</span><a href="/admin/security">Security</a></nav></aside><div className="dashboard-workspace-main">{children}</div></div></Shell>;
}
