CREATE TABLE `certification_intake_items` (
	`id` text PRIMARY KEY NOT NULL,
	`intake_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`submitted_identifier` text NOT NULL,
	`normalized_identifier` text NOT NULL,
	`validation_status` text NOT NULL,
	`credential_identifier` text,
	`issuer_organization_id` text,
	`record_version` integer,
	`record_status` text,
	`issuer_signature_verified` integer DEFAULT false NOT NULL,
	`snapshot_fingerprint` text,
	`snapshot_json` text,
	`errors` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`intake_id`) REFERENCES `certification_intakes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`issuer_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_certification_items_intake_row` ON `certification_intake_items` (`intake_id`,`row_number`);--> statement-breakpoint
CREATE INDEX `idx_certification_items_identifier` ON `certification_intake_items` (`credential_identifier`);--> statement-breakpoint
CREATE INDEX `idx_certification_items_status` ON `certification_intake_items` (`intake_id`,`validation_status`);--> statement-breakpoint
CREATE TABLE `certification_intakes` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`receiving_organization_id` text NOT NULL,
	`applicant_organization` text NOT NULL,
	`applicant_name` text NOT NULL,
	`applicant_email` text NOT NULL,
	`submission_reference` text,
	`source_type` text NOT NULL,
	`status` text NOT NULL,
	`row_count` integer NOT NULL,
	`valid_rows` integer NOT NULL,
	`blocked_rows` integer NOT NULL,
	`manifest_fingerprint` text NOT NULL,
	`submitted_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `certification_programs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`receiving_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_certification_intakes_receiver_created` ON `certification_intakes` (`receiving_organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_certification_intakes_program_created` ON `certification_intakes` (`program_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `certification_programs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`public_token` text NOT NULL,
	`api_token_hash` text NOT NULL,
	`api_token_prefix` text NOT NULL,
	`api_token_last_four` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_certification_programs_public_token` ON `certification_programs` (`public_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_certification_programs_api_token_hash` ON `certification_programs` (`api_token_hash`);--> statement-breakpoint
CREATE INDEX `idx_certification_programs_org_created` ON `certification_programs` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dispute_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`title` text NOT NULL,
	`purpose` text,
	`status` text DEFAULT 'open' NOT NULL,
	`left_credential_identifier` text NOT NULL,
	`right_credential_identifier` text NOT NULL,
	`comparison_status` text NOT NULL,
	`comparison_json` text NOT NULL,
	`evidence_manifest_json` text NOT NULL,
	`evidence_fingerprint` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_dispute_cases_org_created` ON `dispute_cases` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_dispute_cases_left_identifier` ON `dispute_cases` (`left_credential_identifier`);--> statement-breakpoint
CREATE INDEX `idx_dispute_cases_right_identifier` ON `dispute_cases` (`right_credential_identifier`);--> statement-breakpoint
CREATE TABLE `verification_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`lookup_type` text NOT NULL,
	`lookup_value` text NOT NULL,
	`outcome` text NOT NULL,
	`credential_identifier` text,
	`issuer_organization_id` text,
	`record_fingerprint` text,
	`receipt_fingerprint` text NOT NULL,
	`requester_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`issuer_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_verification_checks_issuer_created` ON `verification_checks` (`issuer_organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_verification_checks_credential_created` ON `verification_checks` (`credential_identifier`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_verification_checks_receipt_fingerprint` ON `verification_checks` (`receipt_fingerprint`);
--> statement-breakpoint
CREATE TRIGGER `verification_checks_no_update`
BEFORE UPDATE ON `verification_checks`
BEGIN
  SELECT RAISE(ABORT, 'verification receipts are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `verification_checks_no_delete`
BEFORE DELETE ON `verification_checks`
BEGIN
  SELECT RAISE(ABORT, 'verification receipts are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `dispute_evidence_immutable`
BEFORE UPDATE OF `left_credential_identifier`, `right_credential_identifier`, `comparison_status`, `comparison_json`, `evidence_manifest_json`, `evidence_fingerprint`, `created_at` ON `dispute_cases`
BEGIN
  SELECT RAISE(ABORT, 'dispute evidence is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `dispute_cases_no_delete`
BEFORE DELETE ON `dispute_cases`
BEGIN
  SELECT RAISE(ABORT, 'dispute cases are retained');
END;
--> statement-breakpoint
CREATE TRIGGER `certification_intakes_no_update`
BEFORE UPDATE ON `certification_intakes`
BEGIN
  SELECT RAISE(ABORT, 'certification intakes are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `certification_intakes_no_delete`
BEFORE DELETE ON `certification_intakes`
BEGIN
  SELECT RAISE(ABORT, 'certification intakes are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `certification_intake_items_no_update`
BEFORE UPDATE ON `certification_intake_items`
BEGIN
  SELECT RAISE(ABORT, 'certification intake items are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `certification_intake_items_no_delete`
BEFORE DELETE ON `certification_intake_items`
BEGIN
  SELECT RAISE(ABORT, 'certification intake items are append-only');
END;
--> statement-breakpoint
PRAGMA optimize;
