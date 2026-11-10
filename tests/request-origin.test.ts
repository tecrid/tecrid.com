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
