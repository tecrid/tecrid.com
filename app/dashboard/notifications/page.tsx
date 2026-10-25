import { redirect } from "next/navigation";
import { getOrganizationForUser } from "../../../lib/tec";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { notificationDashboard } from "../../../lib/notification-delivery";
import { NotificationChannels } from "./channels-client";
export const dynamic = "force-dynamic";
export const metadata = { title: "Notification channels | TECRID", robots: { index: false, follow: false } };
export default async function NotificationsPage() {
  const user = await requireChatGPTUser("/dashboard/notifications");
  if (!await getOrganizationForUser(user.userId)) redirect("/dashboard");
  const data = await notificationDashboard(user);
  return <main className="product-page"><header className="dashboard-header"><div><p className="section-kicker light">Organization notifications</p><h1>Phone, email, and webhooks.</h1><p>{data.automationEnabled ? "Automatic delivery is enabled." : "Automatic delivery is awaiting the required safety release. You can configure and test channels."}</p></div><a href="/dashboard/notifications">Refresh delivery log</a></header>
    <NotificationChannels channels={data.channels} vapidPublicKey={data.vapidPublicKey} email={user.email} />
    <section className="dashboard-panel"><h2>Delivery log</h2><p>Delivered means the destination accepted the request. It does not prove a phone displayed or a person read an alert.</p><div className="notification-log"><table><thead><tr><th>Event / SKU</th><th>Channel</th><th>Status</th><th>Attempts</th><th>Queued</th><th>Accepted</th><th>Acknowledged</th><th>Next attempt</th></tr></thead><tbody>{data.deliveries.map(row => <tr key={`${row.eventId}:${row.channel}`}><td>{row.event}<br />{row.sku || "No SKU"}<br /><small>{row.eventId}</small></td><td>{row.channel} ({row.kind})</td><td>{row.status}{row.error ? <small>{row.error}</small> : null}</td><td>{row.attempts}</td><td>{row.queuedAt}</td><td>{row.deliveredAt || "Pending"}</td><td>{row.acknowledgedAt || "Not acknowledged"}</td><td>{["retry", "queued", "blocked"].includes(row.status) ? row.nextAttemptAt : "None"}</td></tr>)}</tbody></table>{!data.deliveries.length ? <p>No channel deliveries recorded.</p> : null}</div></section>
  </main>;
}
