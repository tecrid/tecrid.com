"use client";
import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
export function PhoneReview({applicationId,keyComplete,initialLookup}:{applicationId:string;keyComplete:boolean;initialLookup:{registerUrl:string;registerResult:string;registerCheckedAt:string}}){
 const [identity,setIdentity]=useState(false),[accreditation,setAccreditation]=useState(false),[scope,setScope]=useState(false);
 const [lookup,setLookup]=useState(initialLookup),[reason,setReason]=useState(""),[alternative,setAlternative]=useState("needs_information");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function decide(decision:string){
  if(!reason.trim()){setMessage("Enter a decision reason before continuing.");return;}
  setBusy(true);setMessage("Confirm this decision with your device passkey.");
  const value={decision,reviewNote:reason,confirmations:{identity,accreditation,scope},...lookup};
  try{
   const endpoint=`/api/admin/issuer-applications/${encodeURIComponent(applicationId)}`;
   const challengeResponse=await fetch(`${endpoint}/step-up`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(value)});
   const challenge=await challengeResponse.json();if(!challengeResponse.ok)throw Error(challenge.error||"Could not prepare device confirmation.");
   const response=await startAuthentication({optionsJSON:challenge.options});
   const saved=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...value,stepUp:{id:challenge.id,response}})});
   const result=await saved.json();if(!saved.ok)throw Error(result.error||"The decision could not be recorded.");
   setMessage(result.review.status==="submitted"?"Your first approval is recorded. A different approver must confirm the second approval.":"Decision recorded.");
   location.assign("/admin/issuers");
  }catch(error){setMessage(error instanceof Error?error.message:"Device confirmation was cancelled. No decision was recorded.");}finally{setBusy(false);}
 }
 return <section className="phone-review-decision" aria-label="Your decision"><h2>Your three checks</h2><label className="phone-review-check"><input type="checkbox" checked={identity} onChange={event=>setIdentity(event.target.checked)}/><span>Identity and authority match the laboratory.</span></label><label className="phone-review-check"><input type="checkbox" checked={accreditation} onChange={event=>setAccreditation(event.target.checked)}/><span>ISO/IEC 17025 certificate is current in the public register.</span></label><label className="phone-review-check"><input type="checkbox" checked={scope} onChange={event=>setScope(event.target.checked)}/><span>The scope PDF covers the requested methods and scope.</span></label><label>Public register URL<input type="url" value={lookup.registerUrl} onChange={event=>setLookup({...lookup,registerUrl:event.target.value})}/></label><label>Register lookup result<textarea aria-label="Register lookup result" value={lookup.registerResult} onChange={event=>setLookup({...lookup,registerResult:event.target.value})}/></label><label>Register lookup date<input type="date" value={lookup.registerCheckedAt} onChange={event=>setLookup({...lookup,registerCheckedAt:event.target.value})}/></label><label>Decision reason<textarea aria-label="Decision reason" value={reason} onChange={event=>setReason(event.target.value)} required placeholder="What did you check? What needs to change?"/></label><label>If this lab needs changes<select value={alternative} onChange={event=>setAlternative(event.target.value)}><option value="needs_information">Request more information</option><option value="reject">Reject application</option></select></label><div className="phone-review-actions"><button className="button-dark" disabled={busy||!keyComplete||!identity||!accreditation||!scope} onClick={()=>decide("approve")}>{busy?"Waiting for device...":"Approve"}</button><button className="button-outline" disabled={busy} onClick={()=>decide(alternative)}>Request changes / Reject</button></div><p role="status" aria-live="polite">{message}</p><p>Both actions ask for a fresh device check. Signing in earlier does not authorize a decision.</p></section>;
}
