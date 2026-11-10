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
