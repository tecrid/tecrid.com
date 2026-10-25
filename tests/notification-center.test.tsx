import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {NotificationProvider,NotificationCenter,NotificationCount} from '../app/notification-center';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const item={id:'tecrid:example',source:'tecrid',kind:'evidence_access.requested',title:'Access request for EXAMPLE',body:'Review the requested scope.',href:'https://tecrid.com/dashboard/evidence-routing',createdAt:'2026-10-23T10:00:00Z',read:false};
it('shows requests and updates personal unread state only after an explicit read action',async()=>{
 let read=false;const fetcher=vi.fn(async(_url,options)=>{if(options?.method==='POST'){expect(JSON.parse(options.body)).toEqual({action:'read',id:item.id});read=true;}return Response.json({items:[{...item,read}],unreadCount:read?0:1,unavailable:[],vleConnected:true});});vi.stubGlobal('fetch',fetcher);
 render(<NotificationProvider><NotificationCount/><NotificationCenter/></NotificationProvider>);
 await screen.findByText(item.title);expect(screen.getByRole('link',{name:/Review request/}).getAttribute('href')).toBe(item.href);expect(read).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Mark read'}));await waitFor(()=>expect(screen.queryByRole('button',{name:'Mark read'})).toBeNull());
 fireEvent.click(screen.getByRole('button',{name:'Unread (0)'}));expect(screen.getByText('You’re all caught up.')).toBeTruthy();
});
it('shows an upstream outage instead of claiming the inbox is empty',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({items:[],unreadCount:0,unavailable:['VLE'],vleConnected:true})));
 render(<NotificationProvider><NotificationCenter/></NotificationProvider>);expect((await screen.findByRole('alert')).textContent).toContain('VLE updates could not be refreshed');expect(screen.queryByText('Your updates will appear here.')).toBeNull();
});
