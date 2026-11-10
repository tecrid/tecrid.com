"use client";

import { useMemo, useState } from "react";

export type QueueRow = {
  id: string;
  product: string;
  lot: string;
  sample: string;
  report: string;
  href?: string;
  status: string;
  needsAction?: boolean;
};

const LABELS: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  pending: "Pending",
  accepted: "Approved",
  active: "Approved",
  revoked: "Revoked",
  declined: "Declined",
  received: "Received",
  delivered: "Received",
  awaiting_lab_claim: "Waiting on lab",
  needs_information: "Needs information",
  rejected: "Rejected",
  submitted: "Submitted",
  invited: "Needs confirmation",
};

export function statusLabel(status: string) {
  return LABELS[status] ?? status.replaceAll("_", " ");
}

export function WorkQueue({ rows, empty }: { rows: QueueRow[]; empty: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const labels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const label = statusLabel(row.status);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [rows]);
  const visible = rows.filter((row) => {
    const label = statusLabel(row.status);
    if (filter !== "All" && label !== filter) return false;
    const haystack = `${row.product} ${row.lot} ${row.sample} ${row.report} ${label}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }).sort((left, right) => Number(Boolean(right.needsAction)) - Number(Boolean(left.needsAction)));

  return (
    <section className="work-queue">
      <div className="work-filters">
        <input aria-label="Search" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button type="button" aria-pressed={filter === "All"} onClick={() => setFilter("All")}>All {rows.length}</button>
        {labels.map(([label, count]) => <button key={label} type="button" aria-pressed={filter === label} onClick={() => setFilter(label)}>{label} {count}</button>)}
      </div>
      {visible.length ? (
        <table className="work-table">
          <thead><tr><th>Product</th><th>Lot</th><th>Sample</th><th>Report</th><th>Status</th></tr></thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                <td>{row.href ? <a href={row.href}>{row.product}</a> : row.product}</td>
                <td>{row.lot}</td>
                <td>{row.sample}</td>
                <td>{row.report}</td>
                <td><span className={`record-status record-${row.status}`}>{statusLabel(row.status)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="queue-empty"><strong>{query || filter !== "All" ? "No matching reports." : empty}</strong><p>{query || filter !== "All" ? "Try another search or status filter." : "Use the action above to add, issue, or request your first report."}</p></div>}
    </section>
  );
}
