"use client";
import { useState } from "react";
export function TeamAction({lab,personId,action,label}:{lab:string;personId?:string;action:string;label:string}){
 const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
 return <form className="team-action" onSubmit={async event=>{
  event.preventDefault();setBusy(true);setMessage("");
  const values=new FormData(event.currentTarget);
  try{
   const response=await fetch("/api/lab-team",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lab:lab||values.get("lab"),personId,action,reason:values.get("reason")})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to save.");
   window.location.reload();
  }catch(error){setMessage(error instanceof Error?error.message:"Unable to save.");}finally{setBusy(false);}
 }}>
 {action==="request"?<label>Laboratory code<input name="lab" defaultValue={lab} required maxLength={80}/></label>:<label>Reason<input name="reason" required maxLength={600}/></label>}
 <button type="submit" disabled={busy} style={{minHeight:44}}>{busy?"Saving…":label}</button><p role="status">{message}</p>
 </form>;
}
