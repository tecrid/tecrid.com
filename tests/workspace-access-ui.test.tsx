import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AccessPanel, revocationNotice } from '../app/dashboard/access/access-panel';
import { WorkspaceSidebar } from '../app/dashboard/workspace-sidebar';
vi.mock('next/navigation',()=>({usePathname:()=>'/dashboard/access',useRouter:()=>({refresh:vi.fn()})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const organizations=[{id:'recipient',name:'Market Partner',type:'retailer',items:[{id:'grant-1',kind:'grant' as const,recipientId:'recipient',name:'Market Partner',type:'retailer',accessLevel:'selected_analytes',products:['OIL-1'],analytes:['Lead'],grantedAt:'2026-01-01T12:00:00Z',expiresAt:null,lastUsedAt:null},{id:'code-1',kind:'share' as const,recipientId:'recipient',name:'Market Partner',type:'retailer',accessLevel:'full_record',products:['TECRID:TEST-1'],analytes:[],grantedAt:'2026-02-01T12:00:00Z',expiresAt:'2099-01-01T12:00:00Z',lastUsedAt:'2026-03-01T12:00:00Z'}]}];
it('renders one organization with combined scopes, dates, and one Revoke button',()=>{
 render(<AccessPanel organizations={organizations} history={[]} canRevoke/>);
 expect(screen.getAllByText('Market Partner')).toHaveLength(1);expect(screen.getByText('Selected analytes, Full record')).toBeTruthy();expect(screen.getByText('OIL-1, TECRID:TEST-1')).toBeTruthy();expect(screen.getByText('Mar 1, 2026')).toBeTruthy();expect(screen.getAllByRole('button',{name:/Revoke all access/})).toHaveLength(1);expect(screen.getByText(revocationNotice)).toBeTruthy();
});
it('requires confirmation for revoke-all and can cancel without sending a request',async()=>{
 const fetch=vi.fn(async (_url:string,_init?:RequestInit)=>Response.json({revoked:2}));vi.stubGlobal('fetch',fetch);
 render(<AccessPanel organizations={organizations} history={[]} canRevoke/>);
 fireEvent.click(screen.getByRole('button',{name:'Revoke all access for Market Partner'}));expect(fetch).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(fetch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Revoke all access for Market Partner'}));fireEvent.click(screen.getByRole('button',{name:'Confirm revocation'}));expect(await screen.findByText('Revoked 2 permissions for Market Partner.')).toBeTruthy();expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({recipientId:'recipient',confirm:true});
});
it('expands the organization to revoke a single item',async()=>{
 const fetch=vi.fn(async (_url:string,_init?:RequestInit)=>Response.json({revoked:1}));vi.stubGlobal('fetch',fetch);
 render(<AccessPanel organizations={organizations} history={[]} canRevoke/>);fireEvent.click(screen.getByRole('button',{name:'Show items (2)'}));expect(screen.getByText('Selected analytes: Lead')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Revoke Share code code-1'}));fireEvent.click(screen.getByRole('button',{name:'Confirm revocation'}));expect(await screen.findByText('Revoked 1 permission for Market Partner.')).toBeTruthy();expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toMatchObject({item:{id:'code-1',kind:'share'}});
});
it('lets Members view expanded permissions and audit history without revoke controls',()=>{
 render(<AccessPanel organizations={organizations} history={[{id:'audit-1',recipientId:'recipient',name:'Market Partner',type:'retailer',itemId:'old-code',kind:'share',products:['OIL-OLD'],revokedAt:'2026-04-01T12:00:00Z'}]} canRevoke={false}/>);
 fireEvent.click(screen.getByRole('button',{name:'Show items (2)'}));expect(screen.queryByRole('button',{name:/Revoke all|Revoke item|Revoke Share/})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Revoked (1)'}));expect(screen.getByText('OIL-OLD')).toBeTruthy();expect(screen.getByText('Apr 1, 2026')).toBeTruthy();
});
it.each(['brand','supplier','laboratory'])('shows the access sidebar link only for controllers (%s)',type=>{
 render(<WorkspaceSidebar organization={{name:'Workspace',code:'CODE',type,issuerStatus:'pending',plan:'free'}} progress={{applicationStatus:null,hasApiKey:false,hasCredential:false}} user={{displayName:'Owner',email:'owner@example.test'}} signOutHref="/sign-out"/>);
 const link=screen.queryByRole('link',{name:'Who can see my results'});if(type==='laboratory') expect(link).toBeNull();else {expect(link?.getAttribute('href')).toBe('/dashboard/access');expect(link?.getAttribute('aria-current')).toBe('page');}
});
