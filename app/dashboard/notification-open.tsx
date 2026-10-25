"use client";
import { useEffect } from "react";
// A push click opens its authenticated workspace. A provider's 2xx alone is
// never treated as a human acknowledgment.
export function NotificationOpen() {
  useEffect(() => {
    const query = new URL(window.location.href).searchParams;
    const eventId = query.get("notificationEvent"), channelId = query.get("notificationChannel");
    if (!eventId || !channelId) return;
    void fetch("/api/notification-acknowledgments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, channelId }) }).catch(() => {});
  }, []);
  return null;
}
