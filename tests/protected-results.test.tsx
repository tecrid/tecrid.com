import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import {ProtectedResults} from '../app/sample-lab/protected-results';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const identifier='SBX·TECRID-KAS-43301-49BEFE05';
const body={sandbox:true,productionAuthority:false,results:[{analyte:'Synthetic analyte',resultText:'ND',unit:'ppb',loqText:'0.5 ppb',limitText:'',statusText:'',notes:''}]};
it('shows a sign-in gate without results when the server denies anonymous access',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:401})));render(<ProtectedResults identifier={identifier} analytes={['Synthetic analyte']}/>);
 await screen.findByText('Sign in to view the actual results here.');expect(screen.queryByText('ND')).toBeNull();expect(screen.getByText('Sign in with work email →').getAttribute('href')).toContain('return_to=');
});
it('renders authorized source rows and only a separately authorized PDF link with TEST labels',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url)=>String(url).includes('/results')?Response.json(body):Response.json({canReadResults:true,canReadPdf:true,canManage:false,status:'active'})));
 render(<ProtectedResults identifier={identifier} analytes={['Synthetic analyte']}/>);await screen.findByText('ND ppb');expect(screen.getAllByText('Not stated').length).toBe(2);expect(screen.getByText('Open original PDF ↗').getAttribute('href')).toContain('/document');expect(screen.getByText('TEST · Light Labs approval pending')).toBeTruthy();
});
it('allows PDF-only viewing while results stay gated',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url)=>String(url).includes('/results')?new Response(null,{status:403}):Response.json({canReadResults:false,canReadPdf:true,canManage:false,status:'active'})));
 render(<ProtectedResults identifier={identifier} analytes={['Synthetic']}/>);await screen.findByText('Kasandrinos approval is required to view these results.');expect(screen.getByText('Open original PDF ↗')).toBeTruthy();expect(screen.queryByText('ND ppb')).toBeNull();
});
it('lets an unapproved signed-in recipient request both scopes without granting access',async()=>{
 const transport=vi.fn(async(url:any,options:any)=>{if(String(url).includes('/results'))return new Response(null,{status:403});const input=JSON.parse(options.body);if(input.action==='request'){expect(input).toEqual({action:'request',reportNumber:'43301',results:true,pdf:true});return Response.json({ok:true});}return Response.json({canReadResults:false,canReadPdf:false,canManage:false,status:'not_requested'});});vi.stubGlobal('fetch',transport);
 render(<ProtectedResults identifier={identifier} analytes={['Synthetic']}/>);fireEvent.click(await screen.findByText('Request results and PDF'));await screen.findByText('Access requested. Kasandrinos can approve it in the TEST workspace.');expect(screen.queryByText('Open original PDF ↗')).toBeNull();
});
