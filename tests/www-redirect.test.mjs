import assert from "node:assert/strict";
import test from "node:test";
import worker from "../dist/server/index.js";

for (const path of ["/", "/faq?source=www&value=a%2Fb", "/api/v1/records?x=1&x=2", "/_vinext/image?url=%2Flogo.png&w=640"]) {
  test(`www redirects ${path} before routing`, async () => {
    const response = await worker.fetch(new Request(`https://www.tecrid.com${path}`, { method: "POST", body: "preserved" }), {}, {});
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), `https://tecrid.com${path}`);
  });
}
