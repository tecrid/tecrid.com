"use client";
import {useState} from "react";
import {sampleLabReports,sampleLabReference} from "../../lib/sample-lab";

type Proof={testIdentifier:string;status:string;sandbox:true;productionAuthority:false;[key:string]:unknown};
export function SampleLabClient({signedIn,signInUrl}:{signedIn:boolean;signInUrl:string}){
 const [proofs,setProofs]=useState<Record<string,Proof>>({});
 const [message,setMessage]=useState("");const [pending,setPending]=useState(false);
 async function run(){
  setPending(true);setMessage("Generating a temporary sample signing key in this browser…");
  try{
   const key=await crypto.subtle.generateKey("Ed25519",false,["sign","verify"]);
   const publicKeyJwk=await crypto.subtle.exportKey("jwk",key.publicKey);
   for(const report of sampleLabReports){
    setMessage(`Testing report ${report.reportNumber}: prepare → sign → verify → save…`);
    const url=`/api/sandbox/lab/reports/${encodeURIComponent(report.testIdentifier)}`;
    const prepared=await fetch(url,{cache:"no-store"});const body=await prepared.json();
    if(!prepared.ok||!body.canonicalPayload)throw new Error(body.error||"Sign in to run your personal sample lab.");
    if(body.personalProof){setProofs(previous=>({...previous,[report.testIdentifier]:body.personalProof}));continue;}
    const bytes=new Uint8Array(await crypto.subtle.sign("Ed25519",key.privateKey,new TextEncoder().encode(body.canonicalPayload)));
    const signature=btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
    const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({publicKeyJwk,signature})});const result=await response.json();
    if(!response.ok)throw new Error(result.error||"Sample-lab signing failed.");
    setProofs(previous=>({...previous,[report.testIdentifier]:result}));
   }
   setMessage("All eight sample signatures verified and saved to your personal test workspace. No Light Labs credential was issued.");
  }catch(error){setMessage(error instanceof Error?error.message:"Sample-lab test failed.");}finally{setPending(false);}
 }
 function download(){
  const data={contractVersion:"tecrid-vle-sample-lab/1",sandbox:true,productionAuthority:false,displayRequirement:"Always show TEST identifier · Light Labs confirmation pending",reports:sampleLabReports.map(report=>({...sampleLabReference(report.testIdentifier),personalTestProof:proofs[report.testIdentifier]??null}))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="kasandrinos-vle-test-identifiers.json";a.click();URL.revokeObjectURL(url);
 }
 return <>
  <div className="sample-lab-actions">{signedIn?<button className="button-dark" disabled={pending} onClick={run}>{pending?"Testing…":"Run the eight-report API test"}</button>:<a className="button-dark" href={signInUrl}>Sign in to run the sample lab →</a>}<button className="button-light" onClick={download}>Download VLE test mapping</button></div>
  <p role="status" aria-live="polite">{message}</p>
  <div className="sample-lab-table"><table><caption>Kasandrinos source reports · integration identifiers</caption><thead><tr><th>Report / sample</th><th>Lot</th><th>Test identifier</th><th>Your API test</th></tr></thead><tbody>{sampleLabReports.map(report=><tr key={report.testIdentifier}><td><strong>{report.reportNumber}</strong><br/>{report.sampleName}<br/><small>Tested {report.testedAt}</small></td><td>{report.lotNumber}</td><td><a href={`/records/${encodeURIComponent(report.testIdentifier)}`}>{report.testIdentifier}</a><br/><small>TEST · confirmation pending</small></td><td>{proofs[report.testIdentifier]?"Sample signature verified":"Ready to test"}</td></tr>)}</tbody></table></div>
 </>;
}
