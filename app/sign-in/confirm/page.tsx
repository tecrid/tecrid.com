import {ConfirmSignIn} from './confirm-sign-in';
export const dynamic = 'force-dynamic';
export const metadata = {title:'Sign in to TECRID',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function ConfirmPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const query = await searchParams;
 const values: Record<string,string> = {};
 for (const key of ['token','callbackURL','newUserCallbackURL','errorCallbackURL']) {
  if (typeof query[key] === 'string') values[key] = query[key];
 }
 return <main className="product-page"><section className="email-auth-shell"><p className="section-kicker">TECRID</p><h1>Ready to sign in?</h1><p>Confirm below to open your workspace.</p><ConfirmSignIn values={values}/></section></main>;
}
