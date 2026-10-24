'use client';
import {useEffect,useState} from 'react';
type Row={analyte:string;resultText:string;unit:string;loqText:string;limitText:string;statusText:string;notes:string};
type Card={identifier:string;controller:string;laboratory:string;sample:string;lot:string;assay:string;method:string;receivedAt:string;testedAt:string;releasedAt:string;sourceFilename:string;sourceSha256:string;approval:string};
type Access={canReadCard:boolean;canManage:boolean;status:string};
export function ProtectedResults({identifier,analytes}:{identifier:string;analytes:string[]}){
 const [state,setState]=useState<'loading'|'sign-in'|'denied'|'error'|'ready'>('loading');
 const [rows,setRows]=useState<Row[]>([]),[card,setCard]=useState<Card|null>(null),[access,setAccess]=useState<Access|null>(null),[retry,setRetry]=useState(0),[requesting,setRequesting]=useState(false),[message,setMessage]=useState('');
 const base=`/api/test-reports/${encodeURIComponent(identifier)}`;
 useEffect(()=>{const controller=new AbortController();setRows([]);setCard(null);setAccess(null);setState('loading');
  async function load(){
   const response=await fetch(`${base}/card`,{cache:'no-store',credentials:'same-origin',signal:controller.signal});
   if(controller.signal.aborted)return;
   if(response.status===401){setState('sign-in');return;}
   const status=await fetch('/api/kasandrinos-test',{method:'POST',cache:'no-store',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'status',reportNumber:identifier.split('-').at(-2)}),signal:controller.signal});
   if(!status.ok)throw Error();const a=await status.json();if(controller.signal.aborted)return;setAccess(a);
   if(response.status===403){setState('denied');return;}if(!response.ok)throw Error();
   const data=await response.json();if(controller.signal.aborted)return;
   if(data.sandbox!==true||data.productionAuthority!==false||data.card?.identifier!==identifier||!Array.isArray(data.results))throw Error();setRows(data.results);setCard(data.card);setState('ready');
  }
  void load().catch(()=>{if(!controller.signal.aborted)setState('error');});
  const refresh=()=>setRetry(v=>v+1);window.addEventListener('focus',refresh);
  return()=>{controller.abort();window.removeEventListener('focus',refresh);};
 },[base,identifier,retry]);
 async function requestAccess(){setRequesting(true);setMessage('');try{const r=await fetch('/api/kasandrinos-test',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'request',reportNumber:identifier.split('-').at(-2),card:true})});const j=await r.json();if(!r.ok)throw Error(j.error||'Request failed.');setMessage('Digital card access requested. Kasandrinos can approve or decline in the TEST workspace.');setRetry(v=>v+1);}catch(e){setMessage(e instanceof Error?e.message:'Request failed.');}finally{setRequesting(false);}}
 return <section className={`public-results kas-controlled-panel tecrid-digital-card ${state==='ready'?'is-unlocked':'is-locked'}`} aria-labelledby="report-panel-title">
  <div className="results-note"><h2 id="report-panel-title">Digital TECRID card</h2><span>TEST · Light Labs approval pending</span></div>
  <div className="tecrid-card-state" role="status" aria-live="polite">{state==='loading'?'Checking digital card access…':state==='denied'?'This digital card is locked. Kasandrinos approval is required.':state==='error'?'The digital card could not be loaded. Please retry.':state==='ready'?'Unlocked · Authorized TEST digital card':'Sign in to request or open this digital card.'}</div>
  {state==='ready'&&card?<>
   <header className="tecrid-card-identity"><p className="section-kicker">Kasandrinos · TEST digital card</p><h3>{card.assay}</h3><code>{card.identifier}</code><p>{card.sample} · Lot {card.lot}</p></header>
   <dl className="tecrid-card-facts"><div><dt>Laboratory</dt><dd>{card.laboratory}</dd></div><div><dt>Prepared for</dt><dd>{card.controller}</dd></div><div><dt>Method</dt><dd>{card.method}</dd></div><div><dt>Sample received</dt><dd>{card.receivedAt}</dd></div><div><dt>Tested</dt><dd>{card.testedAt}</dd></div><div><dt>Report released</dt><dd>{card.releasedAt}</dd></div></dl>
   <p>Actual source-report values, transcribed for testing. Blank source fields are “Not stated”; ND and NR are preserved. Printed limits and status are source statements, not a TECRID safety assessment.</p>
   <div className="kas-panel-scroll"><table><caption>Results in this TEST digital card</caption><thead><tr><th>Analyte</th><th>Result as reported</th><th>LOQ</th><th>Printed limit</th><th>Printed status</th></tr></thead><tbody>{rows.map((row,index)=><tr key={`${row.analyte}-${index}`}><td><strong>{row.analyte}</strong>{row.notes?<small className="kas-result-note">{row.notes}</small>:null}</td><td>{row.resultText}{row.unit?` ${row.unit}`:''}</td><td>{row.loqText||'Not stated'}</td><td>{row.limitText||'Not stated'}</td><td>{row.statusText||'Not stated'}</td></tr>)}</tbody></table></div>
   <footer className="tecrid-card-proof"><strong>TEST · {card.approval}</strong><p>Source: {card.sourceFilename}</p><code>sha256:{card.sourceSha256}</code><p>The original report is retained privately as source evidence. This card is not a signed production credential.</p></footer>
  </>:<><p>Kasandrinos controls access to this card’s analytical results. Sign in with your work email, request this digital card, and return here after approval.</p><p>Card contents: {analytes.join(', ')} · sample and lot · laboratory and method · dates · source fingerprint · approval status.</p><p>Protected · Kasandrinos approval required</p></>}
  {state==='sign-in'?<a className="button-dark" href={`/sign-in?return_to=${encodeURIComponent(`/records/${encodeURIComponent(identifier)}#report-panel-title`)}`}>Sign in with work email →</a>:null}
  {access&&!access.canManage&&!access.canReadCard?<div className="kas-access-request"><p>{access.status==='pending'?'Your digital card request is pending Kasandrinos review.':'Request this digital card for your signed-in email. Kasandrinos decides who can view it.'}</p>{access.status!=='pending'?<button className="button-dark" disabled={requesting} onClick={()=>void requestAccess()}>Request digital card access →</button>:null}</div>:null}
  {message?<p role="status">{message}</p>:null}
  {access?.canManage?<p><a href="/dashboard/kasandrinos">Manage digital card access →</a></p>:null}
  {state==='denied'?<p><a href={`/sign-out?return_to=${encodeURIComponent(`/records/${encodeURIComponent(identifier)}`)}`}>Sign out to use a different account</a></p>:null}
  {state==='error'||state==='denied'?<button className="button-dark" onClick={()=>setRetry(v=>v+1)}>Check card access again</button>:null}
 </section>;
}
