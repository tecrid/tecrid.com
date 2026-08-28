CREATE TABLE `credential_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`credential_identifier` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`canonical_payload` text NOT NULL,
	`fingerprint` text NOT NULL,
	`issuer_signature` text,
	`issuer_key_id` text,
	`signature_algorithm` text,
	`signed_payload_hash` text,
	`change_type` text DEFAULT 'issuance' NOT NULL,
	`change_reason` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`credential_identifier`) REFERENCES `credentials`(`identifier`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_credential_versions_identifier_version` ON `credential_versions` (`credential_identifier`,`version`);--> statement-breakpoint
CREATE INDEX `idx_credential_versions_identifier` ON `credential_versions` (`credential_identifier`);--> statement-breakpoint
CREATE TABLE `issuer_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`legal_name` text NOT NULL,
	`laboratory_address` text NOT NULL,
	`accreditation_body` text,
	`accreditation_number` text,
	`accreditation_url` text,
	`scope_summary` text NOT NULL,
	`method_families` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`public_key_jwk` text,
	`key_id` text,
	`key_algorithm` text,
	`attested` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text,
	`review_note` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_issuer_applications_organization_id` ON `issuer_applications` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_issuer_applications_status` ON `issuer_applications` (`status`);--> statement-breakpoint
ALTER TABLE `credentials` ADD `issuer_signature` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `issuer_key_id` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `signature_algorithm` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `signed_payload_hash` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `issuer_public_key_jwk` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `issuer_key_id` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `issuer_key_algorithm` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `issuer_key_verified_at` text;--> statement-breakpoint
-- Remove the prototype's seeded fictional "issued" record. Demonstrations now
-- live only at /demo and are never returned by the live resolver or API.
DELETE FROM `audit_events` WHERE `entity_id` = 'TEC·GLP-26-7F3A92' OR `organization_id` = 'org_demo_greenleaf';--> statement-breakpoint
DELETE FROM `credential_results` WHERE `credential_identifier` = 'TEC·GLP-26-7F3A92';--> statement-breakpoint
DELETE FROM `credentials` WHERE `identifier` = 'TEC·GLP-26-7F3A92';--> statement-breakpoint
DELETE FROM `organization_members` WHERE `organization_id` = 'org_demo_greenleaf';--> statement-breakpoint
DELETE FROM `api_keys` WHERE `organization_id` = 'org_demo_greenleaf';--> statement-breakpoint
DELETE FROM `issuer_applications` WHERE `organization_id` = 'org_demo_greenleaf';--> statement-breakpoint
DELETE FROM `organizations` WHERE `id` = 'org_demo_greenleaf';
