import {PublicPage} from "../../blue-atlas/public-page";
import {ConfirmSignIn} from './confirm-sign-in';
export const dynamic = 'force-dynamic';
export const metadata = {title:'Sign in to TECRID',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function ConfirmPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const query = await searchParams;
 const values: Record<string,string> = {};
 for (const key of ['token','callbackURL','newUserCallbackURL','errorCallbackURL']) {
  if (typeof query[key] === 'string') values[key] = query[key];
 }
 return <PublicPage minimal><section className="atlas-email-auth-shell"><p className="atlas-kicker">TECRID</p><h1>Ready to sign in?</h1><p>Confirm below to open your workspace.</p><ConfirmSignIn values={values}/></section></PublicPage>;
}
