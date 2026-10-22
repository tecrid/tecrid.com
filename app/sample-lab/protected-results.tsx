'use client';
import {useEffect,useState} from 'react';
type Row={analyte:string;resultText:string;unit:string;loqText:string;limitText:string;statusText:string;notes:string};
export function ProtectedResults({identifier,analytes}:{identifier:string;analytes:string[]}){
 const [state,setState]=useState<'loading'|'sign-in'|'denied'|'error'|'ready'>('loading');
 const [rows,setRows]=useState<Row[]>([]);const [retry,setRetry]=useState(0);
 const base=`/api/test-reports/${encodeURIComponent(identifier)}`;
 useEffect(()=>{const controller=new AbortController();setRows([]);setState('loading');
  fetch(`${base}/results`,{cache:'no-store',credentials:'same-origin',signal:controller.signal}).then(async response=>{
   if(controller.signal.aborted)return;
   if(response.status===401){setState('sign-in');return;}if(response.status===403){setState('denied');return;}if(!response.ok)throw Error();
   const data=await response.json();if(controller.signal.aborted)return;
   if(data.sandbox!==true||data.productionAuthority!==false||!Array.isArray(data.results))throw Error();setRows(data.results);setState('ready');
  }).catch(()=>{if(!controller.signal.aborted)setState('error');});
  return()=>controller.abort();
 },[base,retry]);
 return <section className="public-results kas-controlled-panel" aria-labelledby="report-panel-title">
  <div className="results-note"><h2 id="report-panel-title">Analytical panel</h2><span>TEST · Light Labs approval pending</span></div>
  <p>{state==='ready'?'Source-report transcription for testing. Light Labs has not approved or signed these TECRID results. Blank source fields are shown as “Not stated”; ND and NR are preserved without conversion to zero. Printed limits and status are source statements, not a TECRID safety assessment.':'Results and original PDFs require an authorized work-email session. No analytical values are included in the public page.'}</p>
  <div role="status" aria-live="polite">{state==='loading'?'Checking report access…':state==='denied'?'This account does not have company-email buyer access.':state==='error'?'The protected report could not be loaded. Please retry.':state==='ready'?'Authorized access · TEST results loaded.':'Sign in to view the actual results here.'}</div>
  <div className="kas-panel-scroll"><table><thead><tr><th>Analyte</th>{state==='ready'?<><th>Result as reported</th><th>LOQ</th><th>Printed limit</th><th>Printed status</th></>:<><th>Result / LOQ / specification</th><th>TECRID confirmation</th></>}</tr></thead><tbody>{state==='ready'?rows.map((row,index)=><tr key={`${row.analyte}-${index}`}><td><strong>{row.analyte}</strong>{row.notes?<small className="kas-result-note">{row.notes}</small>:null}</td><td>{row.resultText}{row.unit?` ${row.unit}`:''}</td><td>{row.loqText||'Not stated'}</td><td>{row.limitText||'Not stated'}</td><td>{row.statusText||'Not stated'}</td></tr>):analytes.map(analyte=><tr key={analyte}><td><strong>{analyte}</strong></td><td>Protected · sign in to view</td><td>Pending Light Labs approval</td></tr>)}</tbody></table></div>
  {state==='ready'?<a className="button-dark" href={`${base}/document`} target="_blank" rel="noopener noreferrer">Open original PDF ↗</a>:state==='sign-in'||state==='denied'?<a className="button-dark" href={`/sign-in?return_to=${encodeURIComponent(`/records/${encodeURIComponent(identifier)}`)}`}>Sign in with work email →</a>:null}
  {state==='denied'?<p><a href={`/sign-out?return_to=${encodeURIComponent(`/records/${encodeURIComponent(identifier)}`)}`}>Sign out to use a different account</a></p>:null}
  {state==='error'?<button className="button-dark" onClick={()=>setRetry(v=>v+1)}>Retry report access</button>:null}
 </section>;
}
