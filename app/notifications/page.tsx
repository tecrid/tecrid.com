import { PublicPage, PageHero } from "../blue-atlas/public-page";
import { requireChatGPTUser } from '../chatgpt-auth';
import { NotificationCenter } from '../notification-center';
export const dynamic='force-dynamic';
export const metadata={title:'Your notifications, TECRID',robots:{index:false,follow:false}};
export default async function Notifications(){await requireChatGPTUser('/notifications');return <PublicPage><PageHero className="atlas-form-page-header"><div><p className="atlas-kicker">Your inbox</p><h1>Stay close to your evidence.</h1><p>New TECRIDs. Access requests. One place to review.</p></div></PageHero><NotificationCenter/></PublicPage>;}
