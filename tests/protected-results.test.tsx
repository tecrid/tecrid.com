import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent,waitFor} from '@testing-library/react';
import {ProtectedResults} from '../app/sample-lab/protected-results';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const identifier='SBX·TECRID-KAS-43301-49BEFE05';
const body={sandbox:true,productionAuthority:false,card:{identifier,controller:'Synthetic controller',laboratory:'Synthetic lab',sample:'Synthetic oil',lot:'TEST-LOT',assay:'Synthetic assay',method:'Synthetic method',receivedAt:'2026-01-01',testedAt:'2026-01-02',releasedAt:'2026-01-03',sourceFilename:'Synthetic.pdf',sourceSha256:'synthetic-hash',approval:'Pending Light Labs approval and signature'},results:[{analyte:'Synthetic analyte',resultText:'ND',unit:'ppb',loqText:'0.5 ppb',limitText:'',statusText:'',notes:''}]};
it('shows a sign-in gate without private card values for anonymous access',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:401})));render(<ProtectedResults identifier={identifier} analytes={['Synthetic analyte']}/>);
 await screen.findByText('Sign in to request or open this digital card.');expect(screen.queryByText('ND ppb')).toBeNull();expect(screen.queryByText('Synthetic method')).toBeNull();expect(screen.getByText('Sign in with work email →').getAttribute('href')).toContain('return_to=');
});
it('unlocks a structured digital card and never renders a PDF download',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url)=>String(url).includes('/card')?Response.json(body):Response.json({canReadCard:true,canManage:false,status:'active'})));
 render(<ProtectedResults identifier={identifier} analytes={['Synthetic analyte']}/>);await screen.findByText('ND ppb');expect(screen.getAllByText('Not stated').length).toBe(2);expect(screen.getByText('Synthetic method')).toBeTruthy();expect(screen.getByText('sha256:synthetic-hash')).toBeTruthy();expect(screen.getByText('Unlocked · Authorized TEST digital card')).toBeTruthy();expect(document.querySelector('a[href*="/document"]')).toBeNull();
});
it('keeps a legacy PDF-only recipient behind the card gate',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url)=>String(url).includes('/card')?new Response(null,{status:403}):Response.json({canReadCard:false,canReadPdf:false,canManage:false,status:'active'})));
 render(<ProtectedResults identifier={identifier} analytes={['Synthetic']}/>);await screen.findByText('This digital card is locked. Kasandrinos approval is required.');expect(screen.getByText('Request digital card access →')).toBeTruthy();expect(screen.queryByText('ND ppb')).toBeNull();expect(document.querySelector('a[href*="/document"]')).toBeNull();
});
it('requests only the digital card without granting access',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:any,options:any)=>{if(String(url).includes('/card'))return new Response(null,{status:403});const input=JSON.parse(options.body);if(input.action==='request'){expect(input).toEqual({action:'request',reportNumber:'43301',card:true});return Response.json({ok:true});}return Response.json({canReadCard:false,canManage:false,status:'not_requested'});}));
 render(<ProtectedResults identifier={identifier} analytes={['Synthetic']}/>);fireEvent.click(await screen.findByText('Request digital card access →'));await screen.findByText('Digital card access requested. Kasandrinos can approve or decline in the TEST workspace.');expect(screen.queryByText('ND ppb')).toBeNull();
});
it('removes unlocked values when focus rechecks a revoked grant',async()=>{
 let allowed=true;vi.stubGlobal('fetch',vi.fn(async(url)=>String(url).includes('/card')?(allowed?Response.json(body):new Response(null,{status:403})):Response.json({canReadCard:allowed,canManage:false,status:allowed?'active':'revoked'})));
 render(<ProtectedResults identifier={identifier} analytes={['Synthetic']}/>);await screen.findByText('ND ppb');allowed=false;fireEvent(window,new Event('focus'));await screen.findByText('This digital card is locked. Kasandrinos approval is required.');await waitFor(()=>expect(screen.queryByText('ND ppb')).toBeNull());
});
