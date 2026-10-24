import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { getDashboardData } from "../lib/tec";
import DashboardPage from "../app/dashboard/page";
import { WorkspaceSidebar } from "../app/dashboard/workspace-sidebar";

vi.mock("../app/chatgpt-auth", () => ({
  requireChatGPTUser: vi.fn(async () => ({ userId: "user-1", email: "lab@example.com", displayName: "Lab User" })),
  chatGPTSignOutPath: vi.fn(() => "/signout"),
}));
vi.mock("../lib/tec", () => ({ getDashboardData: vi.fn() }));
vi.mock("../lib/legacy-reports", () => ({ listLegacyReportsForUser: vi.fn(async () => []) }));
vi.mock("../app/site-nav", () => ({ ProductNav: () => null, ProductFooter: () => null }));
vi.mock("../app/dashboard/dashboard-client", () => ({ ApiKeyPanel: () => null, OrganizationOnboarding: () => null }));
vi.mock("../app/dashboard/issuer-application", () => ({ IssuerApplicationPanel: () => null }));

const organization = {
  name: "Example Laboratory",
  issuerCode: "LAB-1",
  organizationType: "laboratory",
  issuerStatus: "needs_information",
  plan: "free",
};

afterEach(cleanup);

describe("laboratory verification progress", () => {
  it.each([
    ["submitted", "ICS review in progress"],
    ["needs_information", "Update verification application"],
    ["rejected", "Submit a replacement application"],
  ])("renders the %s dashboard action", async (applicationStatus, expected) => {
    vi.mocked(getDashboardData).mockResolvedValue({
      organization,
      issuerApplication: { status: applicationStatus },
      keys: [],
      records: [],
      issuerDocuments: [],
      issuerChecks: [],
      foundingLaunch: null,
    } as never);

    render(await DashboardPage());
    assert.ok(screen.getAllByText(expected).length >= 1);
  });

  it.each([
    ["submitted", "Verification in review"],
    ["needs_information", "Submit requested information"],
    ["rejected", "Restart verification"],
  ])("renders the %s sidebar action", (applicationStatus, expected) => {
    render(<WorkspaceSidebar
      organization={{ name: organization.name, code: organization.issuerCode, type: "laboratory", issuerStatus: "needs_information", plan: "free" }}
      progress={{ applicationStatus, hasApiKey: false, hasCredential: false }}
      user={{ displayName: "Lab User", email: "lab@example.com" }}
      signOutHref="/signout"
    />);
    assert.ok(screen.getAllByRole("link", { name: expected }).length >= 1);
  });
});
