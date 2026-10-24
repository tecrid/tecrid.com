CREATE TABLE `sample_lab_proofs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`test_identifier` text NOT NULL,
	`canonical_payload` text NOT NULL,
	`payload_hash` text NOT NULL,
	`public_key_jwk` text NOT NULL,
	`signature` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sample_lab_user_report` ON `sample_lab_proofs` (`user_id`,`test_identifier`);