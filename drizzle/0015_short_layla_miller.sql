ALTER TABLE `api_keys` ADD `scopes` text DEFAULT '["*"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `report_reservations` ADD `idempotency_key` text;--> statement-breakpoint
ALTER TABLE `report_reservations` ADD `request_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_report_reservations_idempotency` ON `report_reservations` (`laboratory_organization_id`,`idempotency_key`);