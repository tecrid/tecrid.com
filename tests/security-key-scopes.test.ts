// @vitest-environment node
import {beforeAll,afterAll,expect,it} from 'vitest';
import {eq} from 'drizzle-orm';
import {evidenceFixture} from './support/evidence-fixture';
import {getDb} from '../db';
import {apiKeys,organizations} from '../db/schema';
import {createApiKey,authenticateApiRequest} from '../lib/tec';
let f:Awaited<ReturnType<typeof evidenceFixture>>;
beforeAll(async()=>{f=await evidenceFixture();},60000);
afterAll(async()=>{await f?.mf.dispose();});
for(const scope of ['credentials:write','reports:write','legacy:write','*'])it(`rejects non-laboratory ${scope} key creation`,async()=>{expect(await createApiKey(f.brand,'Synthetic',[scope]).then(()=>200,(e:{status:number})=>e.status)).toBe(403);});
it('pending labs cannot create production write keys',async()=>{await getDb().update(organizations).set({issuerStatus:'pending'}).where(eq(organizations.id,f.lab.userId));expect(await createApiKey(f.lab,'Synthetic',['credentials:write']).then(()=>200,(e:{status:number})=>e.status)).toBe(403);await getDb().update(organizations).set({issuerStatus:'verified'}).where(eq(organizations.id,f.lab.userId));});
it('legacy non-lab wildcard keys cannot authorize write routes',async()=>{const key=await createApiKey(f.brand,'Synthetic',['read']);await getDb().update(apiKeys).set({scopes:'["*"]'}).where(eq(apiKeys.id,key.id));const req=new Request('https://tecrid.com/api/v1/credentials',{method:'POST',headers:{authorization:`Bearer ${key.plainTextKey}`}});expect(await authenticateApiRequest(req).then(()=>200,(e:{status:number})=>e.status)).toBe(403);});
it('verified labs retain known write scopes and cannot use wildcard on unknown write routes',async()=>{const key=await createApiKey(f.lab,'Synthetic',['*']);expect((await authenticateApiRequest(new Request('https://tecrid.com/api/v1/credentials',{method:'POST',headers:{authorization:`Bearer ${key.plainTextKey}`}}))).organization.id).toBe(f.lab.userId);expect(await authenticateApiRequest(new Request('https://tecrid.com/api/v1/unmapped',{method:'POST',headers:{authorization:`Bearer ${key.plainTextKey}`}})).then(()=>200,(e:{status:number})=>e.status)).toBe(403);});
