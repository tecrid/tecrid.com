CREATE TABLE `evidence_access_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`controller_organization_id` text NOT NULL,
	`recipient_organization_id` text NOT NULL,
	`product_name` text NOT NULL,
	`product_sku` text NOT NULL,
	`access_level` text NOT NULL,
	`analyte_scope_json` text,
	`delivery_mode` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_by_user_id` text,
	`revoked_at` text,
	FOREIGN KEY (`request_id`) REFERENCES `evidence_requests`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`controller_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recipient_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_evidence_grants_request` ON `evidence_access_grants` (`request_id`);--> statement-breakpoint
CREATE INDEX `idx_evidence_grants_controller_sku_status` ON `evidence_access_grants` (`controller_organization_id`,`product_sku`,`status`);--> statement-breakpoint
CREATE INDEX `idx_evidence_grants_recipient_status` ON `evidence_access_grants` (`recipient_organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `evidence_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`grant_id` text NOT NULL,
	`routing_authorization_id` text NOT NULL,
	`controller_organization_id` text NOT NULL,
	`recipient_organization_id` text NOT NULL,
	`credential_identifier` text NOT NULL,
	`credential_version` integer NOT NULL,
	`access_level` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`snapshot_fingerprint` text NOT NULL,
	`delivered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`grant_id`) REFERENCES `evidence_access_grants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`routing_authorization_id`) REFERENCES `routing_authorizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`controller_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recipient_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`credential_identifier`) REFERENCES `credentials`(`identifier`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_evidence_deliveries_grant_credential` ON `evidence_deliveries` (`grant_id`,`credential_identifier`);--> statement-breakpoint
CREATE INDEX `idx_evidence_deliveries_recipient_created` ON `evidence_deliveries` (`recipient_organization_id`,`delivered_at`);--> statement-breakpoint
CREATE INDEX `idx_evidence_deliveries_controller_created` ON `evidence_deliveries` (`controller_organization_id`,`delivered_at`);--> statement-breakpoint
CREATE TABLE `evidence_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_organization_id` text NOT NULL,
	`controller_organization_id` text NOT NULL,
	`program_name` text NOT NULL,
	`purpose` text NOT NULL,
	`product_name` text NOT NULL,
	`product_sku` text NOT NULL,
	`access_level` text NOT NULL,
	`analyte_scope_json` text,
	`delivery_mode` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by_user_id` text NOT NULL,
	`responded_by_user_id` text,
	`requested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`responded_at` text,
	FOREIGN KEY (`requester_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`controller_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_evidence_requests_requester_created` ON `evidence_requests` (`requester_organization_id`,`requested_at`);--> statement-breakpoint
CREATE INDEX `idx_evidence_requests_controller_status` ON `evidence_requests` (`controller_organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `routing_authorizations` (
	`id` text PRIMARY KEY NOT NULL,
	`controller_organization_id` text NOT NULL,
	`laboratory_organization_id` text NOT NULL,
	`product_name` text NOT NULL,
	`product_sku` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`token_last_four` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	`last_used_at` text,
	`revoked_by_user_id` text,
	`revoked_at` text,
	FOREIGN KEY (`controller_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`laboratory_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_routing_authorizations_token_hash` ON `routing_authorizations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_routing_authorizations_controller_sku` ON `routing_authorizations` (`controller_organization_id`,`product_sku`);--> statement-breakpoint
CREATE INDEX `idx_routing_authorizations_lab_status` ON `routing_authorizations` (`laboratory_organization_id`,`status`);--> statement-breakpoint
ALTER TABLE `credentials` ADD `visibility` text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `sandbox_sessions` ADD `certification_request_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `sandbox_sessions` ADD `certifier_delivery_status` text DEFAULT 'not_delivered' NOT NULL;--> statement-breakpoint
ALTER TABLE `sandbox_sessions` ADD `retailer_grant_status` text DEFAULT 'not_granted' NOT NULL;--> statement-breakpoint
ALTER TABLE `sandbox_sessions` ADD `retailer_delivery_status` text DEFAULT 'not_delivered' NOT NULL;--> statement-breakpoint
ALTER TABLE `sandbox_sessions` ADD `routing_status` text DEFAULT 'waiting' NOT NULL;--> statement-breakpoint
CREATE TRIGGER evidence_requests_scope_immutable
BEFORE UPDATE ON evidence_requests
WHEN OLD.id IS NOT NEW.id
  OR OLD.requester_organization_id IS NOT NEW.requester_organization_id
  OR OLD.controller_organization_id IS NOT NEW.controller_organization_id
  OR OLD.program_name IS NOT NEW.program_name
  OR OLD.purpose IS NOT NEW.purpose
  OR OLD.product_name IS NOT NEW.product_name
  OR OLD.product_sku IS NOT NEW.product_sku
  OR OLD.access_level IS NOT NEW.access_level
  OR OLD.analyte_scope_json IS NOT NEW.analyte_scope_json
  OR OLD.delivery_mode IS NOT NEW.delivery_mode
  OR OLD.requested_by_user_id IS NOT NEW.requested_by_user_id
  OR OLD.requested_at IS NOT NEW.requested_at
BEGIN
  SELECT RAISE(ABORT, 'evidence request scope is immutable');
END;--> statement-breakpoint
CREATE TRIGGER evidence_requests_no_delete
BEFORE DELETE ON evidence_requests
BEGIN
  SELECT RAISE(ABORT, 'evidence requests are append-only');
END;--> statement-breakpoint
CREATE TRIGGER evidence_grants_scope_immutable
BEFORE UPDATE ON evidence_access_grants
WHEN OLD.id IS NOT NEW.id
  OR OLD.request_id IS NOT NEW.request_id
  OR OLD.controller_organization_id IS NOT NEW.controller_organization_id
  OR OLD.recipient_organization_id IS NOT NEW.recipient_organization_id
  OR OLD.product_name IS NOT NEW.product_name
  OR OLD.product_sku IS NOT NEW.product_sku
  OR OLD.access_level IS NOT NEW.access_level
  OR OLD.analyte_scope_json IS NOT NEW.analyte_scope_json
  OR OLD.delivery_mode IS NOT NEW.delivery_mode
  OR OLD.created_by_user_id IS NOT NEW.created_by_user_id
  OR OLD.created_at IS NOT NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'evidence grant scope is immutable');
END;--> statement-breakpoint
CREATE TRIGGER evidence_grants_no_delete
BEFORE DELETE ON evidence_access_grants
BEGIN
  SELECT RAISE(ABORT, 'evidence grants are append-only');
END;--> statement-breakpoint
CREATE TRIGGER routing_authorizations_identity_immutable
BEFORE UPDATE ON routing_authorizations
WHEN OLD.id IS NOT NEW.id
  OR OLD.controller_organization_id IS NOT NEW.controller_organization_id
  OR OLD.laboratory_organization_id IS NOT NEW.laboratory_organization_id
  OR OLD.product_name IS NOT NEW.product_name
  OR OLD.product_sku IS NOT NEW.product_sku
  OR OLD.token_hash IS NOT NEW.token_hash
  OR OLD.token_prefix IS NOT NEW.token_prefix
  OR OLD.token_last_four IS NOT NEW.token_last_four
  OR OLD.created_by_user_id IS NOT NEW.created_by_user_id
  OR OLD.created_at IS NOT NEW.created_at
  OR OLD.expires_at IS NOT NEW.expires_at
BEGIN
  SELECT RAISE(ABORT, 'routing authorization identity is immutable');
END;--> statement-breakpoint
CREATE TRIGGER routing_authorizations_no_delete
BEFORE DELETE ON routing_authorizations
BEGIN
  SELECT RAISE(ABORT, 'routing authorizations are append-only');
END;--> statement-breakpoint
CREATE TRIGGER evidence_deliveries_no_update
BEFORE UPDATE ON evidence_deliveries
BEGIN
  SELECT RAISE(ABORT, 'evidence deliveries are immutable');
END;--> statement-breakpoint
CREATE TRIGGER evidence_deliveries_no_delete
BEFORE DELETE ON evidence_deliveries
BEGIN
  SELECT RAISE(ABORT, 'evidence deliveries are append-only');
END;--> statement-breakpoint
PRAGMA optimize;
