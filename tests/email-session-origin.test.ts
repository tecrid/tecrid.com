// @vitest-environment node
import {beforeEach,it,expect,vi} from 'vitest';
import {env} from './support/cloudflare-env';
const session=vi.hoisted(()=>vi.fn(async()=>({user:{id:'fixture',email:'USER@example.test',emailVerified:true,name:'Fixture'}})));
vi.mock('../lib/email-auth-factory',()=>({createEmailAuth:()=>({api:{getSession:session}})}));
vi.mock('../db',()=>({getDb:()=>({})}));
import {getEmailUser} from '../lib/email-auth';
beforeEach(()=>{session.mockClear();env.TECRID_AUTH_SECRET='test-only-secret';env.RESEND_API_KEY='test-only';env.TECRID_EMAIL_FROM='test@example.test';env.TECRID_AUTH_URL='http://internal.local';});
it.each([
 ['https://tecrid.com',{}],['https://www.tecrid.com',{}],['https://preview.example',{'x-forwarded-host':'preview.example'}],['https://host.example',{host:'host.example'}],
])('keeps verified email sessions for %s behind a proxy',async(origin,headers)=>{
 expect(await getEmailUser(new Headers({origin,...headers}))).toMatchObject({userId:'email:fixture',email:'user@example.test'});
 expect(session).toHaveBeenCalledOnce();
});
it('refuses hostile origins before loading the session',async()=>{
 expect(await getEmailUser(new Headers({origin:'https://evil.example',host:'tecrid.com'}))).toBeNull();
 expect(session).not.toHaveBeenCalled();
});
