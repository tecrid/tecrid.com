import { PublicPage } from "../blue-atlas/public-page";
import { requireChatGPTUser } from '../chatgpt-auth';
import { NotificationCenter } from '../notification-center';
export const dynamic='force-dynamic';
export const metadata={title:'Your notifications, TECRID',robots:{index:false,follow:false}};
export default async function Notifications(){await requireChatGPTUser('/notifications');return <PublicPage><h1 style={{maxWidth:680,margin:'24px auto 0',padding:'0 16px',boxSizing:'border-box',fontSize:28}}>Notifications</h1><NotificationCenter/></PublicPage>;}
