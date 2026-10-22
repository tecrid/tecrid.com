'use client';
import {useState} from 'react';
export function EmailSignInForm({returnTo,ready,hasError}:{returnTo:string;ready:boolean;hasError:boolean}){
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState(hasError?'This link is invalid, expired, or already used. Request a new link.':'');
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');try{
  const response=await fetch('/api/auth/sign-in/magic-link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim().toLowerCase(),callbackURL:returnTo,newUserCallbackURL:returnTo,errorCallbackURL:`/sign-in?return_to=${encodeURIComponent(returnTo)}`})});
  if(!response.ok)throw Error(response.status===429?'Too many attempts. Wait a minute before requesting another link.':'We could not send the sign-in link. Please try again shortly.');setSent(true);
 }catch(e){setError(e instanceof Error?e.message:'Unable to send the link.');}finally{setBusy(false);}}
 return <form onSubmit={submit} className="email-auth-form">{sent?<div role="status" className="email-auth-success"><strong>Check your work inbox.</strong><p>A sign-in link has been requested for {email}. It expires in 10 minutes and works once. Check spam if it does not arrive.</p></div>:null}<label htmlFor="work-email">Work email</label><input id="work-email" name="email" type="email" disabled={busy} autoComplete="email" required maxLength={254} value={email} onChange={e=>{setEmail(e.target.value);setSent(false);}} placeholder="you@your-laboratory.com"/><button type="submit" className="button-dark" disabled={!ready||busy}>{busy?'Sending…':sent?'Send a new link':'Email me a sign-in link →'}</button>{!ready?<p role="status">Work-email sign-in is temporarily unavailable. Please try again shortly.</p>:null}{error?<p role="alert" className="email-auth-error">{error}</p>:null}</form>;
}
