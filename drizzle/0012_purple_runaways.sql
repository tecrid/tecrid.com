CREATE TABLE `controller_evidence_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`routing_authorization_id` text NOT NULL,
	`controller_organization_id` text NOT NULL,
	`laboratory_organization_id` text NOT NULL,
	`credential_identifier` text NOT NULL,
	`credential_version` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`snapshot_fingerprint` text NOT NULL,
	`delivered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`routing_authorization_id`) REFERENCES `routing_authorizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`controller_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`laboratory_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`credential_identifier`) REFERENCES `credentials`(`identifier`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_controller_receipts_org_credential` ON `controller_evidence_receipts` (`controller_organization_id`,`credential_identifier`);--> statement-breakpoint
CREATE INDEX `idx_controller_receipts_org_created` ON `controller_evidence_receipts` (`controller_organization_id`,`delivered_at`);--> statement-breakpoint
CREATE INDEX `idx_controller_receipts_lab_created` ON `controller_evidence_receipts` (`laboratory_organization_id`,`delivered_at`);--> statement-breakpoint
CREATE TABLE `organization_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`event_type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`action_path` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`status` text DEFAULT 'unread' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`read_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_organization_notifications_status_created` ON `organization_notifications` (`organization_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `report_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`laboratory_organization_id` text NOT NULL,
	`controller_organization_id` text,
	`routing_authorization_id` text,
	`product_name` text NOT NULL,
	`product_sku` text NOT NULL,
	`laboratory_report_number` text,
	`source_system` text DEFAULT 'generic' NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`expires_at` text NOT NULL,
	`finalized_credential_identifier` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`finalized_at` text,
	FOREIGN KEY (`laboratory_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`controller_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`routing_authorization_id`) REFERENCES `routing_authorizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`finalized_credential_identifier`) REFERENCES `credentials`(`identifier`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_report_reservations_identifier` ON `report_reservations` (`identifier`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_report_reservations_finalized_credential` ON `report_reservations` (`finalized_credential_identifier`);--> statement-breakpoint
CREATE INDEX `idx_report_reservations_lab_status` ON `report_reservations` (`laboratory_organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_report_reservations_controller_created` ON `report_reservations` (`controller_organization_id`,`created_at`);
--> statement-breakpoint
CREATE TRIGGER controller_evidence_receipts_no_update
BEFORE UPDATE ON controller_evidence_receipts
BEGIN
  SELECT RAISE(ABORT, 'controller evidence receipts are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER controller_evidence_receipts_no_delete
BEFORE DELETE ON controller_evidence_receipts
BEGIN
  SELECT RAISE(ABORT, 'controller evidence receipts are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER report_reservations_identity_immutable
BEFORE UPDATE ON report_reservations
WHEN OLD.id IS NOT NEW.id
  OR OLD.identifier IS NOT NEW.identifier
  OR OLD.laboratory_organization_id IS NOT NEW.laboratory_organization_id
  OR OLD.controller_organization_id IS NOT NEW.controller_organization_id
  OR OLD.routing_authorization_id IS NOT NEW.routing_authorization_id
  OR OLD.product_name IS NOT NEW.product_name
  OR OLD.product_sku IS NOT NEW.product_sku
  OR OLD.laboratory_report_number IS NOT NEW.laboratory_report_number
  OR OLD.source_system IS NOT NEW.source_system
  OR OLD.expires_at IS NOT NEW.expires_at
  OR OLD.created_at IS NOT NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'report reservation identity is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER report_reservations_no_delete
BEFORE DELETE ON report_reservations
BEGIN
  SELECT RAISE(ABORT, 'report reservations are append-only');
END;
--> statement-breakpoint
PRAGMA optimize;
