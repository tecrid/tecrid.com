// @vitest-environment node
import {beforeEach, expect, it, vi} from 'vitest';
const state = vi.hoisted(() => ({headers: new Headers()}));
vi.mock('next/headers', () => ({headers: async () => state.headers}));
vi.mock('../lib/email-auth', () => ({getEmailUser: vi.fn(async () => null)}));
import {getEmailUser} from '../lib/email-auth';
import {getChatGPTUser} from '../app/chatgpt-auth';
beforeEach(() => {state.headers = new Headers(); vi.mocked(getEmailUser).mockReset().mockResolvedValue(null);});
for (const host of ['tecrid.com', 'www.tecrid.com', 'tec-registry.kmfp.chatgpt.site', 'alternate-origin.workers.dev']) {
 for (const cookie of ['', 'tecrid.session_token=forged', '__Secure-tecrid.session_token=forged']) {
  it(`rejects unsigned administrator headers on ${host} with ${cookie ? 'invalid cookie' : 'no cookie'}`, async () => {
   state.headers = new Headers({host, cookie, 'oai-authenticated-user-id':'forged-owner', 'oai-authenticated-user-email':'admin@example.test', 'oai-authenticated-user-full-name':'Forged%20Admin', 'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'});
   expect(await getChatGPTUser()).toBeNull();
  });
 }
}
it('uses only the verified session principal when identity headers disagree', async () => {
 state.headers = new Headers({cookie:'__Secure-tecrid.session_token=valid', 'oai-authenticated-user-id':'forged-owner', 'oai-authenticated-user-email':'admin@example.test'});
 const user = {userId:'email:verified-user', email:'member@example.test', displayName:'Member', fullName:null};
 vi.mocked(getEmailUser).mockResolvedValue(user);
 expect(await getChatGPTUser()).toEqual(user);
 expect(getEmailUser).toHaveBeenCalledWith(state.headers);
});
it('fails closed when session verification throws', async () => {
 state.headers = new Headers({cookie:'tecrid.session_token=invalid', 'oai-authenticated-user-id':'forged', 'oai-authenticated-user-email':'admin@example.test'});
 vi.mocked(getEmailUser).mockRejectedValue(new Error('Session backend unavailable'));
 await expect(getChatGPTUser()).rejects.toThrow('Session backend unavailable');
});
