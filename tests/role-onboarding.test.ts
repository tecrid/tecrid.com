// @vitest-environment node
import { it, expect } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { env } from "./support/cloudflare-env";
import { onboardOrganization, completeWorkspaceDetails, getOrganizationForUser } from "../lib/tec";
import { reserveReportTecrid } from "../lib/report-issuance";
import { roles } from "../lib/roles";
it("saves all six roles without identity fields, defers real details, and never approves a lab", async () => {
  const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: "2026-05-22", d1Databases: ["DB"] });
  try {
    const db = await mf.getD1Database("DB"); env.DB = db;
    for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) for (const sql of readFileSync(`drizzle/${file}`, "utf8").split("--> statement-breakpoint")) if (sql.trim()) await db.prepare(sql).run();
    for (const role of roles) {
      const user = { userId: `fixture-${role.id}`, email: `${role.id}@example.test`, displayName: "Test only", fullName: null };
      const membership = (await onboardOrganization(user, { role: role.id }))!;
      expect(membership.organization.organizationType).toBe(role.id === "public" ? "other" : role.id);
      expect(membership.organization.slug).toMatch(/^setup--/);
      expect(membership.organization.issuerStatus).toBe(role.id === "laboratory" ? "pending" : "not_applicable");
      // A retry or changed browser preference never changes organization type or creates a second workspace.
      expect((await onboardOrganization(user, { role: "laboratory" }))!.organization.id).toBe(membership.organization.id);
      expect((await getOrganizationForUser(user.userId))!.organization.organizationType).toBe(membership.organization.organizationType);
      await expect(completeWorkspaceDetails({ ...user, userId: "outsider" }, { name: "Forged" })).rejects.toThrow("Only the workspace owner");
      await expect(completeWorkspaceDetails(user, { name: "Fixture", website: "javascript:alert(1)" })).rejects.toThrow();
      const completed = (await completeWorkspaceDetails(user, { name: `Fixture ${role.label}`, website: "https://example.test" }))!;
      expect(completed.organization.slug).not.toMatch(/^setup--/);
      expect(completed.organization.issuerStatus).toBe(membership.organization.issuerStatus);
      expect(completed.organization.issuerCode).toBe(membership.organization.issuerCode);
      await expect(completeWorkspaceDetails(user, { name: "Change legal name" })).rejects.toThrow("already set");
      await expect(reserveReportTecrid(completed.organization, { productName: "Fixture", productSku: "TEST" })).rejects.toThrow();
    }
    const user = { userId: "invalid-role", email: "invalid@example.test", displayName: "Fixture", fullName: null };
    await expect(onboardOrganization(user, { role: "admin" })).rejects.toThrow("Choose who you are");
    expect(await getOrganizationForUser(user.userId)).toBeNull();
    expect((await db.prepare("SELECT count(*) AS total FROM audit_events WHERE event_type='organization.details_completed'").first<{total:number}>())!.total).toBe(6);
    expect((await db.prepare("SELECT count(*) AS total FROM credentials").first<{total:number}>())!.total).toBe(0);
  } finally { await mf.dispose(); }
}, 60000);
