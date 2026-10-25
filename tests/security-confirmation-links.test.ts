// @vitest-environment node
import {beforeAll,beforeEach,afterAll,expect,it,vi} from 'vitest';
import {eq} from 'drizzle-orm';
import {evidenceFixture} from './support/evidence-fixture';
import {getDb} from '../db';
import {legacyReports} from '../db/schema';
import {createLegacyReport,getLegacyConfirmation,getLegacyReportForUser} from '../lib/legacy-reports';
let f:Awaited<ReturnType<typeof evidenceFixture>>,id:string,token:string;
beforeAll(async()=>{f=await evidenceFixture();},60000);afterAll(async()=>{await f?.mf.dispose();});
beforeEach(async()=>{vi.restoreAllMocks();const form=new FormData();form.set('document',new File(['%PDF-1.7 synthetic confirmation only '+crypto.randomUUID()],'synthetic.pdf'));for(const [k,v] of Object.entries({laboratoryName:'Synthetic lab',confirmationEmail:f.lab.email,sampleName:'Synthetic sample',reportNumber:crypto.randomUUID(),testedAt:'2026-01-01',results:JSON.stringify([{analyte:'Synthetic',resultText:'ND',unit:'test'}]),attested:'on'}))form.set(k,v);const made=await createLegacyReport(f.brand,form);id=made.id;token=made.confirmationPath.split('/').at(-1)!;});
it('current named mailbox can read an unexpired confirmation',async()=>{expect(await getLegacyConfirmation(f.lab,token)!==null).toBe(true);});
it('old confirmation links expire even for their named mailbox',async()=>{vi.spyOn(Date,'now').mockReturnValue(Date.now()+25*3600000);expect(await getLegacyConfirmation(f.lab,token)===null).toBe(true);});
for(const status of ['withdrawn','declined'])it(`confirmation reads fail after ${status}, with ordinary controller audit retained`,async()=>{await getDb().update(legacyReports).set({status}).where(eq(legacyReports.id,id));expect(await getLegacyConfirmation(f.lab,token)===null).toBe(true);expect(await getLegacyReportForUser(f.brand,id)!==null).toBe(true);});
