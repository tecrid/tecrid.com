import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MobileNavigation } from "../app/mobile-navigation";
import { RoleProvider } from "../app/role-context";
import { roles, roleNavigation } from "../lib/roles";
const route = vi.hoisted(() => ({ pathname: "/dashboard/settings" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
afterEach(cleanup);
it.each(roles)("shows only the $label destinations, without a More menu", ({id}) => {
  const {container} = render(<RoleProvider initialRole={id} signedIn={false} hasWorkspace={false}><MobileNavigation /></RoleProvider>);
  const links = screen.getAllByRole("link");
  expect(links.map(link => link.textContent?.slice(1))).toEqual(roleNavigation(id).map(item => item.label));
  expect(links.length).toBe(id === "public" ? 3 : 4);
  expect(container.querySelector("details")).toBeNull();
});
it("marks the current role destination on nested settings pages", () => {
  render(<RoleProvider initialRole="brand" signedIn hasWorkspace><MobileNavigation /></RoleProvider>);
  expect(screen.getByRole("link", {name:"Settings"}).getAttribute("aria-current")).toBe("page");
  expect(screen.queryByRole("link", {name:"Issue"})).toBeNull();
});
