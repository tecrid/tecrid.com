import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProfileSettingsForm } from "../app/dashboard/settings/profile-settings-form";

const organization = { name: "Example Laboratory", code: "LAB / 1", website: "https://lab.example" };
const publicProfile = { displayName: organization.name, website: organization.website, summary: "Independent testing.", isPublic: true };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProfileSettingsForm", () => {
  it("updates the badge and removes the public destination after a successful private save", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      result: { ...publicProfile, isPublic: false },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ProfileSettingsForm organization={organization} profile={publicProfile} />);

    assert.equal(screen.getByRole("link", { name: "View public profile ↗" }).getAttribute("href"), "https://tecrid.com/participants/LAB%20%2F%201");
    fireEvent.click(screen.getByRole("checkbox", { name: /List this organization/i }));
    fireEvent.submit(screen.getByRole("button", { name: "Save profile settings →" }).closest("form")!);

    await waitFor(() => assert.ok(screen.getByText("Private")));
    assert.equal(screen.getByRole("link", { name: "View participant directory ↗" }).getAttribute("href"), "/participants");
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    assert.equal(JSON.parse(String(request.body)).isPublic, false);
  });

  it("shows the public badge and destination immediately after publishing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ result: publicProfile })));
    render(<ProfileSettingsForm organization={organization} profile={null} />);

    assert.ok(screen.getByText(/never makes private evidence public/i));
    assert.ok(screen.getByText(/does not publish TECRIDs or report findings/i));
    fireEvent.change(screen.getByRole("textbox", { name: "Public description" }), { target: { value: publicProfile.summary } });
    fireEvent.click(screen.getByRole("checkbox", { name: /List this organization/i }));
    fireEvent.submit(screen.getByRole("button", { name: "Save profile settings →" }).closest("form")!);

    await waitFor(() => assert.ok(screen.getByText("Public")));
    assert.equal(screen.getByRole("link", { name: "View public profile ↗" }).getAttribute("href"), "https://tecrid.com/participants/LAB%20%2F%201");
  });

  it("adopts normalized saved fields for display and the next submission", async () => {
    const normalized = {
      displayName: "Normalized Laboratory",
      website: "https://normalized.example",
      summary: "Normalized summary.",
      isPublic: true,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ result: normalized }))
      .mockResolvedValueOnce(Response.json({ result: normalized }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ProfileSettingsForm organization={organization} profile={publicProfile} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Public organization name" }), { target: { value: "Normalized Laboratory with text the server removes" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Website" }), { target: { value: "https://normalized.example/extra" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Public description" }), { target: { value: "Normalized summary with text the server removes." } });
    const form = screen.getByRole("button", { name: "Save profile settings →" }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => assert.equal((screen.getByRole("textbox", { name: "Public organization name" }) as HTMLInputElement).value, normalized.displayName));
    assert.equal((screen.getByRole("textbox", { name: "Website" }) as HTMLInputElement).value, normalized.website);
    assert.equal((screen.getByRole("textbox", { name: "Public description" }) as HTMLTextAreaElement).value, normalized.summary);

    fireEvent.submit(form);
    await waitFor(() => assert.equal(fetchMock.mock.calls.length, 2));
    const secondRequest = fetchMock.mock.calls[1][1] as RequestInit;
    assert.deepEqual(JSON.parse(String(secondRequest.body)), normalized);
  });

  it("re-enables saving when the request fails or returns malformed JSON", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response("not json", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ProfileSettingsForm organization={organization} profile={publicProfile} />);

    const form = screen.getByRole("button", { name: "Save profile settings →" }).closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => assert.equal(screen.getByRole("button", { name: "Save profile settings →" }).hasAttribute("disabled"), false));
    assert.ok(screen.getByText(/Check your connection and try again/i));

    fireEvent.submit(form);
    await waitFor(() => assert.equal(screen.getByRole("button", { name: "Save profile settings →" }).hasAttribute("disabled"), false));
    assert.ok(screen.getByText("The profile could not be saved."));
    assert.equal(fetchMock.mock.calls.length, 2);
  });
});
