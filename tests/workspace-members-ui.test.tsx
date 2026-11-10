import React from 'react';
import { afterEach, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MembersPanel } from '../app/dashboard/settings/members/members-panel';
import { WorkspaceSidebar } from '../app/dashboard/workspace-sidebar';
vi.mock('next/navigation',()=>({usePathname:()=>'/dashboard/settings/members',useRouter:()=>({refresh:vi.fn()})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const people=[{id:1,name:'Alex Owner',email:'alex@atlas.test',role:'owner' as const,joinedAt:'2026-11-01T12:00:00Z'},{id:2,name:'Sam Member',email:'sam@atlas.test',role:'member' as const,joinedAt:'2026-11-02T12:00:00Z'}];
const props={people,pending:[],canManage:true,laboratory:true,website:'https://atlas.test'};
it('renders member names, emails, roles, join dates and next steps',()=>{
 render(<MembersPanel {...props}/>);
 expect(screen.getByText('Alex Owner')).toBeTruthy();expect(screen.getByText('sam@atlas.test')).toBeTruthy();expect(screen.getByText('Nov 1, 2026')).toBeTruthy();expect(screen.getByText('Last Owner')).toBeTruthy();expect(screen.getByText('No pending invites.')).toBeTruthy();
});
it('renders a read-only member view',()=>{
 render(<MembersPanel {...props} canManage={false}/>);
 expect(screen.queryByRole('button',{name:'Send invite'})).toBeNull();expect(screen.queryByRole('button',{name:'Remove'})).toBeNull();expect(screen.queryByRole('combobox')).toBeNull();
});
it('shows outside-domain advice and still allows sending the invite',async()=>{
 const fetch=vi.fn(async (_url: string, _init?: RequestInit)=>Response.json({result:{}}));vi.stubGlobal('fetch',fetch);
 render(<MembersPanel {...props}/>);fireEvent.change(screen.getByLabelText('Email'),{target:{value:'guest@gmail.com'}});
 expect(screen.getByRole('note').textContent).toContain('You can still invite');fireEvent.click(screen.getByRole('button',{name:'Send invite'}));
 expect(await screen.findByText(/A TECRID sign-in email is on its way/)).toBeTruthy();expect(fetch).toHaveBeenCalledOnce();
});
it('requires confirmation for removal and can cancel',async()=>{
 const fetch=vi.fn(async (_url: string, _init?: RequestInit)=>Response.json({ok:true}));vi.stubGlobal('fetch',fetch);
 render(<MembersPanel {...props}/>);fireEvent.click(screen.getByRole('button',{name:'Remove'}));expect(fetch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(screen.queryByRole('region',{name:'Confirm member change'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Remove'}));fireEvent.click(screen.getByRole('button',{name:'Confirm removal'}));expect(await screen.findByText('Changes saved.')).toBeTruthy();
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({action:'remove',memberId:2,confirm:true});
});
it('requires confirmation before a role change',async()=>{
 const fetch=vi.fn(async (_url: string, _init?: RequestInit)=>Response.json({ok:true}));vi.stubGlobal('fetch',fetch);
 render(<MembersPanel {...props}/>);fireEvent.change(screen.getByLabelText('Role for sam@atlas.test'),{target:{value:'admin'}});expect(fetch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirm role change'}));expect(await screen.findByText('Changes saved.')).toBeTruthy();
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({action:'role',memberId:2,role:'admin',confirm:true});
});
it('renders the active Members sidebar link without marking Settings active',()=>{
 render(<WorkspaceSidebar organization={{name:'Atlas',code:'ATL',type:'laboratory',issuerStatus:'pending',plan:'free'}} progress={{applicationStatus:null,hasApiKey:false,hasCredential:false}} user={{displayName:'Alex',email:'alex@atlas.test'}} signOutHref="/sign-out"/>);
 expect(screen.getByRole('link',{name:'Members'}).getAttribute('href')).toBe('/dashboard/settings/members');expect(screen.getByRole('link',{name:'Members'}).getAttribute('aria-current')).toBe('page');expect(screen.getByRole('link',{name:'Settings'}).getAttribute('aria-current')).toBeNull();
});
