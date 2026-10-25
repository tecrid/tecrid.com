"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { ROLE_COOKIE, type Role } from "../lib/roles";
type RoleState = { role: Role; signedIn: boolean; hasWorkspace: boolean; chooseRole: (role: Role) => void };
const RoleContext = createContext<RoleState>({ role: "public", signedIn: false, hasWorkspace: false, chooseRole: () => {} });
export function RoleProvider({ children, initialRole, signedIn, hasWorkspace }: { children: ReactNode; initialRole: Role; signedIn: boolean; hasWorkspace: boolean }) {
  const [role, setRole] = useState(initialRole);
  function chooseRole(value: Role) {
    // A display preference only. Server authorization always uses membership.
    document.cookie = `${ROLE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    if (!hasWorkspace) setRole(value);
  }
  return <RoleContext.Provider value={{ role, signedIn, hasWorkspace, chooseRole }}>{children}</RoleContext.Provider>;
}
export const useRole = () => useContext(RoleContext);
