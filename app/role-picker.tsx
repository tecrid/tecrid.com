"use client";
import { useState } from "react";
import { roles, type Role } from "../lib/roles";
import { useRole } from "./role-context";
export function RolePicker({ onboarding = false, returnTo = "/dashboard", preferredRole }: { onboarding?: boolean; returnTo?: string; preferredRole?: Role | null }) {
  const { role, chooseRole, hasWorkspace } = useRole();
  const [pending, setPending] = useState<Role | null>(null);
  const [message, setMessage] = useState("");
  async function choose(value: Role) {
    chooseRole(value);
    if (!onboarding) {
      if (hasWorkspace) { location.assign("/dashboard"); return; }
      location.assign(value === "public" ? "/verify" : `/join?role=${value}`);
      return;
    }
    setPending(value); setMessage("");
    try {
      const response = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: value }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We could not save your choice. Try again.");
      location.assign(value === "public" ? "/verify" : returnTo);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Check your connection and try again."); setPending(null); }
  }
  return <section className="role-picker" aria-labelledby="role-question">
    <p className="section-kicker">A place for you</p><h2 id="role-question">Who are you?</h2>
    <div className="role-choices">{roles.map(item => <button type="button" key={item.id} disabled={pending !== null} aria-pressed={(preferredRole ?? role) === item.id} onClick={() => choose(item.id)}>
      <span>{pending === item.id ? "Opening your workspace..." : item.label}</span>{" "}<small>{item.detail}</small><b aria-hidden="true">↗</b>
    </button>)}</div><p role="status">{message}</p>
  </section>;
}
