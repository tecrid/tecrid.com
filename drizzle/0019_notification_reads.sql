CREATE TABLE notification_reads (
 notification_id TEXT NOT NULL REFERENCES organization_notifications(id) ON DELETE CASCADE,
 recipient_email TEXT NOT NULL,
 read_at TEXT NOT NULL,
 PRIMARY KEY (notification_id, recipient_email)
);
