"use client";
import { useState } from "react";
import { passkeyAuth } from "../lib/passkey-client";
import { safeReturnPath } from "../lib/auth-return-path";
export function PasskeySignIn({returnTo}:{returnTo:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function signIn(){setBusy(true);setMessage("");try{const result=await passkeyAuth.signIn.passkey();if(result.error)throw Error("Passkey sign-in was not completed. You can use an email link below.");location.assign(safeReturnPath(returnTo));}catch(error){setMessage(error instanceof Error?error.message:"Passkeys are unavailable on this device. Use an email link.");}finally{setBusy(false);}}
 return <div className="passkey-sign-in"><button className="button-dark" onClick={signIn} disabled={busy}>{busy?"Checking your device...":"Use Face ID"}</button><p>Use your device passkey: Face ID, Touch ID, fingerprint or screen lock.</p>{message?<p role="alert">{message}</p>:null}</div>;
}
export function PasskeyEnrollment({hasPasskey=false}:{hasPasskey?:boolean}){
 const [busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[message,setMessage]=useState("");
 async function save(){setBusy(true);setMessage("");try{const result=await passkeyAuth.passkey.addPasskey({name:"TECRID device passkey",authenticatorAttachment:"platform"});if(result.error)throw Error("Open a fresh email sign-in link in this browser, then save your passkey. Your session alone cannot add one.");setSaved(true);setMessage("Passkey saved. Your device confirms future sign-ins and each approval.");}catch(error){setMessage(error instanceof Error?error.message:"Passkey setup was not completed. Use an email link to retry.");}finally{setBusy(false);}}
 return <section className="passkey-enrollment" aria-label="Device passkey"><h2>{saved?"Your passkey is saved.":hasPasskey?"Add another device passkey":"Save a passkey for next time"}</h2><p>After opening your email sign-in link, save a passkey on this device. If you lose your phone, use your email link and register a replacement. No SMS is used.</p><button className="button-dark" onClick={save} disabled={busy||saved}>{busy?"Waiting for your device...":"Save a passkey"}</button>{message?<p role="status">{message}</p>:null}</section>;
}
