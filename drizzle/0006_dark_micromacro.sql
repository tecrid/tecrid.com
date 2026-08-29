CREATE TABLE `sandbox_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`key_prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`last_four` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `sandbox_sessions`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sandbox_api_keys_key_hash` ON `sandbox_api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `idx_sandbox_api_keys_user_id` ON `sandbox_api_keys` (`user_id`);--> statement-breakpoint
CREATE TABLE `sandbox_sessions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`stage` text DEFAULT 'submitted' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sandbox_sessions_updated_at` ON `sandbox_sessions` (`updated_at`);