import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MobileNavigation } from "../app/mobile-navigation";

const route = vi.hoisted(() => ({ pathname: "/dashboard/settings" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
afterEach(cleanup);

it("keeps Workspace active on a nested route and closes More on navigation", () => {
  const { container, rerender } = render(<MobileNavigation />);
  expect(screen.getByRole("link", { name: "Workspace" }).getAttribute("aria-current")).toBe("page");
  const menu = container.querySelector("details")!;
  menu.open = true;
  route.pathname = "/verify";
  rerender(<MobileNavigation />);
  expect(menu.open).toBe(false);
  expect(screen.getByRole("link", { name: "Verify", exact: true }).getAttribute("aria-current")).toBe("page");
});

it("dismisses More with Escape, restores focus, and dismisses on an outside tap", () => {
  const { container } = render(<MobileNavigation />);
  const menu = container.querySelector("details")!;
  menu.open = true;
  fireEvent.keyDown(document, { key: "Escape" });
  expect(menu.open).toBe(false);
  expect(document.activeElement).toBe(container.querySelector("summary"));
  menu.open = true;
  fireEvent.pointerDown(document.body);
  expect(menu.open).toBe(false);
});
