ALTER TABLE `issuer_applications` ADD `accredited_sites` text;--> statement-breakpoint
ALTER TABLE `issuer_applications` ADD `accredited_analytes` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `issuer_report_id` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `issuer_sample_id` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `laboratory_site` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `site_on_certificate` integer;--> statement-breakpoint
ALTER TABLE `credentials` ADD `accreditation_label` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `backfilled` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `credentials` ADD `original_report_date` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_credentials_org_report_id` ON `credentials` (`organization_id`, `issuer_report_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_credentials_org_sample_id` ON `credentials` (`organization_id`, `issuer_sample_id`);--> statement-breakpoint
ALTER TABLE `credential_results` ADD `on_accredited_scope` integer;--> statement-breakpoint
ALTER TABLE `legacy_reports` ADD `backfilled` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `legacy_reports` ADD `original_report_date` text;--> statement-breakpoint
CREATE TABLE `credential_batch_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`status` text NOT NULL,
	`total` integer NOT NULL,
	`created_count` integer NOT NULL DEFAULT 0,
	`existing_count` integer NOT NULL DEFAULT 0,
	`error_count` integer NOT NULL DEFAULT 0,
	`results_json` text NOT NULL,
	`created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`completed_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `idx_credential_batch_jobs_org` ON `credential_batch_jobs` (`organization_id`, `created_at`);
