import {ProductNav,ProductFooter} from '../site-nav';
export const dynamic='force-dynamic';
export const metadata={title:'Sign out — TECRID',robots:{index:false}};
export default function SignOut(){return <main className="product-page"><ProductNav compact/><section className="email-auth-shell"><h1>Sign out of TECRID?</h1><form action="/api/email-signout" method="post"><button className="button-dark" type="submit">Sign out</button></form><p><a href="/dashboard">Return to workspace</a></p></section><ProductFooter/></main>;}
