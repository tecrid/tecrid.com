"use client";

import { useMemo, useState } from "react";

type RequestRecord = { id: string; programName: string; purpose: string; productName: string; productSku: string; accessLevel: string; deliveryMode: string; status: string; requestedAt: string; direction: string; requesterName: string; controllerName: string; analytes: string[] };
type GrantRecord = { id: string; productName: string; productSku: string; accessLevel: string; deliveryMode: string; status: string; createdAt: string; recipientName: string; controllerName: string; isController: boolean; analytes: string[] };
type AuthorizationRecord = { id: string; productName: string; productSku: string; status: string; createdAt: string; laboratoryName: string };
type AccessRow = {
  id: string;
  who: string;
  product: string;
  sku: string;
  access: string;
  status: "pending" | "approved" | "revoked" | "declined";
  rank: number;
  approve?: { requestId: string; accessLevel: string; analytes: string[]; deliveryMode: string };
  revokeGrantId?: string;
  revokeAuthorizationId?: string;
};

const FILTERS = ["All", "Pending", "Approved", "Revoked", "Declined"] as const;

function accessLabel(value: string) {
  if (value === "selected_analytes") return "Selected analytes";
  if (value === "full_record") return "Full record";
  if (value === "status_only") return "Status only";
  return value.replaceAll("_", " ");
}

export function EvidenceRoutingClient({ organization, requests, grants, authorizations }: {
  organization: { id: string; name: string; code: string; type: string };
  requests: RequestRecord[];
  grants: GrantRecord[];
  deliveries: unknown[];
  controllerReceipts: unknown[];
  authorizations: AuthorizationRecord[];
}) {
  const controller = ["brand", "supplier"].includes(organization.type);
  const recipient = ["certification_body", "retailer", "government"].includes(organization.type);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [token, setToken] = useState<string | null>(null);

  const rows = useMemo(() => {
    const grantedRequestSkus = new Set(grants.map((grant) => `${grant.recipientName}|${grant.productSku}`));
    const list: AccessRow[] = [];
    for (const request of requests) {
      if (request.status === "accepted" && grantedRequestSkus.size) continue;
      const pending = request.status === "pending";
      const declined = request.status === "declined";
      if (!pending && !declined) continue;
      const who = request.direction === "inbound" ? request.requesterName : request.controllerName;
      list.push({
        id: `request-${request.id}`,
        who,
        product: request.productName,
        sku: request.productSku,
        access: accessLabel(request.accessLevel),
        status: pending ? "pending" : "declined",
        rank: pending ? 0 : 3,
        approve: pending && request.direction === "inbound" ? { requestId: request.id, accessLevel: request.accessLevel, analytes: request.analytes, deliveryMode: request.deliveryMode } : undefined,
      });
    }
    for (const grant of grants) {
      const active = grant.status === "active";
      list.push({
        id: `grant-${grant.id}`,
        who: grant.isController ? grant.recipientName : grant.controllerName,
        product: grant.productName,
        sku: grant.productSku,
        access: accessLabel(grant.accessLevel),
        status: active ? "approved" : "revoked",
        rank: active ? 1 : 2,
        revokeGrantId: grant.isController && active ? grant.id : undefined,
      });
    }
    for (const authorization of authorizations) {
      const active = authorization.status === "active";
      list.push({
        id: `route-${authorization.id}`,
        who: authorization.laboratoryName,
        product: authorization.productName,
        sku: authorization.productSku,
        access: "Lab route",
        status: active ? "approved" : "revoked",
        rank: active ? 1 : 2,
        revokeAuthorizationId: active ? authorization.id : undefined,
      });
    }
    return list.sort((left, right) => left.rank - right.rank || left.who.localeCompare(right.who));
  }, [authorizations, grants, requests]);

  const counts = {
    All: rows.length,
    Pending: rows.filter((row) => row.status === "pending").length,
    Approved: rows.filter((row) => row.status === "approved").length,
    Revoked: rows.filter((row) => row.status === "revoked").length,
    Declined: rows.filter((row) => row.status === "declined").length,
  };
  const visible = rows.filter((row) => {
    if (filter !== "All" && row.status !== filter.toLowerCase()) return false;
    return `${row.who} ${row.product} ${row.sku} ${row.access}`.toLowerCase().includes(query.trim().toLowerCase());
  });

  async function post(endpoint: string, payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("Saving.");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { error?: string; result?: { plainTextToken?: string } };
      if (!response.ok) throw new Error(body.error || "The operation failed.");
      if (body.result?.plainTextToken) {
        setToken(body.result.plainTextToken);
        setMessage("Routing token created. Copy it now. It is shown once.");
        setShowForm(false);
        return;
      }
      setMessage("Saved.");
      window.setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The operation failed.");
      setBusy(false);
    }
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>, endpoint: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await post(endpoint, Object.fromEntries(form.entries()));
  }

  return (
    <section className="access-list">
      <div className="app-toolbar">
        {recipient ? <button className="button-dark" type="button" onClick={() => setShowForm((open) => !open)}>Request access</button> : null}
        {controller ? <button className="button-dark" type="button" onClick={() => setShowForm((open) => !open)}>Authorize a lab</button> : null}
        <input aria-label="Search" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
        {FILTERS.filter((item) => item === "All" || counts[item] > 0).map((item) => (
          <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item} {counts[item]}</button>
        ))}
      </div>
      {message ? <p className="form-message" aria-live="polite">{message}</p> : null}
      {token ? <p className="routing-new-token"><span>Shown once</span> <code>{token}</code> <button type="button" onClick={() => void navigator.clipboard.writeText(token)}>Copy token</button></p> : null}
      {showForm && recipient ? (
        <form className="access-form" onSubmit={(event) => void submitForm(event, "/api/evidence-routing/requests")}>
          <label>Brand or supplier code<input name="controllerOrganizationCode" required placeholder="ATLAS7Q" /></label>
          <label>Program<input name="programName" required /></label>
          <label>Purpose<input name="purpose" required /></label>
          <label>Product<input name="productName" required /></label>
          <label>SKU<input name="productSku" required /></label>
          <label>Access<select name="accessLevel" defaultValue="selected_analytes"><option value="status_only">Status only</option><option value="selected_analytes">Selected analytes</option><option value="full_record">Full record</option></select></label>
          <label>Delivery<select name="deliveryMode" defaultValue="future_sku"><option value="one_time">One report</option><option value="future_sku">Current and future reports for this SKU</option></select></label>
          <label>Analytes<input name="analytes" defaultValue="Lead, Cadmium, Arsenic, Mercury" /></label>
          <button className="button-dark" disabled={busy} type="submit">Send request</button>
        </form>
      ) : null}
      {showForm && controller ? (
        <form className="access-form" onSubmit={(event) => void submitForm(event, "/api/evidence-routing/authorizations")}>
          <label>Laboratory code<input name="laboratoryOrganizationCode" required /></label>
          <label>Product<input name="productName" required /></label>
          <label>SKU<input name="productSku" required /></label>
          <label>Expires in days<input name="expiresInDays" type="number" min="1" max="365" defaultValue="90" /></label>
          <button className="button-dark" disabled={busy} type="submit">Create routing token</button>
        </form>
      ) : null}
      {visible.length ? (
        <table className="work-table">
          <thead><tr><th>Who</th><th>Product</th><th>SKU</th><th>Access</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} id={row.id}>
                <td>{row.who}</td>
                <td>{row.product}</td>
                <td>{row.sku}</td>
                <td>{row.access}</td>
                <td><span className={`record-status record-${row.status}`}>{row.status}</span></td>
                <td className="access-actions">
                  {row.approve ? <button type="button" disabled={busy} onClick={() => void post(`/api/evidence-routing/requests/${row.approve!.requestId}/response`, { decision: "accept", accessLevel: row.approve!.accessLevel, analytes: row.approve!.analytes, deliveryMode: row.approve!.deliveryMode })}>Approve</button> : null}
                  {row.approve ? <button type="button" disabled={busy} onClick={() => void post(`/api/evidence-routing/requests/${row.approve!.requestId}/response`, { decision: "decline" })}>Revoke</button> : null}
                  {row.revokeGrantId ? <button type="button" disabled={busy} onClick={() => void post(`/api/evidence-routing/grants/${row.revokeGrantId}/revoke`, {})}>Revoke</button> : null}
                  {row.revokeAuthorizationId ? <button type="button" disabled={busy} onClick={() => void post(`/api/evidence-routing/authorizations/${row.revokeAuthorizationId}/revoke`, {})}>Revoke</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="queue-empty"><strong>{rows.length ? "No matching access." : "No access decisions yet."}</strong></div>}
      <p className="app-note">Your organization code is {organization.code}. Revoke stops future delivery. It does not erase a report someone already received.</p>
    </section>
  );
}
