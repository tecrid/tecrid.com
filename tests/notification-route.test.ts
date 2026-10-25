import { beforeEach, expect, it, vi } from "vitest";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { POST } from "../app/api/notification-channels/route";
import { saveNotificationChannel } from "../lib/notification-delivery";
vi.mock("../app/chatgpt-auth", () => ({ getChatGPTUser: vi.fn() }));
vi.mock("../lib/notification-delivery", () => ({ saveNotificationChannel: vi.fn(), disableNotificationChannel: vi.fn(), notificationDashboard: vi.fn(), testNotificationChannel: vi.fn() }));
vi.mock("../lib/tec", () => ({ TecAuthorizationError: class extends Error { status = 403; }, TecInputError: class extends Error { status = 400; } }));
beforeEach(() => { vi.mocked(getChatGPTUser).mockReset(); vi.mocked(saveNotificationChannel).mockReset(); });
it("rejects anonymous channel changes", async () => {
 vi.mocked(getChatGPTUser).mockResolvedValue(null);
 expect((await POST(new Request("https://tecrid.com/api/notification-channels", { method: "POST", body: "{}" }))).status).toBe(401);
 expect(saveNotificationChannel).not.toHaveBeenCalled();
});
it("rejects cross-origin channel changes before authentication", async () => {
 expect((await POST(new Request("https://tecrid.com/api/notification-channels", { method: "POST", headers: { origin: "https://attacker.example.org" }, body: "{}" }))).status).toBe(403);
 expect(getChatGPTUser).not.toHaveBeenCalled();
});
