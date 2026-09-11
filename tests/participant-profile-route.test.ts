import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { POST } from "../app/api/participant-profile/route";
import { upsertParticipantProfile } from "../lib/sharing";

vi.mock("../app/chatgpt-auth", () => ({ getChatGPTUser: vi.fn() }));
vi.mock("../lib/sharing", () => ({ upsertParticipantProfile: vi.fn() }));
vi.mock("../lib/tec", () => ({
  TecAuthorizationError: class TecAuthorizationError extends Error { status = 403; },
  TecInputError: class TecInputError extends Error { status = 400; },
}));

const user = { userId: "user-1", email: "lab@example.com", displayName: "Lab User", fullName: "Lab User" };

beforeEach(() => {
  vi.mocked(getChatGPTUser).mockReset();
  vi.mocked(upsertParticipantProfile).mockReset();
});

describe("POST /api/participant-profile", () => {
  it("rejects unauthenticated writes", async () => {
    vi.mocked(getChatGPTUser).mockResolvedValue(null);
    const response = await POST(new Request("https://tecrid.com/api/participant-profile", { method: "POST", body: "{}" }));

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Sign in is required." });
    assert.equal(vi.mocked(upsertParticipantProfile).mock.calls.length, 0);
  });

  it("returns the saved visibility from an authenticated same-origin write", async () => {
    const result = { displayName: "Example Lab", website: null, summary: "Testing", isPublic: false, publicSlug: "example-lab", updatedAt: "2026-08-31" };
    vi.mocked(getChatGPTUser).mockResolvedValue(user);
    vi.mocked(upsertParticipantProfile).mockResolvedValue(result);
    const response = await POST(new Request("https://tecrid.com/api/participant-profile", {
      method: "POST",
      headers: { origin: "https://tecrid.com", "content-type": "application/json" },
      body: JSON.stringify({ isPublic: false }),
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { result });
    assert.deepEqual(vi.mocked(upsertParticipantProfile).mock.calls[0], [user, { isPublic: false }]);
  });

  it("rejects cross-origin writes before authentication or persistence", async () => {
    const response = await POST(new Request("https://tecrid.com/api/participant-profile", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: "{}",
    }));

    assert.equal(response.status, 403);
    assert.equal(vi.mocked(getChatGPTUser).mock.calls.length, 0);
    assert.equal(vi.mocked(upsertParticipantProfile).mock.calls.length, 0);
  });
});
