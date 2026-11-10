import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {NotificationProvider,NotificationCenter,NotificationCount,NotificationBell} from '../app/notification-center';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const item={id:'tecrid:example',source:'tecrid',kind:'evidence_access.requested',title:'Access request for EXAMPLE',body:'Review the requested scope.',href:'https://tecrid.com/dashboard/evidence-routing',createdAt:'2026-10-23T10:00:00Z',read:false};
it('shows requests and updates personal unread state when the row is opened',async()=>{
 let read=false;const fetcher=vi.fn(async(_url,options)=>{if(options?.method==='POST'){expect(JSON.parse(options.body)).toEqual({action:'read',id:item.id});read=true;}return Response.json({items:[{...item,read}],unreadCount:read?0:1,unavailable:[],vleConnected:true});});vi.stubGlobal('fetch',fetcher);
 render(<NotificationProvider><NotificationCount/><NotificationCenter/></NotificationProvider>);
 await screen.findByText(item.title);expect(screen.getByRole('link',{name:/Access request for EXAMPLE, Unread/}).getAttribute('href')).toBe(item.href);expect(read).toBe(false);
 const row=screen.getByRole('link',{name:/EXAMPLE, Unread/});row.addEventListener('click',event=>event.preventDefault());fireEvent.click(row);await screen.findByRole('link',{name:/EXAMPLE, Read/});
 fireEvent.click(screen.getByRole('button',{name:'Unread'}));expect(screen.getByText('You’re all caught up.')).toBeTruthy();
});
it('shows an upstream outage instead of claiming the inbox is empty',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({items:[],unreadCount:0,unavailable:['VLE'],vleConnected:true})));
 render(<NotificationProvider><NotificationCenter/></NotificationProvider>);expect((await screen.findByRole('alert')).textContent).toContain('VLE updates could not be refreshed');expect(screen.queryByText('Your updates will appear here.')).toBeNull();
});

it('uses native bell navigation so a client router failure cannot swallow the click',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({items:[item],unreadCount:1,unavailable:[],vleConnected:true})));
 render(<NotificationProvider><NotificationBell/><NotificationCenter/></NotificationProvider>);
 const bell=await screen.findByRole('link',{name:'Notifications'});
 expect(bell.getAttribute('href')).toBe('/notifications');
 expect(bell.querySelector('.notification-count')?.textContent).toBe('1');
 const click=new MouseEvent('click',{bubbles:true,cancelable:true});
 bell.addEventListener('click',event=>{expect(event.defaultPrevented).toBe(false);event.preventDefault();},{once:true});
 bell.dispatchEvent(click);
 expect(screen.getByRole('link',{name:/EXAMPLE, Unread/}).textContent).not.toContain('↗');
});

it('renders compact rows, relative times and twenty-item pagination with accessible filters',async()=>{
 const items=Array.from({length:45},(_,index)=>({...item,id:`tecrid:${index}`,title:`Update ${index}`,read:index===0,createdAt:new Date(Date.now()-5*60000).toISOString()}));
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({items,unreadCount:44,unavailable:[],vleConnected:true})));
 const {container}=render(<NotificationProvider><NotificationCenter/></NotificationProvider>);
 await screen.findByRole('link',{name:'Update 0, Read'});
 expect(container.querySelectorAll('.notification-row')).toHaveLength(20);
 expect(container.querySelector('article')).toBeNull();
 const row=screen.getByRole('link',{name:'Update 1, Unread'});
 expect(row.className).toContain('is-unread');expect(row.querySelector('time')?.textContent).toBe('5m');expect(row.querySelector('time')?.title).toBeTruthy();
 expect(row.querySelector('.notification-body')?.textContent).toBe(item.body);
 expect(row.querySelector('button')).toBeNull();expect(row.querySelector('.notification-dot')).toBeTruthy();
 expect(screen.queryByText('Open update')).toBeNull();expect(screen.queryByText('Mark read')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'See previous notifications'}));expect(container.querySelectorAll('.notification-row')).toHaveLength(40);
 fireEvent.click(screen.getByRole('button',{name:'See previous notifications'}));expect(container.querySelectorAll('.notification-row')).toHaveLength(45);expect(screen.queryByText('See previous notifications')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Unread'}));expect(container.querySelectorAll('.notification-row')).toHaveLength(20);expect(screen.queryByRole('link',{name:'Update 0, Read'})).toBeNull();expect(screen.getByRole('button',{name:'Unread'}).getAttribute('aria-pressed')).toBe('true');
});
it('marks all notifications read from the toolbar',async()=>{
 let read=false;vi.stubGlobal('fetch',vi.fn(async(_url,options)=>{if(options?.method==='POST'){expect(JSON.parse(options.body)).toEqual({action:'read-all'});read=true;}return Response.json({items:[{...item,read}],unreadCount:read?0:1,unavailable:[],vleConnected:true});}));
 render(<NotificationProvider><NotificationCenter/></NotificationProvider>);await screen.findByText(item.title);
 fireEvent.click(screen.getByRole('button',{name:'Mark all as read'}));await screen.findByRole('link',{name:/EXAMPLE, Read/});
});
it('starts a keepalive read request without preventing native navigation or waiting for the POST',async()=>{
 const fetcher=vi.fn((_url,options)=>options?.method==='POST'?new Promise(()=>{}):Promise.resolve(Response.json({items:[item],unreadCount:1,unavailable:[],vleConnected:true})));vi.stubGlobal('fetch',fetcher);
 render(<NotificationProvider><NotificationCenter/></NotificationProvider>);const row=await screen.findByRole('link',{name:/EXAMPLE, Unread/});
 row.addEventListener('click',event=>{expect(event.defaultPrevented).toBe(false);event.preventDefault();});fireEvent.click(row);
 expect(fetcher).toHaveBeenCalledWith('/api/notifications',expect.objectContaining({method:'POST',keepalive:true,body:JSON.stringify({action:'read',id:item.id})}));
});
