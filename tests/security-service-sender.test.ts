// @vitest-environment node
import {beforeEach,expect,it,vi} from 'vitest';
import {env} from './support/cloudflare-env';
vi.mock('../lib/email-auth',()=>({getEmailUser:async()=>({userId:'email:synthetic',email:'synthetic@security.test'})}));
import {protectedTestReport} from '../lib/test-report-access';
import {kasandrinosTestWorkspace} from '../lib/kasandrinos-test-workspace';
import {sampleLabReports} from '../lib/sample-lab';
beforeEach(()=>{for(const k of Object.keys(env))delete env[k];env.TECRID_EMAIL_RELAY_SECRET='synthetic-mail-only-secret-32-characters';});
it('mail-only configuration cannot send privileged report reads',async()=>{const transport=vi.fn(async()=>new Response(null,{status:403}));expect((await protectedTestReport(new Request('https://tecrid.com/test'),sampleLabReports[0].testIdentifier,'card',transport)).status).toBe(503);expect(transport).not.toHaveBeenCalled();});
it('mail-only configuration cannot send permission changes',async()=>{const transport=vi.fn(async()=>Response.json({ok:true}));expect((await kasandrinosTestWorkspace(new Request('https://tecrid.com/api/kasandrinos-test',{method:'POST',headers:{origin:'https://tecrid.com'},body:JSON.stringify({action:'grant'})}),transport)).status).toBe(503);expect(transport).not.toHaveBeenCalled();});
