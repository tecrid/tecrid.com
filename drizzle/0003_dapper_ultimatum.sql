CREATE TABLE `legacy_report_events` (
	`id` text PRIMARY KEY NOT NULL,
	`legacy_report_id` text NOT NULL,
	`organization_id` text,
	`actor_user_id` text,
	`event_type` text NOT NULL,
	`payload` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`legacy_report_id`) REFERENCES `legacy_reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_legacy_report_events_report` ON `legacy_report_events` (`legacy_report_id`);--> statement-breakpoint
CREATE INDEX `idx_legacy_report_events_org` ON `legacy_report_events` (`organization_id`);--> statement-breakpoint
CREATE TABLE `legacy_report_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`legacy_report_id` text NOT NULL,
	`analyte` text NOT NULL,
	`symbol` text,
	`result_text` text NOT NULL,
	`numeric_value` real,
	`unit` text NOT NULL,
	`loq_text` text,
	`method` text,
	`sequence` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`legacy_report_id`) REFERENCES `legacy_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_legacy_report_results_report` ON `legacy_report_results` (`legacy_report_id`);--> statement-breakpoint
CREATE TABLE `legacy_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`submitting_organization_id` text NOT NULL,
	`issuer_organization_id` text,
	`submitted_by_user_id` text NOT NULL,
	`claimed_by_user_id` text,
	`confirmed_by_user_id` text,
	`status` text DEFAULT 'awaiting_lab_claim' NOT NULL,
	`laboratory_name` text NOT NULL,
	`laboratory_website` text,
	`confirmation_email` text NOT NULL,
	`confirmation_token_hash` text NOT NULL,
	`confirmation_token_last_four` text NOT NULL,
	`sample_name` text NOT NULL,
	`lot_number` text,
	`matrix` text,
	`method` text,
	`report_number` text,
	`order_number` text,
	`collected_at` text,
	`received_at` text,
	`tested_at` text,
	`released_at` text,
	`source_object_key` text NOT NULL,
	`source_filename` text NOT NULL,
	`source_mime_type` text NOT NULL,
	`source_size` integer NOT NULL,
	`source_sha256` text NOT NULL,
	`document_visibility` text DEFAULT 'private' NOT NULL,
	`discrepancy_note` text,
	`issued_credential_identifier` text,
	`claimed_at` text,
	`confirmed_at` text,
	`declined_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submitting_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`issuer_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`issued_credential_identifier`) REFERENCES `credentials`(`identifier`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_legacy_reports_confirmation_token_hash` ON `legacy_reports` (`confirmation_token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_legacy_reports_submitter_hash` ON `legacy_reports` (`submitting_organization_id`,`source_sha256`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_legacy_reports_issued_credential` ON `legacy_reports` (`issued_credential_identifier`);--> statement-breakpoint
CREATE INDEX `idx_legacy_reports_status` ON `legacy_reports` (`status`);--> statement-breakpoint
CREATE INDEX `idx_legacy_reports_issuer_org` ON `legacy_reports` (`issuer_organization_id`);--> statement-breakpoint
CREATE INDEX `idx_legacy_reports_confirmation_email` ON `legacy_reports` (`confirmation_email`);--> statement-breakpoint
CREATE INDEX `idx_legacy_reports_source_sha256` ON `legacy_reports` (`source_sha256`);--> statement-breakpoint
ALTER TABLE `credentials` ADD `legacy_report_id` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `source_document_hash` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `source_document_name` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `issuance_basis` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `laboratory_report_number` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `laboratory_order_number` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_credentials_legacy_report_id` ON `credentials` (`legacy_report_id`);--> statement-breakpoint
CREATE INDEX `idx_credentials_source_document_hash` ON `credentials` (`source_document_hash`);
--> statement-breakpoint
CREATE TRIGGER `legacy_report_events_no_update`
BEFORE UPDATE ON `legacy_report_events`
BEGIN
	SELECT RAISE(ABORT, 'legacy_report_events is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `legacy_report_events_no_delete`
BEFORE DELETE ON `legacy_report_events`
BEGIN
	SELECT RAISE(ABORT, 'legacy_report_events is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `legacy_report_source_immutable`
BEFORE UPDATE OF `source_object_key`, `source_filename`, `source_mime_type`, `source_size`, `source_sha256`, `submitting_organization_id`, `submitted_by_user_id`, `created_at`
ON `legacy_reports`
BEGIN
	SELECT RAISE(ABORT, 'legacy report source evidence is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `legacy_reports_no_delete`
BEFORE DELETE ON `legacy_reports`
BEGIN
	SELECT RAISE(ABORT, 'legacy reports cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `credential_source_document_immutable`
BEFORE UPDATE OF `legacy_report_id`, `source_document_hash`, `source_document_name`, `issuance_basis`, `laboratory_report_number`, `laboratory_order_number`
ON `credentials`
BEGIN
	SELECT RAISE(ABORT, 'credential source-document provenance is immutable');
END;
