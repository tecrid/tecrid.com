CREATE TABLE `issuer_application_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`document_type` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `issuer_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_issuer_documents_application_type` ON `issuer_application_documents` (`application_id`,`document_type`);--> statement-breakpoint
CREATE INDEX `idx_issuer_documents_organization` ON `issuer_application_documents` (`organization_id`);--> statement-breakpoint
CREATE TABLE `issuer_key_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`canonical_payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text NOT NULL,
	`verified_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `issuer_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_issuer_key_challenges_application_status` ON `issuer_key_challenges` (`application_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_issuer_key_challenges_expiry` ON `issuer_key_challenges` (`expires_at`);--> statement-breakpoint
CREATE TABLE `issuer_verification_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`check_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`evidence_note` text,
	`reviewed_by_user_id` text,
	`reviewed_by_email` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `issuer_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_issuer_checks_application_type` ON `issuer_verification_checks` (`application_id`,`check_type`);--> statement-breakpoint
CREATE INDEX `idx_issuer_checks_organization_status` ON `issuer_verification_checks` (`organization_id`,`status`);--> statement-breakpoint
ALTER TABLE `issuer_applications` ADD `laboratory_website` text;--> statement-breakpoint
ALTER TABLE `issuer_applications` ADD `authority_role` text;--> statement-breakpoint
ALTER TABLE `issuer_applications` ADD `accreditation_status` text DEFAULT 'accredited' NOT NULL;--> statement-breakpoint
CREATE TRIGGER issuer_application_documents_no_update
BEFORE UPDATE ON issuer_application_documents
BEGIN
	SELECT RAISE(ABORT, 'issuer verification documents are immutable');
END;--> statement-breakpoint
CREATE TRIGGER issuer_application_documents_no_delete
BEFORE DELETE ON issuer_application_documents
BEGIN
	SELECT RAISE(ABORT, 'issuer verification documents are append-only');
END;--> statement-breakpoint
CREATE TRIGGER issuer_key_challenges_identity_immutable
BEFORE UPDATE ON issuer_key_challenges
WHEN OLD.id IS NOT NEW.id
  OR OLD.application_id IS NOT NEW.application_id
  OR OLD.organization_id IS NOT NEW.organization_id
  OR OLD.canonical_payload IS NOT NEW.canonical_payload
  OR OLD.expires_at IS NOT NEW.expires_at
  OR OLD.created_at IS NOT NEW.created_at
BEGIN
	SELECT RAISE(ABORT, 'issuer key challenge identity is immutable');
END;--> statement-breakpoint
CREATE TRIGGER issuer_key_challenges_no_delete
BEFORE DELETE ON issuer_key_challenges
BEGIN
	SELECT RAISE(ABORT, 'issuer key challenges are append-only');
END;--> statement-breakpoint
PRAGMA optimize;
