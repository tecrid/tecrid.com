CREATE TABLE `issuer_decision_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`challenge` text NOT NULL,
	`intent_hash` text NOT NULL,
	`review_version` integer NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `issuer_applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `issuer_decision_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`application_id` text NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`verified_at` text NOT NULL,
	`decision` text NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `issuer_decision_challenges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `issuer_decision_receipts_challenge_id_unique` ON `issuer_decision_receipts` (`challenge_id`);--> statement-breakpoint
CREATE TABLE `issuer_review_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`review_version` integer NOT NULL,
	`reviewer_user_id` text NOT NULL,
	`reviewer_email` text NOT NULL,
	`credential_id` text NOT NULL,
	`verified_at` text NOT NULL,
	`review_note` text NOT NULL,
	`register_evidence` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `issuer_applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_issuer_approval_user` ON `issuer_review_approvals` (`application_id`,`review_version`,`reviewer_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_issuer_approval_email` ON `issuer_review_approvals` (`application_id`,`review_version`,`reviewer_email`);--> statement-breakpoint
CREATE TABLE `issuer_review_mail` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`recipient_email` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`claim_id` text,
	`last_attempt_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `issuer_applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_issuer_review_mail_recipient_kind` ON `issuer_review_mail` (`application_id`,`recipient_email`,`kind`);--> statement-breakpoint
CREATE TABLE `issuer_review_reads` (
	`application_id` text NOT NULL,
	`recipient_email` text NOT NULL,
	`read_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `issuer_applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_issuer_review_read` ON `issuer_review_reads` (`application_id`,`recipient_email`);--> statement-breakpoint
CREATE TABLE `auth_passkey` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`public_key` text NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`counter` integer NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` integer NOT NULL,
	`transports` text,
	`created_at` integer,
	`aaguid` text,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_passkey_credential_id_unique` ON `auth_passkey` (`credential_id`);--> statement-breakpoint
CREATE INDEX `idx_auth_passkey_user` ON `auth_passkey` (`user_id`);--> statement-breakpoint
ALTER TABLE `issuer_applications` ADD `review_version` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER `review_version_issuer_verification_checks_insert` AFTER INSERT ON `issuer_verification_checks` BEGIN UPDATE issuer_applications SET review_version=review_version+1 WHERE id=NEW.application_id; END;
--> statement-breakpoint
CREATE TRIGGER `review_version_issuer_verification_checks_update` AFTER UPDATE ON `issuer_verification_checks` BEGIN UPDATE issuer_applications SET review_version=review_version+1 WHERE id=NEW.application_id; END;
--> statement-breakpoint
CREATE TRIGGER `review_version_issuer_verification_checks_delete` AFTER DELETE ON `issuer_verification_checks` BEGIN UPDATE issuer_applications SET review_version=review_version+1 WHERE id=OLD.application_id; END;
--> statement-breakpoint
CREATE TRIGGER `review_version_issuer_application_documents_insert` AFTER INSERT ON `issuer_application_documents` BEGIN UPDATE issuer_applications SET review_version=review_version+1 WHERE id=NEW.application_id; END;
--> statement-breakpoint
CREATE TRIGGER `review_version_issuer_application_documents_update` AFTER UPDATE ON `issuer_application_documents` BEGIN UPDATE issuer_applications SET review_version=review_version+1 WHERE id=NEW.application_id; END;
--> statement-breakpoint
CREATE TRIGGER `review_version_issuer_application_documents_delete` AFTER DELETE ON `issuer_application_documents` BEGIN UPDATE issuer_applications SET review_version=review_version+1 WHERE id=OLD.application_id; END;
--> statement-breakpoint

CREATE TABLE `passkey_enrollment_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passkey_enrollment_grants_token_hash_unique` ON `passkey_enrollment_grants` (`token_hash`);