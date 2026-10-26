import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getEmailUser, emailAuthReady } from "../../../lib/email-auth";
import { PasskeyEnrollment } from "../../passkey-controls";
import { EmailSignInForm } from "../../sign-in/sign-in-form";
export const dynamic="force-dynamic";
export const metadata={title:"Your device passkeys",robots:{index:false,follow:false}};
export default async function PasskeyAccount(){
 const user=await getEmailUser(new Headers(await headers()));if(!user)redirect("/sign-in?return_to=/account/passkeys");
 return <main className="product-page phone-review-page"><a href="/dashboard">Home</a><h1>Your device passkeys</h1><PasskeyEnrollment/><details><summary>Need a fresh setup link or a replacement passkey?</summary><p>Request a new one-time email link. Open it on this device, then save your passkey above. Your current session stays separate from passkey-enrollment authorization.</p><EmailSignInForm returnTo="/account/passkeys" ready={emailAuthReady()} hasError={false}/></details></main>;
}
