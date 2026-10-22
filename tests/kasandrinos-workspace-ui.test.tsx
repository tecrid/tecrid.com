import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent,waitFor} from '@testing-library/react';
import {KasandrinosTestWorkspace} from '../app/dashboard/kasandrinos/workspace';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const report={reportNumber:'43301',identifier:'SBX·TECRID-KAS-43301-49BEFE05',title:'Synthetic report',sample:'Synthetic oil',lotNumbers:['TEST'],canReadResults:true,canReadPdf:true,status:'controller'};
const workspace={sandbox:true,productionAuthority:false,canManage:true,role:'owner',email:'controller@company.test',reports:[report],permissions:[{report_number:'43301',recipient_email:'recipient@company.test',status:'pending',results_access:0,pdf_access:0,requested_results:1,requested_pdf:1,expires_at:null,revision:1,updated_at:'2026-01-01'}],events:[]};
it('shows email sign-in and no permission controls for an anonymous user',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:401})));render(<KasandrinosTestWorkspace/>);await screen.findByText('Sign in to this workspace →');expect(screen.queryByText('Approve TEST access →')).toBeNull();});
it('shows the report directory without management controls to a recipient',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...workspace,canManage:false,role:null,permissions:[]})));render(<KasandrinosTestWorkspace/>);await screen.findByText('Kasandrinos approval is required.');expect(screen.queryByText('Approve TEST access →')).toBeNull();expect(screen.getByText('Open TEST report →')).toBeTruthy();});
it('approves a pending recipient scope with its revision, then revokes both scopes',async()=>{
 let state=structuredClone(workspace);const calls:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_url:any,o:any)=>{if(o?.method==='POST'){const input=JSON.parse(o.body);calls.push(input);state={...state,permissions:state.permissions.map(p=>({...p,status:input.action==='grant'?'active':'revoked',revision:p.revision+1,results_access:input.action==='grant'?1:0,pdf_access:input.action==='grant'?1:0}))};return Response.json({ok:true});}return Response.json(state);}));
 render(<KasandrinosTestWorkspace/>);fireEvent.click(await screen.findByText('Approve requested scope'));await screen.findByText('Requested TEST access approved.');expect(calls[0]).toEqual({action:'grant',email:'recipient@company.test',reports:[{reportNumber:'43301',revision:1}],results:true,pdf:true});fireEvent.click(screen.getByText('Revoke both'));await screen.findByText('Access revoked for results and PDFs on TECRID and VLE.');expect(calls[1].reports[0].revision).toBe(2);expect(calls[1].action).toBe('revoke');
});
