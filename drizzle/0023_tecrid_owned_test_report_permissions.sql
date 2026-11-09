-- TECRID now owns Kasandrinos TEST report permissions and access-request notices.
-- Same shape as the former VLE tables so existing rows can be copied once at cutover.
CREATE TABLE IF NOT EXISTS `kas_report_permission_events` (
	`report_number` text NOT NULL,
	`recipient_email` text NOT NULL,
	`revision` integer NOT NULL,
	`action` text NOT NULL,
	`results_access` integer NOT NULL,
	`pdf_access` integer NOT NULL,
	`expires_at` text,
	`actor_email` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`report_number`, `recipient_email`, `revision`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kas_report_permissions` (
	`report_number` text NOT NULL,
	`recipient_email` text NOT NULL,
	`status` text NOT NULL,
	`results_access` integer DEFAULT 0 NOT NULL,
	`pdf_access` integer DEFAULT 0 NOT NULL,
	`requested_results` integer DEFAULT 0 NOT NULL,
	`requested_pdf` integer DEFAULT 0 NOT NULL,
	`expires_at` text,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	PRIMARY KEY(`report_number`, `recipient_email`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kas_access_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`dedupe_key` text NOT NULL,
	`kind` text NOT NULL,
	`report_number` text,
	`requester_email` text,
	`request_revision` integer,
	`requested_results` integer NOT NULL,
	`requested_pdf` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt` integer DEFAULT 0 NOT NULL,
	`lease_id` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`sent_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `kas_access_notifications_dedupe_key_unique` ON `kas_access_notifications` (`dedupe_key`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `evidence_notification_reads` (
	`notification_id` text NOT NULL,
	`recipient_email` text NOT NULL,
	`read_at` text NOT NULL,
	PRIMARY KEY(`notification_id`, `recipient_email`)
);
