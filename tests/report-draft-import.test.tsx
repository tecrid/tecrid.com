import React from 'react';
import { it,expect,vi } from 'vitest';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { LegacyReportIntakeForm } from '../app/dashboard/reports/new/report-intake-form';
it('imports editable findings locally without assigning a lab contact or issuing',async()=>{
 const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
 render(<LegacyReportIntakeForm/>);
 const file={text:async()=>JSON.stringify({format:'tecrid-legacy-draft-v1',laboratoryName:'Example Lab',confirmationEmail:'untrusted@example.test',sampleName:'Historical sample',reportNumber:'EXAMPLE-12',sourceSha256:'a'.repeat(64),results:[{analyte:'Lead',resultText:'ND',unit:'ppb',loqText:'5.12 ppb'},{analyte:'Other',resultText:'NR',unit:'ppb',loqText:'0 ppb'}]})};
 fireEvent.change(screen.getByLabelText('Local JSON draft'),{target:{files:[file]}});
 await waitFor(()=>expect(screen.getByDisplayValue('Historical sample')).toBeTruthy());
 expect(screen.getByDisplayValue('ND')).toBeTruthy();expect(screen.getByDisplayValue('NR')).toBeTruthy();
 expect((screen.getByLabelText('Laboratory confirmation email') as HTMLInputElement).value).toBe('');
 expect(fetchMock).not.toHaveBeenCalled();vi.unstubAllGlobals();
});
