import { afterEach, expect, it, vi } from "vitest";
import JoinPage from "../app/join/page";
import { getOrganizationForUser } from "../lib/tec";
vi.mock("next/navigation", () => ({ usePathname: () => "/join", redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("../app/chatgpt-auth", () => ({ getChatGPTUser: async () => ({ userId: "fixture-user", email: "fixture@example.test" }) }));
vi.mock("../lib/tec", () => ({ getOrganizationForUser: vi.fn(async () => null) }));
vi.mock("../lib/email-auth", () => ({ emailAuthReady: () => false }));
afterEach(() => { vi.mocked(getOrganizationForUser).mockResolvedValue(null as never); });
it("preserves a laboratory choice for someone already signed in without a workspace", async () => {
  await expect(JoinPage({ searchParams: Promise.resolve({ role: "laboratory" }) })).rejects.toThrow("redirect:/welcome?role=laboratory");
});
it("rejects an unknown role in an authenticated join link", async () => {
  await expect(JoinPage({ searchParams: Promise.resolve({ role: "admin" }) })).rejects.toThrow("redirect:/welcome");
});
it("returns existing members to their workspace instead of changing their organization type", async () => {
  vi.mocked(getOrganizationForUser).mockResolvedValue({ organization: { organizationType: "brand" } } as never);
  await expect(JoinPage({ searchParams: Promise.resolve({ role: "laboratory" }) })).rejects.toThrow("redirect:/dashboard");
});
