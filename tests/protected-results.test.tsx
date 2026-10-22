import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,waitFor,cleanup} from '@testing-library/react';
import {ProtectedResults} from '../app/sample-lab/protected-results';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('shows a sign-in gate without results when the server denies anonymous access',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:401})));render(<ProtectedResults identifier="TEST" analytes={['Synthetic analyte']}/>);
 await screen.findByText('Sign in to view the actual results here.');expect(screen.queryByText('ND')).toBeNull();expect(screen.getByText('Sign in with work email →').getAttribute('href')).toContain('return_to=');
});
it('renders authorized source rows and the authenticated original-PDF link with TEST labels',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({sandbox:true,productionAuthority:false,results:[{analyte:'Synthetic analyte',resultText:'ND',unit:'ppb',loqText:'0.5 ppb',limitText:'',statusText:'',notes:''}]})));
 render(<ProtectedResults identifier="TEST" analytes={['Synthetic analyte']}/>);await screen.findByText('ND ppb');expect(screen.getAllByText('Not stated').length).toBe(2);expect(screen.getByText('Open original PDF ↗').getAttribute('href')).toBe('/api/test-reports/TEST/document');expect(screen.getByText('TEST · Light Labs approval pending')).toBeTruthy();
});
it('shows a denied state without a PDF link for a signed-in non-buyer',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:403})));render(<ProtectedResults identifier="TEST" analytes={['Synthetic']}/>);await screen.findByText('This account does not have company-email buyer access.');expect(screen.queryByText('Open original PDF ↗')).toBeNull();
});
