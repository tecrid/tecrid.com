// @vitest-environment node
import {it,expect,vi,beforeEach} from 'vitest';
import {env} from './support/cloudflare-env';
const identity=vi.hoisted(()=>({user:null as any}));vi.mock('../lib/email-auth',()=>({getEmailUser:async()=>identity.user}));
import {kasandrinosTestWorkspace} from '../lib/kasandrinos-test-workspace';
beforeEach(()=>{identity.user=null;env.TECRID_EMAIL_RELAY_SECRET='synthetic-service-secret';});
it('blocks forged identity headers, sandbox keys and anonymous management',async()=>{
 const transport=vi.fn();const req=new Request('https://tecrid.com/api/kasandrinos-test',{headers:{'x-user-email':'karen@paleofoundation.com',authorization:'Bearer test-key'}});expect((await kasandrinosTestWorkspace(req,transport)).status).toBe(401);expect(transport).not.toHaveBeenCalled();
});
it('rejects cross-origin writes even for a signed-in owner',async()=>{
 identity.user={userId:'email:owner',email:'owner@company.test'};const transport=vi.fn();for(const origin of [null,'https://evil.test']){const r=await kasandrinosTestWorkspace(new Request('https://tecrid.com/api/kasandrinos-test',{method:'POST',headers:origin?{origin}:{},body:JSON.stringify({action:'revoke'})}),transport);expect(r.status).toBe(403);}expect(transport).not.toHaveBeenCalled();
});
it('forwards verified session identity, overriding client actor claims, and preserves private caching',async()=>{
 identity.user={userId:'email:viewer',email:'viewer@company.test'};
 const input={action:'grant',email:'recipient@company.test',actor:{email:'owner@company.test',userId:'email:owner',emailVerified:true}};
 const transport=vi.fn(async(_url:any,o:any)=>{expect(JSON.parse(o.body).actor).toEqual({...identity.user,emailVerified:true});return Response.json({error:'Manager required.'},{status:403});});
 const r=await kasandrinosTestWorkspace(new Request('https://tecrid.com/api/kasandrinos-test',{method:'POST',headers:{origin:'https://tecrid.com'},body:JSON.stringify(input)}),transport);expect(r.status).toBe(403);expect(r.headers.get('cache-control')).toContain('no-store');expect(r.headers.get('vary')).toBe('Cookie');
});
it('retains stale-write conflicts and fails closed when the permissions service is unavailable',async()=>{
 identity.user={userId:'email:owner',email:'owner@company.test'};const req=new Request('https://tecrid.com/api/kasandrinos-test');expect((await kasandrinosTestWorkspace(req,async()=>Response.json({error:'Refresh'},{status:409}))).status).toBe(409);expect((await kasandrinosTestWorkspace(req,async()=>{throw Error();})).status).toBe(503);
});
