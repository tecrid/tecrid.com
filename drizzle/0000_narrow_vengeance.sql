CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`label` text NOT NULL,
	`key_prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`last_four` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_api_keys_key_hash` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `idx_api_keys_organization_id` ON `api_keys` (`organization_id`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`actor_user_id` text,
	`event_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`payload` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_organization_id` ON `audit_events` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_entity` ON `audit_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `billing_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`payment_link_id` text,
	`customer_email` text,
	`customer_id` text,
	`subscription_id` text,
	`amount_total` integer,
	`currency` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`organization_id` text,
	`payload` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`processed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_billing_events_customer_email` ON `billing_events` (`customer_email`);--> statement-breakpoint
CREATE INDEX `idx_billing_events_subscription_id` ON `billing_events` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `idx_billing_events_organization_id` ON `billing_events` (`organization_id`);--> statement-breakpoint
CREATE TABLE `credential_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`credential_identifier` text NOT NULL,
	`analyte` text NOT NULL,
	`symbol` text,
	`result_text` text NOT NULL,
	`numeric_value` real,
	`unit` text NOT NULL,
	`loq_text` text,
	`method` text,
	`sequence` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`credential_identifier`) REFERENCES `credentials`(`identifier`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_results_credential_identifier` ON `credential_results` (`credential_identifier`);--> statement-breakpoint
CREATE TABLE `credentials` (
	`identifier` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`sample_name` text NOT NULL,
	`lot_number` text,
	`matrix` text,
	`method` text,
	`submitting_party` text,
	`collected_at` text,
	`received_at` text,
	`tested_at` text,
	`issued_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`fingerprint` text,
	`public_record` integer DEFAULT false NOT NULL,
	`created_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_credentials_organization_id` ON `credentials` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_credentials_status` ON `credentials` (`status`);--> statement-breakpoint
CREATE INDEX `idx_credentials_public_record` ON `credentials` (`public_record`);--> statement-breakpoint
CREATE TABLE `organization_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_user_id` ON `organization_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_members_organization_id` ON `organization_members` (`organization_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`organization_type` text NOT NULL,
	`website` text,
	`owner_user_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`issuer_code` text NOT NULL,
	`issuer_status` text DEFAULT 'pending' NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_organizations_slug` ON `organizations` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_organizations_issuer_code` ON `organizations` (`issuer_code`);--> statement-breakpoint
CREATE INDEX `idx_organizations_owner_user_id` ON `organizations` (`owner_user_id`);
--> statement-breakpoint
INSERT INTO `organizations` (`id`, `name`, `slug`, `organization_type`, `website`, `owner_user_id`, `owner_email`, `issuer_code`, `issuer_status`, `plan`, `created_at`, `updated_at`) VALUES ('org_demo_greenleaf', 'Greenleaf Analytical', 'greenleaf-analytical-demo', 'laboratory', NULL, 'system_demo', 'demo@tec.network', 'GLP', 'verified', 'free', '2026-06-18T14:32:00.000Z', '2026-06-18T14:32:00.000Z');
--> statement-breakpoint
INSERT INTO `credentials` (`identifier`, `organization_id`, `status`, `sample_name`, `lot_number`, `matrix`, `method`, `submitting_party`, `received_at`, `tested_at`, `issued_at`, `version`, `fingerprint`, `public_record`, `created_by_user_id`, `created_at`, `updated_at`) VALUES ('TEC·GLP-26-7F3A92', 'org_demo_greenleaf', 'issued', 'Organic cacao powder', 'C-240518', 'Food · Powder', 'ICP-MS', 'Withheld by issuer', '2026-06-14', '2026-06-17', '2026-06-18T14:32:00.000Z', 1, '8f105b2cc2f8798e9b30e6bd2d52d2a6d8c1255637869219c1b88d00fd81a27e', true, 'system_demo', '2026-06-18T14:32:00.000Z', '2026-06-18T14:32:00.000Z');
--> statement-breakpoint
INSERT INTO `credential_results` (`credential_identifier`, `analyte`, `symbol`, `result_text`, `numeric_value`, `unit`, `loq_text`, `method`, `sequence`) VALUES ('TEC·GLP-26-7F3A92', 'Lead', 'Pb', '42', 42, 'µg/kg', '10', 'ICP-MS', 0);
--> statement-breakpoint
INSERT INTO `credential_results` (`credential_identifier`, `analyte`, `symbol`, `result_text`, `numeric_value`, `unit`, `loq_text`, `method`, `sequence`) VALUES ('TEC·GLP-26-7F3A92', 'Cadmium', 'Cd', '312', 312, 'µg/kg', '10', 'ICP-MS', 1);
--> statement-breakpoint
INSERT INTO `credential_results` (`credential_identifier`, `analyte`, `symbol`, `result_text`, `numeric_value`, `unit`, `loq_text`, `method`, `sequence`) VALUES ('TEC·GLP-26-7F3A92', 'Arsenic', 'As', '< 10', NULL, 'µg/kg', '10', 'ICP-MS', 2);
--> statement-breakpoint
INSERT INTO `credential_results` (`credential_identifier`, `analyte`, `symbol`, `result_text`, `numeric_value`, `unit`, `loq_text`, `method`, `sequence`) VALUES ('TEC·GLP-26-7F3A92', 'Mercury', 'Hg', '< 5', NULL, 'µg/kg', '5', 'ICP-MS', 3);
--> statement-breakpoint
INSERT INTO `audit_events` (`id`, `organization_id`, `actor_user_id`, `event_type`, `entity_type`, `entity_id`, `payload`, `created_at`) VALUES ('evt_demo_issuance', 'org_demo_greenleaf', 'system_demo', 'credential.issued', 'credential', 'TEC·GLP-26-7F3A92', '{"seeded_demonstration":true,"resultCount":4}', '2026-06-18T14:32:00.000Z');
--> statement-breakpoint
PRAGMA optimize;
