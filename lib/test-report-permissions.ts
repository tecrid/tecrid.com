/* eslint-disable @typescript-eslint/no-explicit-any -- D1 rows are untyped; shapes are validated at use. */
// Kasandrinos TEST report permissions, owned by TECRID. This replaces the former
// calls to VLE's /api/tecrid-report-permissions and /api/tecrid-report-access.
// TECRID never calls VLE. Table names match the VLE tables so existing rows can
// be copied once during cutover.
import { env } from "cloudflare:workers";
import { sampleLabReports, sampleLabReference } from "./sample-lab";
import { emailConfigFrom, emailConfigured, sendEmail } from "./email-sender";
import { privateFetch } from "./private-fetch";

type Db = D1Database;
type Actor = { userId: string; email: string };
export const KAS_CONTROLLER_ORG = "org_test_kasandrinos";
export const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: privateHeaders });
const emailValue = (v: unknown) => typeof v === "string" && v.length <= 254 && /^[^\s@<>]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(v.trim().toLowerCase()) ? v.trim().toLowerCase() : null;
export const testReports = sampleLabReports;
const reportTitle = (r: (typeof sampleLabReports)[number]) => sampleLabReference(r.testIdentifier)?.reportDetails?.assay ?? "Test report";

function bindings() { return env as unknown as Record<string, any>; }
function allowlist() {
  return String(bindings().TECRID_KAS_TEST_CONTROLLER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

// Authority: an explicit controller allowlist, or an owner/administrator of the
// Kasandrinos TEST organization in TECRID. Never a domain match.
export async function reportManagerRole(db: Db, user: Actor | null) {
  if (!user) return null;
  const email = user.email.toLowerCase();
  if (allowlist().includes(email)) return "owner";
  const row = await db.prepare("SELECT role FROM organization_members WHERE organization_id=? AND lower(email)=? AND role IN ('owner','admin') ORDER BY role='owner' DESC LIMIT 1").bind(KAS_CONTROLLER_ORG, email).first<{ role: string }>();
  return row?.role ?? null;
}
export async function controllerEmails(db: Db) {
  const rows = (await db.prepare("SELECT DISTINCT lower(email) AS email FROM organization_members WHERE organization_id=? AND role IN ('owner','admin')").bind(KAS_CONTROLLER_ORG).all<{ email: string }>()).results;
  return [...new Set([...allowlist(), ...rows.map((r) => r.email).filter(Boolean)])].slice(0, 10);
}

export async function reportPermission(db: Db, user: Actor, reportNumber: string, knownRole: string | null | undefined = undefined) {
  const role = knownRole === undefined ? await reportManagerRole(db, user) : knownRole;
  const row = await db.prepare("SELECT * FROM kas_report_permissions WHERE report_number=? AND recipient_email=?").bind(reportNumber, user.email.toLowerCase()).first<any>();
  const active = row?.status === "active" && (!row.expires_at || Date.parse(row.expires_at) > Date.now());
  return { reportNumber, canManage: !!role, role, canReadCard: !!role || !!(active && row.results_access), canReadResults: !!role || !!(active && row.results_access), canReadPdf: !!role, status: role ? "controller" : row?.status === "active" && !active ? "expired" : row?.status === "pending" && !row.requested_results ? "not_requested" : row?.status || "not_requested", expiresAt: row?.expires_at || null, revision: row?.revision || 0 };
}

const columns = "report_number,recipient_email,status,results_access,pdf_access,requested_results,requested_pdf,expires_at,revision,updated_at,updated_by";
type Change = { reportNumber: string; email: string; revision: number; results: boolean; pdf: boolean; requestedResults: boolean; requestedPdf: boolean; status: string; expiresAt: string | null };

async function savePermissions(db: Db, user: Actor, changes: Change[], action: string) {
  const statements = [];
  const notificationIds: string[] = [];
  const at = new Date().toISOString();
  for (const c of changes) {
    const revision = c.revision + 1;
    // Unique (report,recipient,revision) makes concurrent stale writes fail the whole batch.
    statements.push(db.prepare("INSERT INTO kas_report_permission_events (report_number,recipient_email,revision,action,results_access,pdf_access,expires_at,actor_email,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(c.reportNumber, c.email, revision, action, Number(c.results), Number(c.pdf), c.expiresAt, user.email.toLowerCase(), at));
    statements.push(db.prepare(`INSERT INTO kas_report_permissions (${columns}) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(report_number,recipient_email) DO UPDATE SET status=excluded.status,results_access=excluded.results_access,pdf_access=excluded.pdf_access,requested_results=excluded.requested_results,requested_pdf=excluded.requested_pdf,expires_at=excluded.expires_at,revision=excluded.revision,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(c.reportNumber, c.email, c.status, Number(c.results), Number(c.pdf), Number(c.requestedResults), Number(c.requestedPdf), c.expiresAt, revision, at, user.email.toLowerCase()));
    if (action === "request") {
      const id = crypto.randomUUID(); notificationIds.push(id);
      statements.push(db.prepare("INSERT INTO kas_access_notifications (id,dedupe_key,kind,report_number,requester_email,request_revision,requested_results,requested_pdf,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(id, `request:${c.reportNumber}:${c.email}:${revision}`, "access_request", c.reportNumber, c.email, revision, Number(c.requestedResults), Number(c.requestedPdf), at));
    }
  }
  await db.batch(statements);
  return notificationIds;
}

export async function reportPermissionRequest(db: Db, user: Actor | null, input: any, transport: typeof fetch = privateFetch): Promise<Response> {
  try {
    if (!user || !emailValue(user.email)) return json({ error: "Verified email sign-in required." }, 401);
    const role = await reportManagerRole(db, user);
    if (input.action === "workspace") {
      const reports = await Promise.all(testReports.map(async (r) => ({ identifier: r.testIdentifier, title: reportTitle(r), sample: r.sampleName, lotNumbers: [r.lotNumber], ...await reportPermission(db, user, r.reportNumber, role) })));
      const permissions = role ? (await db.prepare("SELECT p.*, n.id AS request_id, n.status AS notification_status FROM kas_report_permissions p LEFT JOIN kas_access_notifications n ON n.report_number=p.report_number AND n.requester_email=p.recipient_email AND n.request_revision=p.revision ORDER BY p.updated_at DESC LIMIT 500").all<any>()).results : [];
      const events = role ? (await db.prepare("SELECT report_number,recipient_email,action,results_access,pdf_access,expires_at,actor_email,created_at,revision FROM kas_report_permission_events ORDER BY created_at DESC,rowid DESC LIMIT 100").all()).results : [];
      let targetRequest = null;
      if (role && typeof input.requestId === "string" && /^[a-f0-9-]{36}$/.test(input.requestId)) targetRequest = await db.prepare("SELECT n.id,n.report_number,n.requester_email,n.request_revision,p.status,p.revision FROM kas_access_notifications n LEFT JOIN kas_report_permissions p ON p.report_number=n.report_number AND p.recipient_email=n.requester_email WHERE n.id=? AND n.kind=?").bind(input.requestId, "access_request").first();
      return json({ targetRequest, notificationEmail: role ? (await controllerEmails(db)).join(", ") || null : null, sandbox: true, productionAuthority: false, laboratoryApproval: "pending", controller: { name: "Kasandrinos · TEST", code: "KASTEST", authority: "Kasandrinos TEST organization owners and administrators in TECRID" }, canManage: !!role, role, email: user.email, reports, permissions: permissions.map((p: any) => ({ ...p, card_access: p.results_access, requested_card: p.requested_results })), events });
    }
    const report = testReports.find((r) => r.reportNumber === input.reportNumber);
    if (input.action === "status") return report ? json(await reportPermission(db, user, report.reportNumber)) : json({ error: "Unknown TEST report." }, 404);
    if (input.action === "request") {
      if (!report) return json({ error: "Unknown TEST report." }, 404);
      const current = await db.prepare("SELECT * FROM kas_report_permissions WHERE report_number=? AND recipient_email=?").bind(report.reportNumber, user.email.toLowerCase()).first<any>();
      if (role || (current?.status === "pending" && current.requested_results)) return json({ ok: true });
      if (input.pdf === true) return json({ error: "Request the digital TECRID card. Original PDFs are private source evidence." }, 400);
      const results = input.card === true || input.results === true;
      if (!results) return json({ error: "Request digital card access." }, 400);
      if (current?.status === "active" && current.results_access && (!current.expires_at || Date.parse(current.expires_at) > Date.now())) return json({ error: "An active grant already exists. Ask the controller to change its scope." }, 409);
      const ids = await savePermissions(db, user, [{ reportNumber: report.reportNumber, email: user.email.toLowerCase(), revision: current?.revision || 0, results: false, pdf: false, requestedResults: true, requestedPdf: false, status: "pending", expiresAt: null }], "request");
      await deliverAccessNotifications(db, { id: ids[0], limit: 1, transport }).catch(() => undefined);
      return json({ ok: true, status: "pending", sandbox: true, productionAuthority: false, notificationId: ids[0] });
    }
    if (!role) return json({ error: "Kasandrinos owner or administrator permission required." }, 403);
    if (!["grant", "revoke", "decline"].includes(input.action)) return json({ error: "Unknown permission action." }, 400);
    const email = emailValue(input.email);
    if (!email) return json({ error: "Enter the recipient’s exact verified email." }, 400);
    if (!Array.isArray(input.reports) || input.reports.length < 1 || input.reports.length > 8 || new Set(input.reports.map((r: any) => r.reportNumber)).size !== input.reports.length) return json({ error: "Select one to eight distinct TEST reports." }, 400);
    if (input.action === "grant" && input.pdf === true) return json({ error: "Approve the digital TECRID card. Original PDFs are private source evidence." }, 400);
    const results = input.action === "grant" && (input.card === true || input.results === true);
    if (input.action === "grant" && !results) return json({ error: "Approve digital card access." }, 400);
    let expiresAt: string | null = null;
    if (input.action === "grant" && input.expiresAt) {
      const t = Date.parse(input.expiresAt);
      if (!Number.isFinite(t) || t <= Date.now() || t > Date.now() + 366 * 86400000) return json({ error: "Choose an expiry within the next year." }, 400);
      expiresAt = new Date(t).toISOString();
    }
    const changes: Change[] = [];
    for (const item of input.reports) {
      if (!testReports.some((r) => r.reportNumber === item.reportNumber) || !Number.isSafeInteger(item.revision) || item.revision < 0) return json({ error: "Invalid report or revision." }, 400);
      const current = await db.prepare("SELECT revision FROM kas_report_permissions WHERE report_number=? AND recipient_email=?").bind(item.reportNumber, email).first<any>();
      if ((current?.revision || 0) !== item.revision) return json({ error: "Permissions changed in another tab. Refresh before saving." }, 409);
      changes.push({ reportNumber: item.reportNumber, email, revision: item.revision, results, pdf: false, requestedResults: false, requestedPdf: false, status: input.action === "grant" ? "active" : input.action === "revoke" ? "revoked" : "declined", expiresAt });
    }
    if (!await reportManagerRole(db, user)) return json({ error: "Your manager permission was revoked. Refresh." }, 403);
    await savePermissions(db, user, changes, input.action);
    return json({ ok: true, sandbox: true, productionAuthority: false });
  } catch (error) {
    if (String(error).includes("UNIQUE constraint failed")) return json({ error: "Permissions changed in another tab. Refresh before saving." }, 409);
    return json({ error: "Permissions are temporarily unavailable." }, 503);
  }
}

// Access-request email to controllers, sent from TECRID's own sender.
export async function deliverAccessNotifications(db: Db, { id = null as string | null, limit = 3, transport = privateFetch as typeof fetch } = {}) {
  const config = emailConfigFrom(bindings());
  if (!emailConfigured(config)) return { configured: false, sent: 0 };
  const recipients = await controllerEmails(db);
  if (!recipients.length) return { configured: false, sent: 0 };
  const rows = (await db.prepare(`SELECT * FROM kas_access_notifications WHERE status='pending' AND next_attempt<=? ${id ? "AND id=?" : ""} ORDER BY created_at LIMIT ?`).bind(...(id ? [Date.now(), id, Math.min(limit, 5)] : [Date.now(), Math.min(limit, 5)])).all<any>()).results;
  let sent = 0;
  for (const row of rows) {
    const lease = crypto.randomUUID();
    const claimed = await db.prepare("UPDATE kas_access_notifications SET lease_id=?,next_attempt=? WHERE id=? AND status='pending' AND next_attempt=?").bind(lease, Date.now() + 120000, row.id, row.next_attempt).run();
    if (!claimed.meta.changes) continue;
    if (row.kind === "access_request") {
      const permission = await db.prepare("SELECT status,revision FROM kas_report_permissions WHERE report_number=? AND recipient_email=?").bind(row.report_number, row.requester_email).first<any>();
      if (!row.requested_results || permission?.status !== "pending" || permission.revision !== row.request_revision) { await db.prepare("UPDATE kas_access_notifications SET status='cancelled',lease_id=NULL WHERE id=? AND lease_id=?").bind(row.id, lease).run(); continue; }
    }
    let code = "transport";
    try {
      const reviewUrl = row.kind === "delivery_test" ? "https://tecrid.com/dashboard/kasandrinos" : `https://tecrid.com/dashboard/kasandrinos?request=${encodeURIComponent(row.id)}#review-request`;
      const report = testReports.find((r) => r.reportNumber === row.report_number);
      if (row.kind !== "delivery_test" && !report) throw Error("Unknown TEST report");
      const subject = row.kind === "delivery_test" ? "[TEST] Kasandrinos TECRID access-request email check" : `[TEST] Kasandrinos digital TECRID card request · Report ${report!.reportNumber}`;
      const lines = row.kind === "delivery_test"
        ? ["TEST notification delivery check", "This verifies that Kasandrinos access-request notifications can reach you. No access request was created and no permission was changed.", "Open the TEST workspace:", reviewUrl]
        : ["Kasandrinos · TEST digital card access request", "A verified account requested access. View requester details in the authenticated review workspace.", `Report: ${report!.reportNumber} · ${reportTitle(report!)}`, `TEST identifier: ${report!.testIdentifier}`, "Requested access: digital TECRID card", `Requested at: ${row.created_at}`, "Review this request to approve or decline:", reviewUrl];
      lines.push("TEST ONLY · Light Labs approval and signature are pending. The digital card stays locked until an authorized controller approves access. Original PDFs remain private source evidence.");
      code = "provider";
      await sendEmail(config, { to: recipients, subject, text: lines.join("\n\n"), idempotencyKey: `tecrid-kas-request-${row.id}` }, transport);
      await db.prepare("UPDATE kas_access_notifications SET status='sent',sent_at=?,attempts=attempts+1,last_error=NULL,lease_id=NULL WHERE id=? AND lease_id=?").bind(new Date().toISOString(), row.id, lease).run();
      sent++;
    } catch {
      await db.prepare("UPDATE kas_access_notifications SET attempts=attempts+1,last_error=?,next_attempt=?,lease_id=NULL WHERE id=? AND lease_id=?").bind(code, Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(row.attempts, 6)), row.id, lease).run();
    }
  }
  return { configured: true, sent };
}

// In-app inbox items for access requests and decisions. Ids use the "access:" prefix.
export async function accessNotifications(db: Db, user: Actor, readId?: string) {
  const email = user.email.toLowerCase();
  const role = await reportManagerRole(db, user);
  const requests = role ? (await db.prepare("SELECT n.id,n.report_number,n.request_revision,n.created_at,p.status,p.revision FROM kas_access_notifications n JOIN kas_report_permissions p ON p.report_number=n.report_number AND p.recipient_email=n.requester_email WHERE n.kind='access_request' AND n.requested_results=1 ORDER BY n.created_at DESC LIMIT 100").all<any>()).results : [];
  const decisions = (await db.prepare("SELECT report_number,revision,action,created_at FROM kas_report_permission_events WHERE recipient_email=? AND action IN ('grant','decline','revoke') ORDER BY created_at DESC LIMIT 100").bind(email).all<any>()).results;
  const identifier = (n: string) => testReports.find((r) => r.reportNumber === n)?.testIdentifier;
  const items = [
    ...requests.map((row: any) => ({ id: `access:request:${row.id}`, source: "tecrid" as const, kind: "evidence_access.requested", title: `TEST card access request · ${row.report_number}`, body: `A verified account requested access. ${row.status === "pending" && row.revision === row.request_revision ? "Review to approve or decline." : "This request has already been reviewed or replaced; open it to see current permissions."}`, href: `https://tecrid.com/dashboard/kasandrinos?request=${encodeURIComponent(row.id)}#review-request`, createdAt: row.created_at })),
    ...decisions.map((row: any) => { const id = identifier(row.report_number); const verb = row.action === "grant" ? "approved" : row.action === "decline" ? "declined" : "revoked"; return { id: `access:decision:${row.report_number}:${row.revision}`, source: "tecrid" as const, kind: `evidence_access.${row.action === "grant" ? "granted" : verb}`, title: `TEST card access ${verb} · ${row.report_number}`, body: "Light Labs approval and signature are still pending. Original PDFs remain private.", href: id ? `https://tecrid.com/records/${encodeURIComponent(id)}` : "https://tecrid.com/notifications", createdAt: row.created_at }; }),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
  if (readId) {
    if (!items.some((item) => item.id === readId)) throw new Error("Unknown notification");
    await db.prepare("INSERT OR IGNORE INTO evidence_notification_reads (notification_id,recipient_email,read_at) VALUES (?,?,?)").bind(readId, email, new Date().toISOString()).run();
  }
  const reads = (await db.prepare("SELECT notification_id FROM evidence_notification_reads WHERE recipient_email=?").bind(email).all<any>()).results;
  const seen = new Set(reads.map((row: any) => row.notification_id));
  return items.map((item) => ({ ...item, read: seen.has(item.id) }));
}

// Private source documents now live in TECRID's own DOCUMENTS bucket.
export const sourcePdfKey = (sha256: string) => `kasandrinos/source-reports/${sha256}.pdf`;
export const transcriptKey = (sha256: string) => `kasandrinos/test-transcripts/${sha256}.json`;
export function validateTranscript(input: any, report: { reportNumber: string; sourceSha256: string }) {
  if (!input || input.sourceSha256 !== report.sourceSha256 || input.reportNumber !== report.reportNumber || !Array.isArray(input.results) || input.results.length < 1 || input.results.length > 40) throw Error("Invalid source binding");
  const results = input.results.map((row: any) => {
    const result: Record<string, string> = {};
    for (const field of ["analyte", "resultText", "unit", "loqText", "limitText", "statusText", "notes"]) { if (typeof row[field] !== "string" || row[field].length > 500) throw Error("Invalid result field"); result[field] = row[field]; }
    if (!result.analyte || !result.resultText) throw Error("Missing result");
    return result;
  });
  return { reportNumber: report.reportNumber, sourceSha256: report.sourceSha256, sandbox: true, productionAuthority: false, reviewStatus: "UNAPPROVED_TRANSCRIPTION", results };
}
export async function sha256Bytes(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}

// One-time cutover import, ICS administrators only (route also requires the admin second factor).
// The uploaded PDF must match the fixed fingerprint already published for the report.
export async function importTestReportSource(bucket: R2Bucket | undefined, input: { reportNumber: unknown; pdf: unknown; transcript: unknown }) {
  if (!bucket) return { status: 503, body: { error: "Storage unavailable." } };
  const report = testReports.find((r) => r.reportNumber === input.reportNumber);
  if (!report) return { status: 404, body: { error: "Unknown TEST report." } };
  const stored: string[] = [];
  if (input.pdf instanceof Blob) {
    if (input.pdf.size > 20_000_000) return { status: 413, body: { error: "PDF too large." } };
    const bytes = await input.pdf.arrayBuffer();
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-" || await sha256Bytes(bytes) !== report.sourceSha256) return { status: 400, body: { error: "The PDF does not match this report's fingerprint." } };
    await bucket.put(sourcePdfKey(report.sourceSha256), bytes, { httpMetadata: { contentType: "application/pdf" }, customMetadata: { sha256: report.sourceSha256 } });
    stored.push("pdf");
  }
  if (typeof input.transcript === "string" && input.transcript) {
    if (input.transcript.length > 128000) return { status: 413, body: { error: "Transcript too large." } };
    let data;
    try { data = validateTranscript(JSON.parse(input.transcript), report); } catch { return { status: 400, body: { error: "The transcript is not bound to this report." } }; }
    await bucket.put(transcriptKey(report.sourceSha256), JSON.stringify(data), { httpMetadata: { contentType: "application/json" }, customMetadata: { sha256: report.sourceSha256, reviewStatus: "UNAPPROVED_TRANSCRIPTION" } });
    stored.push("transcript");
  }
  if (!stored.length) return { status: 400, body: { error: "Attach the source PDF, the transcript JSON, or both." } };
  return { status: 200, body: { reportNumber: report.reportNumber, stored, sandbox: true, productionAuthority: false } };
}
