// @vitest-environment node
import {beforeEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({session:vi.fn(),email:vi.fn(),own:vi.fn(),vle:vi.fn()}));
vi.mock('../app/chatgpt-auth',()=>({getChatGPTUser:mocks.session}));
vi.mock('../lib/email-auth',()=>({getEmailUser:mocks.email}));
vi.mock('../lib/notifications',()=>({inboxHeaders:{'Cache-Control':'private, no-store'},ownNotifications:mocks.own,vleNotifications:mocks.vle}));
import {POST} from '../app/api/notifications/route';
import {env} from './support/cloudflare-env';
const user={userId:'alice',email:'alice@example.test'},emailUser={userId:'email:alice',email:user.email};
const request=(origin:string|null='https://tecrid.com',body:unknown={action:'read-all'})=>new Request('https://tecrid.com/api/notifications',{method:'POST',headers:{...(origin?{origin}:{}),'content-type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();mocks.session.mockResolvedValue(user);mocks.email.mockResolvedValue(emailUser);mocks.own.mockResolvedValue([{id:'tecrid:a',createdAt:'2026-11-10',read:true}]);mocks.vle.mockResolvedValue([{id:'vle:b',createdAt:'2026-11-09',read:true}]);});
it('marks both sources using session identities and returns refreshed personal unread state',async()=>{
 const response=await POST(request('https://tecrid.com',{action:'read-all',actor:{email:'stranger@example.test'}}));
 expect(response.status).toBe(200);expect(mocks.own).toHaveBeenCalledWith(env.DB,user,undefined,false,true);expect(mocks.vle).toHaveBeenCalledWith(emailUser,undefined,undefined,true);
 expect(await response.json()).toMatchObject({unreadCount:0,vleConnected:true,items:[{id:'tecrid:a'},{id:'vle:b'}]});expect(response.headers.get('cache-control')).toContain('no-store');
});
it('requires authentication and same-origin for bulk reads',async()=>{
 for(const origin of [null,'https://evil.test'])expect((await POST(request(origin))).status).toBe(403);
 expect(mocks.own).not.toHaveBeenCalled();mocks.session.mockResolvedValue(null);expect((await POST(request())).status).toBe(401);
});
it('does not access VLE without a verified work-email session',async()=>{mocks.email.mockResolvedValue(null);expect((await POST(request())).status).toBe(200);expect(mocks.vle).not.toHaveBeenCalled();});
it('reports partial bulk failures instead of claiming success',async()=>{mocks.vle.mockRejectedValue(Error('Unavailable'));expect((await POST(request())).status).toBe(503);});
it('rejects unknown actions',async()=>{expect((await POST(request('https://tecrid.com',{action:'delete-all'}))).status).toBe(400);expect(mocks.own).not.toHaveBeenCalled();});
