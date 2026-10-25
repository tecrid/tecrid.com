"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { InboxItem } from '../lib/notifications';

type Inbox = { items: InboxItem[]; unreadCount: number; unavailable: string[]; vleConnected: boolean };
const empty: Inbox={items:[],unreadCount:0,unavailable:[],vleConnected:false};
const Context=createContext({ ...empty, loading:true, signedIn:false, error:'', refresh:async()=>{}, markRead:async(_id:string)=>{} });
export function NotificationProvider({children}:{children:ReactNode}) {
 const [data,setData]=useState(empty),[loading,setLoading]=useState(true),[signedIn,setSignedIn]=useState(false),[error,setError]=useState('');
 const pending=useRef<AbortController|null>(null);
 const refresh=useCallback(async()=>{
  pending.current?.abort(); const controller=new AbortController();pending.current=controller;
  try {const response=await fetch('/api/notifications',{cache:'no-store',signal:controller.signal});
   if(response.status===401){setData(empty);setSignedIn(false);setError('');return;}
   if(!response.ok)throw Error('Notifications are temporarily unavailable.');
   const result=await response.json() as Inbox;setData(result);setSignedIn(true);setError('');
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to refresh notifications.');}
  finally{if(!controller.signal.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},45000);const visible=()=>{if(!document.hidden)void refresh();};document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);return()=>{clearInterval(timer);pending.current?.abort();document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);};},[refresh]);
 const markRead=async(id:string)=>{const response=await fetch('/api/notifications',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'read',id})});if(!response.ok)throw Error('Could not mark this notification read. Please retry.');await refresh();};
 return <Context.Provider value={{...data,loading,signedIn,error,refresh,markRead}}>{children}</Context.Provider>;
}
export function NotificationCount(){const {unreadCount}=useContext(Context);return unreadCount>0?<span className="notification-count" aria-label={`${unreadCount} unread notifications`}>{unreadCount>99?'99+':unreadCount}</span>:null;}
export function NotificationBell(){const {signedIn,error}=useContext(Context);return signedIn||error?<Link className="notification-bell" href="/notifications" aria-label="Notifications"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5Zm5 3h4"/></svg><NotificationCount/></Link>:null;}
export function NotificationCenter(){
 const {items,loading,error,unavailable,unreadCount,vleConnected,refresh,markRead}=useContext(Context);
 const [unread,setUnread]=useState(false),[busy,setBusy]=useState<string|null>(null),[failure,setFailure]=useState('');
 const shown=unread?items.filter(item=>!item.read):items;
 async function read(id:string){setBusy(id);setFailure('');try{await markRead(id);}catch(e){setFailure(e instanceof Error?e.message:'Please retry.');}finally{setBusy(null);}}
 return <section className="notification-center" aria-label="Your notifications">
  <div className="notification-toolbar"><div role="group" aria-label="Filter notifications"><button aria-pressed={!unread} onClick={()=>setUnread(false)}>All updates</button><button aria-pressed={unread} onClick={()=>setUnread(true)}>Unread ({unreadCount})</button></div><button onClick={()=>void refresh()}>Refresh</button></div>
  <p className="notification-description">New credentials, access requests, and decisions from TECRID and VLE. Opening an update does not approve access.</p>
  {!vleConnected&&!loading?<p>Sign in with your work email to include VLE updates for the same email address.</p>:null}
  {error||unavailable.length?<p role="alert" className="notification-error">{error||`${unavailable.join(' and ')} updates could not be refreshed. Other updates are shown; retry to see the complete inbox.`}</p>:null}
  {failure?<p role="alert" className="notification-error">{failure}</p>:null}
  {loading?<p role="status">Loading your notifications…</p>:null}
  {!loading&&!error&&!unavailable.length&&!shown.length?<div className="notification-empty"><h2>{unread?'You’re all caught up.':'Your updates will appear here.'}</h2><p>We’ll notify you when a TECRID arrives or someone requests access to your evidence.</p></div>:null}
  <div className="notification-list">{shown.map(item=><article key={item.id} className={item.read?'is-read':'is-unread'}>
   <div className="notification-meta"><span>{item.source==='tecrid'?'TECRID':'VLE · TEST card'}</span>{!item.read?<strong>Unread</strong>:null}<time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div>
   <h2>{item.title}</h2><p>{item.body}</p><div className="notification-actions"><a href={item.href}>{item.kind.includes('requested')?'Review request':'Open update'} <span aria-hidden="true">↗</span></a>{!item.read?<button disabled={busy===item.id} onClick={()=>void read(item.id)}>{busy===item.id?'Saving…':'Mark read'}</button>:null}</div>
  </article>)}</div><p className="notification-description">Updates refresh while the app is open. Read status is personal and shared between your TECRID and VLE inboxes. Showing the latest 100 updates from each source.</p>
 </section>;
}
