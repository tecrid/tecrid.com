'use client';
import {useEffect,useState} from 'react';
type Row={analyte:string;resultText:string;unit:string;loqText:string;limitText:string;statusText:string;notes:string};
type Access={canReadResults:boolean;canReadPdf:boolean;canManage:boolean;status:string};
export function ProtectedResults({identifier,analytes}:{identifier:string;analytes:string[]}){
 const [state,setState]=useState<'loading'|'sign-in'|'denied'|'error'|'ready'>('loading');
 const [rows,setRows]=useState<Row[]>([]),[access,setAccess]=useState<Access|null>(null),[retry,setRetry]=useState(0),[requesting,setRequesting]=useState(false),[message,setMessage]=useState('');
 const base=`/api/test-reports/${encodeURIComponent(identifier)}`;
 useEffect(()=>{const controller=new AbortController();setRows([]);setAccess(null);setState('loading');
  async function load(){
   const response=await fetch(`${base}/results`,{cache:'no-store',credentials:'same-origin',signal:controller.signal});
   if(controller.signal.aborted)return;
   if(response.status===401){setState('sign-in');return;}
   const status=await fetch('/api/kasandrinos-test',{method:'POST',cache:'no-store',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'status',reportNumber:identifier.split('-').at(-2)}),signal:controller.signal});
   if(!status.ok)throw Error();const a=await status.json();if(controller.signal.aborted)return;setAccess(a);
   if(response.status===403){setState('denied');return;}if(!response.ok)throw Error();
   const data=await response.json();if(controller.signal.aborted)return;
   if(data.sandbox!==true||data.productionAuthority!==false||!Array.isArray(data.results))throw Error();setRows(data.results);setState('ready');
  }
  void load().catch(()=>{if(!controller.signal.aborted)setState('error');});
  const refresh=()=>setRetry(v=>v+1);window.addEventListener('focus',refresh);
  return()=>{controller.abort();window.removeEventListener('focus',refresh);};
 },[base,identifier,retry]);
 async function requestAccess(results:boolean,pdf:boolean){setRequesting(true);setMessage('');try{const r=await fetch('/api/kasandrinos-test',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'request',reportNumber:identifier.split('-').at(-2),results,pdf})});const j=await r.json();if(!r.ok)throw Error(j.error||'Request failed.');setMessage('Access requested. Kasandrinos can approve it in the TEST workspace.');setRetry(v=>v+1);}catch(e){setMessage(e instanceof Error?e.message:'Request failed.');}finally{setRequesting(false);}}
 return <section className="public-results kas-controlled-panel" aria-labelledby="report-panel-title">
  <div className="results-note"><h2 id="report-panel-title">Analytical panel</h2><span>TEST · Light Labs approval pending</span></div>
  <p>{state==='ready'?'Source-report transcription for testing. Light Labs has not approved or signed these TECRID results. Blank source fields are shown as “Not stated”; ND and NR are preserved without conversion to zero. Printed limits and status are source statements, not a TECRID safety assessment.':'Results and original PDFs require a verified email and Kasandrinos approval for this report and scope. No analytical values are included in the public page.'}</p>
  <div role="status" aria-live="polite">{state==='loading'?'Checking report access…':state==='denied'?'Kasandrinos approval is required to view these results.':state==='error'?'The protected report could not be loaded. Please retry.':state==='ready'?'Authorized access · TEST results loaded.':'Sign in to view the actual results here.'}</div>
  <div className="kas-panel-scroll"><table><thead><tr><th>Analyte</th>{state==='ready'?<><th>Result as reported</th><th>LOQ</th><th>Printed limit</th><th>Printed status</th></>:<><th>Result / LOQ / specification</th><th>TECRID confirmation</th></>}</tr></thead><tbody>{state==='ready'?rows.map((row,index)=><tr key={`${row.analyte}-${index}`}><td><strong>{row.analyte}</strong>{row.notes?<small className="kas-result-note">{row.notes}</small>:null}</td><td>{row.resultText}{row.unit?` ${row.unit}`:''}</td><td>{row.loqText||'Not stated'}</td><td>{row.limitText||'Not stated'}</td><td>{row.statusText||'Not stated'}</td></tr>):analytes.map(analyte=><tr key={analyte}><td><strong>{analyte}</strong></td><td>Protected · Kasandrinos approval required</td><td>Pending Light Labs approval</td></tr>)}</tbody></table></div>
  {access?.canReadPdf?<a className="button-dark" href={`${base}/document`} target="_blank" rel="noopener noreferrer">Open original PDF ↗</a>:null}
  {state==='sign-in'?<a className="button-dark" href={`/sign-in?return_to=${encodeURIComponent(`/records/${encodeURIComponent(identifier)}`)}`}>Sign in with work email →</a>:null}
  {access&&!access.canManage&&(!access.canReadResults||!access.canReadPdf)?<div className="kas-access-request"><p>{access.status==='pending'?'Your access request is pending Kasandrinos review.':access.status==='active'?'Your current grant covers only the approved scope. Contact Kasandrinos to change it.':'Request access for your signed-in email. Kasandrinos decides who can view each report.'}</p>{!['pending','active'].includes(access.status)?<div><button className="button-dark" disabled={requesting} onClick={()=>void requestAccess(true,false)}>Request results</button><button className="button-dark" disabled={requesting} onClick={()=>void requestAccess(false,true)}>Request PDF</button><button className="button-dark" disabled={requesting} onClick={()=>void requestAccess(true,true)}>Request results and PDF</button></div>:null}</div>:null}
  {message?<p role="status">{message}</p>:null}
  {access?.canManage?<p><a href="/dashboard/kasandrinos">Manage recipients and permissions →</a></p>:null}
  {state==='denied'?<p><a href={`/sign-out?return_to=${encodeURIComponent(`/records/${encodeURIComponent(identifier)}`)}`}>Sign out to use a different account</a></p>:null}
  {state==='error'||state==='denied'?<button className="button-dark" onClick={()=>setRetry(v=>v+1)}>Retry report access</button>:null}
 </section>;
}
