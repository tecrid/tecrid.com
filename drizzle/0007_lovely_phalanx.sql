CREATE TABLE `disclosure_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`product_id` text NOT NULL,
	`import_id` text,
	`batch_code` text NOT NULL,
	`production_date` text NOT NULL,
	`shelf_life_end` text NOT NULL,
	`retention_until` text NOT NULL,
	`status` text DEFAULT 'ready_for_review' NOT NULL,
	`source_type` text DEFAULT 'csv_import' NOT NULL,
	`laboratory_name` text NOT NULL,
	`lab_report_number` text NOT NULL,
	`source_sha256` text NOT NULL,
	`lab_confirmed` integer DEFAULT false NOT NULL,
	`linked_tecrid` text,
	`public_record` integer DEFAULT false NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `disclosure_products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`import_id`) REFERENCES `disclosure_imports`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_disclosure_batches_product_code` ON `disclosure_batches` (`product_id`,`batch_code`);--> statement-breakpoint
CREATE INDEX `idx_disclosure_batches_org_status` ON `disclosure_batches` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_disclosure_batches_product` ON `disclosure_batches` (`product_id`);--> statement-breakpoint
CREATE TABLE `disclosure_import_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`import_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`status` text NOT NULL,
	`product_name` text,
	`batch_code` text,
	`payload` text NOT NULL,
	`errors` text,
	`disclosure_batch_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `disclosure_imports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`disclosure_batch_id`) REFERENCES `disclosure_batches`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_disclosure_import_rows_import_row` ON `disclosure_import_rows` (`import_id`,`row_number`);--> statement-breakpoint
CREATE INDEX `idx_disclosure_import_rows_status` ON `disclosure_import_rows` (`import_id`,`status`);--> statement-breakpoint
CREATE TABLE `disclosure_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`source_name` text NOT NULL,
	`source_sha256` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`ready_rows` integer DEFAULT 0 NOT NULL,
	`blocked_rows` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_disclosure_imports_org_created` ON `disclosure_imports` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `disclosure_products` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sku` text NOT NULL,
	`upc` text,
	`category` text,
	`age_range` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_disclosure_products_org_slug` ON `disclosure_products` (`organization_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_disclosure_products_org_sku` ON `disclosure_products` (`organization_id`,`sku`);--> statement-breakpoint
CREATE TABLE `disclosure_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` text NOT NULL,
	`analyte` text NOT NULL,
	`symbol` text NOT NULL,
	`result_text` text NOT NULL,
	`numeric_value` real,
	`unit` text DEFAULT 'ppb' NOT NULL,
	`loq_text` text,
	`sequence` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `disclosure_batches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_disclosure_results_batch_analyte` ON `disclosure_results` (`batch_id`,`analyte`);--> statement-breakpoint
PRAGMA optimize;
