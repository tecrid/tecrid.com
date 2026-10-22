import {redirect} from 'next/navigation';
import {getChatGPTUser} from '../chatgpt-auth';
import {emailAuthReady} from '../../lib/email-auth';
import {safeReturnPath} from '../../lib/auth-return-path';
import {ProductNav,ProductFooter} from '../site-nav';
import {EmailSignInForm} from './sign-in-form';
export const dynamic='force-dynamic';
export const metadata={title:'Sign in with work email — TECRID',robots:{index:false,follow:false}};
export default async function SignIn({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams;const returnTo=safeReturnPath(query.return_to);
 if(await getChatGPTUser())redirect(returnTo);
 return <main className="product-page"><ProductNav compact/><section className="email-auth-shell"><p className="section-kicker">YOUR TECRID WORKSPACE</p><h1>Start with your<br/>work email.</h1><p>We’ll email you a secure sign-in link. No password is required.</p><EmailSignInForm returnTo={returnTo} ready={emailAuthReady()} hasError={!!query.error}/><p className="email-auth-note">New to TECRID? After signing in, choose Laboratory to create your workspace, publish your profile, and begin issuer review. Email verification does not approve a laboratory to issue credentials.</p><p className="fine"><a href="/privacy">How we handle your information</a></p></section><ProductFooter/></main>;
}
