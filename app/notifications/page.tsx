import { requireChatGPTUser } from '../chatgpt-auth';
import { ProductNav, ProductFooter } from '../site-nav';
import { NotificationCenter } from '../notification-center';
export const dynamic='force-dynamic';
export const metadata={title:'Your notifications — TECRID',robots:{index:false,follow:false}};
export default async function Notifications(){await requireChatGPTUser('/notifications');return <main><ProductNav/><header className="form-page-header"><div><p className="section-kicker light">Your inbox</p><h1>Stay close to your evidence.</h1><p>New TECRIDs. Access requests. One place to review.</p></div></header><NotificationCenter/><ProductFooter/></main>;}
