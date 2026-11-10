"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { InboxItem } from '../lib/notifications';

type Inbox = { items: InboxItem[]; unreadCount: number; unavailable: string[]; vleConnected: boolean };
const empty: Inbox={items:[],unreadCount:0,unavailable:[],vleConnected:false};
const Context=createContext({ ...empty, loading:true, signedIn:false, error:'', refresh:async()=>{}, markRead:async(_id:string)=>{}, markAllRead:async()=>{} });
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
 const markRead=async(id:string)=>{const response=await fetch('/api/notifications',{method:'POST',headers:{'content-type':'application/json'},keepalive:true,body:JSON.stringify({action:'read',id})});if(!response.ok)throw Error('Could not mark this notification read. Please retry.');await refresh();};
 const markAllRead=async()=>{const response=await fetch('/api/notifications',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'read-all'})});if(!response.ok)throw Error('Could not mark all notifications read. Please retry.');await refresh();};
 return <Context.Provider value={{...data,loading,signedIn,error,refresh,markRead,markAllRead}}>{children}</Context.Provider>;
}
export function NotificationCount(){const {unreadCount}=useContext(Context);return unreadCount>0?<span className="notification-count" aria-label={`${unreadCount} unread notifications`}>{unreadCount>99?'99+':unreadCount}</span>:null;}
export function NotificationBell(){const {signedIn,error}=useContext(Context);return signedIn||error?<a className="notification-bell" href="/notifications" aria-label="Notifications"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5Zm5 3h4"/></svg><NotificationCount/></a>:null;}
export function relativeNotificationTime(createdAt:string) {
 const minutes=Math.max(0,Math.floor((Date.now()-new Date(createdAt).getTime())/60000));
 if(minutes<1)return 'now';
 if(minutes<60)return `${minutes}m`;
 if(minutes<1440)return `${Math.floor(minutes/60)}h`;
 return `${Math.floor(minutes/1440)}d`;
}
export function NotificationCenter(){
 const {items,loading,error,unavailable,unreadCount,vleConnected,refresh,markRead,markAllRead}=useContext(Context);
 const [unread,setUnread]=useState(false),[visible,setVisible]=useState(20),[busy,setBusy]=useState(false),[failure,setFailure]=useState('');
 const shown=unread?items.filter(item=>!item.read):items;
 async function readAll(){setBusy(true);setFailure('');try{await markAllRead();}catch(e){setFailure(e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}}
 function read(id:string){void markRead(id).catch(e=>setFailure(e instanceof Error?e.message:'Please retry.'));}
 return <section className="notification-center" aria-label="Your notifications">
  <div className="notification-toolbar"><div role="group" aria-label="Filter notifications"><button aria-pressed={!unread} onClick={()=>{setUnread(false);setVisible(20);}}>All</button><button aria-pressed={unread} onClick={()=>{setUnread(true);setVisible(20);}}>Unread</button></div><button className="notification-read-all" disabled={busy||!unreadCount} onClick={()=>void readAll()}>{busy?'Saving…':'Mark all as read'}</button></div>
  {error||unavailable.length?<p role="alert" className="notification-error">{error||`${unavailable.join(' and ')} updates could not be refreshed.`} <button onClick={()=>void refresh()}>Retry</button></p>:null}
  {failure?<p role="alert" className="notification-error">{failure}</p>:null}
  {loading?<p role="status">Loading your notifications…</p>:null}
  {!loading&&!error&&!unavailable.length&&!shown.length?<p className="notification-empty">{unread?'You’re all caught up.':'Your updates will appear here.'}</p>:null}
  <div className="notification-list">{shown.slice(0,visible).map(item=><a key={item.id} className={`notification-row ${item.read?'is-read':'is-unread'}`} href={item.href} aria-label={`${item.title}, ${item.read?'Read':'Unread'}`} onClick={()=>read(item.id)}>
   <span className="notification-source" aria-hidden="true">{item.source==='tecrid'?'TECRID':'VLE'}</span>
   <span className="notification-content"><strong>{item.title}</strong><span className="notification-body">{item.body}</span></span>
   <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>{relativeNotificationTime(item.createdAt)}</time>
   <span className="notification-dot" aria-hidden="true"/>
  </a>)}</div>
  {shown.length>visible?<button className="notification-previous" onClick={()=>setVisible(count=>count+20)}>See previous notifications</button>:null}
  <p className="notification-description">{!vleConnected&&!loading?'Sign in with your work email to include VLE updates.':'Showing the latest 100 updates per source.'}</p>
 </section>;
}
