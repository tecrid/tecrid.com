// @vitest-environment node
import {it,expect,vi} from 'vitest';
vi.mock('../app/chatgpt-auth',()=>({getChatGPTUser:async()=>null}));
import {GET,POST} from '../app/api/sandbox/lab/reports/[identifier]/route';
import {GET as publicResolver} from '../app/api/v1/credentials/[identifier]/route';
import {sampleLabReference,sampleLabReports} from '../lib/sample-lab';
const params=Promise.resolve({identifier:sampleLabReports[0].testIdentifier});
it('serves only public test references to anonymous callers',async()=>{
 const r=await GET(new Request('https://tecrid.com/api/sandbox/lab/reports/test'),{params});const body=await r.json();expect(body.canonicalPayload).toBeNull();expect(body.personalProof).toBeNull();expect(body.reference.productionAuthority).toBe(false);
 const resolver=await publicResolver(new Request('https://tecrid.com/api/v1/credentials/test'),{params});expect(resolver.headers.get('x-tecrid-sandbox')).toBe('true');expect((await resolver.json()).productionTecrid).toBeNull();
});
it('rejects anonymous signing, production keys, and cross-origin writes',async()=>{
 const url='https://tecrid.com/api/sandbox/lab/reports/test';
 expect((await POST(new Request(url,{method:'POST',body:'{}'}),{params})).status).toBe(401);
 expect((await POST(new Request(url,{method:'POST',headers:{authorization:'Bearer tec_live_test'},body:'{}'}),{params})).status).toBe(401);
 expect((await POST(new Request(url,{method:'POST',headers:{origin:'https://other.test'},body:'{}'}),{params})).status).toBe(403);
});

it("resolves URL-encoded test IDs without treating malformed input as a record",()=>{
 const id=sampleLabReports[0].testIdentifier;
 expect(sampleLabReference(encodeURIComponent(id))?.testIdentifier).toBe(id);
 expect(sampleLabReference("%invalid")).toBeNull();
});
