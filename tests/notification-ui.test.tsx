import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NotificationChannels } from "../app/dashboard/notifications/channels-client";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("submits the verified mailbox and recovers after a failed request", async () => {
 const send = vi.fn().mockRejectedValueOnce(Error("offline")).mockResolvedValueOnce(Response.json({ id: "email" }));
 vi.stubGlobal("fetch", send);
 render(<NotificationChannels channels={[]} vapidPublicKey={null} email="owner@example.org" />);
 const button = screen.getByRole("button", { name: "Add email" });
 const form = button.closest("form")!;
 fireEvent.submit(form);
 await waitFor(() => expect(screen.getByRole("status").textContent).toContain("offline"));
 expect(button.hasAttribute("disabled")).toBe(false);
 fireEvent.submit(form);
 await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Saved"));
 expect(JSON.parse(send.mock.calls[1][1].body)).toEqual({ kind: "email", label: "Verified email", email: "owner@example.org" });
});
it("requires server push configuration before asking for device permission", async () => {
 render(<NotificationChannels channels={[]} vapidPublicKey={null} email="owner@example.org" />);
 fireEvent.click(screen.getByRole("button", { name: "Add this phone or browser" }));
 await waitFor(() => expect(screen.getByRole("status").textContent).toContain("awaiting server configuration"));
});
it("sends a test only to the selected channel", async () => {
 const send = vi.fn().mockResolvedValue(Response.json({ eventId: "test-event" })); vi.stubGlobal("fetch", send);
 render(<NotificationChannels channels={[{ id: "owned", kind: "webhook", label: "Receiver", active: true }]} vapidPublicKey={null} email="owner@example.org" />);
 fireEvent.click(screen.getByRole("button", { name: "Send test" }));
 await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Test processed"));
 expect(JSON.parse(send.mock.calls[0][1].body)).toEqual({ action: "test", id: "owned" });
});
