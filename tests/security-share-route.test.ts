// @vitest-environment node
import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('../app/chatgpt-auth',()=>({getChatGPTUser:vi.fn()}));
vi.mock('../lib/sharing',()=>({redeemEvidenceShareCode:vi.fn(async()=>({receipt:{id:'synthetic'}}))}));
import {getChatGPTUser} from '../app/chatgpt-auth';
import {redeemEvidenceShareCode} from '../lib/sharing';
import {POST} from '../app/api/v1/share-codes/redeem/route';
beforeEach(()=>{vi.mocked(getChatGPTUser).mockReset().mockResolvedValue(null);vi.mocked(redeemEvidenceShareCode).mockClear();});
const request=(origin='https://tecrid.test')=>new Request('https://tecrid.test/api/v1/share-codes/redeem',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'});
it('rejects anonymous redemption before constructing a package',async()=>{expect((await POST(request())).status).toBe(401);expect(redeemEvidenceShareCode).not.toHaveBeenCalled();});
it('rejects cross-origin session requests',async()=>{expect((await POST(request('https://other.test'))).status).toBe(403);expect(redeemEvidenceShareCode).not.toHaveBeenCalled();});
it('passes only the verified principal and returns private no-store',async()=>{const user={userId:'email:synthetic',email:'synthetic@security.test',displayName:'Synthetic',fullName:null};vi.mocked(getChatGPTUser).mockResolvedValue(user);const r=await POST(request());expect(r.status).toBe(200);expect(redeemEvidenceShareCode).toHaveBeenCalledWith({},user);expect(r.headers.get('cache-control')).toContain('no-store');});
