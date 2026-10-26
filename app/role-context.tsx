"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { ROLE_COOKIE, type Role } from "../lib/roles";
type RoleState = { isApprover: boolean; role: Role; signedIn: boolean; hasWorkspace: boolean; chooseRole: (role: Role) => void };
const RoleContext = createContext<RoleState>({ isApprover: false, role: "public", signedIn: false, hasWorkspace: false, chooseRole: () => {} });
export function RoleProvider({ children, initialRole, signedIn, hasWorkspace, isApprover=false }: { children: ReactNode; initialRole: Role; signedIn: boolean; hasWorkspace: boolean; isApprover?: boolean }) {
  const [role, setRole] = useState(initialRole);
  function chooseRole(value: Role) {
    // A display preference only. Server authorization always uses membership.
    document.cookie = `${ROLE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    if (!hasWorkspace) setRole(value);
  }
  return <RoleContext.Provider value={{ isApprover, role, signedIn, hasWorkspace, chooseRole }}>{children}</RoleContext.Provider>;
}
export const useRole = () => useContext(RoleContext);
