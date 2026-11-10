import { PublicPage } from "../blue-atlas/public-page";

export const dynamic='force-dynamic';
export const metadata={title:'Sign out | TECRID',robots:{index:false}};
export default function SignOut(){return <PublicPage><section className="atlas-email-auth-shell"><h1>Sign out of TECRID?</h1><form action="/api/email-signout" method="post"><button className="atlas-button" type="submit">Sign out</button></form><p><a href="/dashboard">Return to workspace</a></p></section></PublicPage>;}
