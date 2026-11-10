'use client';
import {useState, type FormEvent} from 'react';
export function ConfirmSignIn({values}:{values:Record<string,string>}) {
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState('');
 async function submit(event:FormEvent) {
  event.preventDefault();
  if (busy) return;
  setBusy(true);setError('');
  try {
   const response = await fetch('/api/auth/magic-link/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(values)});
   const body = await response.json();
   if (!response.ok) throw new Error(body.error || 'Unable to sign in. Request a new link.');
   window.location.assign(body.url);
  } catch (cause) {setError(cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.');setBusy(false);}
 }
 return <form onSubmit={submit} className="email-auth-form"><button type="submit" className="button-dark" disabled={busy}>Sign in to TECRID</button>{error ? <p role="alert" className="email-auth-error">{error}</p> : null}</form>;
}
