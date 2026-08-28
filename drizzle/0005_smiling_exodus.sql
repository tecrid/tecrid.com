CREATE TABLE `founding_onboarding` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`primary_goal` text NOT NULL,
	`pilot_product` text NOT NULL,
	`estimated_report_count` integer NOT NULL,
	`primary_laboratories` text,
	`target_launch_date` text,
	`notes` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_founding_onboarding_organization_id` ON `founding_onboarding` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_founding_onboarding_status` ON `founding_onboarding` (`status`);