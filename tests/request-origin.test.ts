import { describe, expect, it } from "vitest";
import { rejectCrossOriginWrite } from "../lib/request-security";

const post = (url: string, headers: Record<string, string>) => new Request(url, { method: "POST", headers });

describe("rejectCrossOriginWrite", () => {
  it("allows tecrid.com and www when the proxy rewrites the internal host", () => {
    expect(rejectCrossOriginWrite(post("http://internal.local/api/email-signout", { origin: "https://tecrid.com" }))).toBeNull();
    expect(rejectCrossOriginWrite(post("http://internal.local/api/email-signout", { origin: "https://www.tecrid.com" }))).toBeNull();
    expect(rejectCrossOriginWrite(post("http://internal.local/x", { origin: "https://preview.example", "x-forwarded-host": "preview.example" }))).toBeNull();
  });
  it("still refuses other sites", () => {
    expect(rejectCrossOriginWrite(post("https://tecrid.com/api/email-signout", { origin: "https://evil.example", host: "tecrid.com" }))?.status).toBe(403);
  });
});

describe("rejectCrossOriginWrite with Origin null", () => {
  it("allows a same-origin form post sent with Origin null", () => {
    const req = new Request("https://internal.example/api/email-signout", { method: "POST", headers: { origin: "null", "sec-fetch-site": "same-origin" } });
    expect(rejectCrossOriginWrite(req)).toBeNull();
  });
  it("refuses Origin null from another site", () => {
    const req = new Request("https://internal.example/api/email-signout", { method: "POST", headers: { origin: "null", "sec-fetch-site": "cross-site" } });
    expect(rejectCrossOriginWrite(req)?.status).toBe(403);
  });
  it("refuses Origin null with no fetch metadata", () => {
    const req = new Request("https://internal.example/api/email-signout", { method: "POST", headers: { origin: "null" } });
    expect(rejectCrossOriginWrite(req)?.status).toBe(403);
  });
});
describe('sameSiteOrigin', () => {
  it.each([
    ['http://localhost:3100', {}],
    ['https://tecrid.com', {}],
    ['https://www.tecrid.com', {}],
    ['https://preview.example', {'x-forwarded-host':'preview.example, internal.local'}],
    ['https://preview.example', {host:'preview.example'}],
  ])('accepts %s with a rewritten proxy URL', async (origin, headers) => {
    const {sameSiteOrigin}=await import('../lib/request-security');
    const url=origin.startsWith('http://localhost')?origin+'/x':'http://internal.local/x';
    expect(sameSiteOrigin(origin, post(url, headers))).toBe(true);
  });
  it.each([null, 'null', 'https://evil.example', 'https://tecrid.com.evil.example', 'http://tecrid.com'])('rejects %s', async origin => {
    const {sameSiteOrigin}=await import('../lib/request-security');
    expect(sameSiteOrigin(origin, post('http://internal.local/x', {host:'tecrid.com'}))).toBe(false);
  });
});

it('confirms magic links using the accepted public origin behind the proxy', async()=>{
  const {confirmMagicLink}=await import('../lib/magic-link-confirm');
  let verification:Request|undefined;
  const response=await confirmMagicLink(new Request('http://internal.local/api/auth/magic-link/confirm',{method:'POST',headers:{origin:'https://tecrid.com'},body:JSON.stringify({token:'test',callbackURL:'https://tecrid.com/dashboard'})}),{handler:async request=>{verification=request;return new Response(null,{status:302,headers:{location:'https://tecrid.com/dashboard'}});}});
  expect(response.status).toBe(200);
  expect(new URL(verification!.url).origin).toBe('https://tecrid.com');
  const hostile=await confirmMagicLink(new Request('http://internal.local/x',{method:'POST',headers:{origin:'https://evil.example'}}),{handler:async()=>{throw Error('must not exchange token');}});
  expect(hostile.status).toBe(403);
});
