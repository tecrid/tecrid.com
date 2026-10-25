// @vitest-environment node
import {beforeAll,afterAll,expect,it,vi} from 'vitest';
import {drizzle} from 'drizzle-orm/d1';
import {env} from './support/cloudflare-env';
import {evidenceFixture} from './support/evidence-fixture';
import * as schema from '../db/schema';
import {createEmailAuth} from '../lib/email-auth-factory';
let f:Awaited<ReturnType<typeof evidenceFixture>>;beforeAll(async()=>{f=await evidenceFixture();},60000);afterAll(async()=>{await f?.mf.dispose();});
it('authentication rejection logs do not echo user-controlled origin data',async()=>{const marker='synthetic-private-origin',messages:string[]=[],auth=createEmailAuth(drizzle(env.DB,{schema}),schema,{secret:'synthetic-session-'.repeat(4),baseURL:'https://tecrid.test',relaySecret:'synthetic-mail',issuanceSecret:'synthetic-issuance-'.repeat(4),relayURL:'https://relay.test/email'},async()=>Response.json({id:'synthetic'}));for(const method of ['error','warn','info','log'] as const)vi.spyOn(console,method).mockImplementation((...args)=>{messages.push(args.map(String).join(' '));});try{const r=await auth.handler(new Request('https://tecrid.test/api/auth/sign-in/magic-link',{method:'POST',headers:{origin:`https://${marker}.test`,'content-type':'application/json'},body:'{"email":"synthetic@privacy.test","callbackURL":"/"}'}));expect(r.status).toBe(403);expect(messages.join().includes(marker)).toBe(false);}finally{vi.restoreAllMocks();}});
