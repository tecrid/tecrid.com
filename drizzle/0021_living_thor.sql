CREATE TABLE `credential_routing_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`credential_identifier` text NOT NULL,
	`authorization_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`credential_identifier`) REFERENCES `credentials`(`identifier`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`authorization_id`) REFERENCES `routing_authorizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_credential_routing_jobs_credential_authorization` ON `credential_routing_jobs` (`credential_identifier`,`authorization_id`);--> statement-breakpoint
CREATE INDEX `idx_credential_routing_jobs_due` ON `credential_routing_jobs` (`status`,`next_attempt_at`);--> statement-breakpoint
ALTER TABLE `credentials` ADD `ingredient_code` text;--> statement-breakpoint
ALTER TABLE `routing_authorizations` ADD `authorization_kind` text DEFAULT 'token' NOT NULL;--> statement-breakpoint
ALTER TABLE `routing_authorizations` ADD `grant_ids_json` text;--> statement-breakpoint
ALTER TABLE `routing_authorizations` ADD `ingredient_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_standing_active_sku` ON `routing_authorizations` (`controller_organization_id`,`laboratory_organization_id`,`product_sku`) WHERE authorization_kind='standing' AND status='active' AND ingredient_code IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_standing_active_ingredient` ON `routing_authorizations` (`controller_organization_id`,`laboratory_organization_id`,`ingredient_code`) WHERE authorization_kind='standing' AND status='active' AND product_sku='';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_standing_active_both` ON `routing_authorizations` (`controller_organization_id`,`laboratory_organization_id`,`product_sku`,`ingredient_code`) WHERE authorization_kind='standing' AND status='active' AND ingredient_code IS NOT NULL AND product_sku<>'';--> statement-breakpoint
CREATE TRIGGER route_controller_receipt_authority BEFORE INSERT ON controller_evidence_receipts BEGIN
 SELECT CASE WHEN NOT EXISTS (
 SELECT 1 FROM routing_authorizations a JOIN credentials c ON c.identifier=NEW.credential_identifier
 WHERE a.id=NEW.routing_authorization_id AND a.status='active'
 AND (a.authorization_kind='standing' OR a.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))
 AND a.controller_organization_id=NEW.controller_organization_id AND a.laboratory_organization_id=c.organization_id
 AND (a.authorization_kind='standing' OR a.product_sku=c.product_sku)
 AND (a.authorization_kind!='standing' OR ((a.ingredient_code IS NULL AND c.ingredient_code IS NULL) OR a.ingredient_code=c.ingredient_code)) AND c.status='issued' AND c.version=NEW.credential_version
 ) THEN RAISE(ABORT,'Routing authority is no longer current') END;
END;
--> statement-breakpoint
CREATE TRIGGER route_recipient_delivery_authority BEFORE INSERT ON evidence_deliveries BEGIN
 SELECT CASE WHEN NOT EXISTS (
 SELECT 1 FROM routing_authorizations a JOIN credentials c ON c.identifier=NEW.credential_identifier JOIN evidence_access_grants g ON g.id=NEW.grant_id
 WHERE a.id=NEW.routing_authorization_id AND a.status='active'
 AND (a.authorization_kind='standing' OR a.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))
 AND a.controller_organization_id=NEW.controller_organization_id AND a.laboratory_organization_id=c.organization_id
 AND (a.authorization_kind='standing' OR a.product_sku=c.product_sku)
 AND (a.authorization_kind!='standing' OR ((a.ingredient_code IS NULL AND c.ingredient_code IS NULL) OR a.ingredient_code=c.ingredient_code)) AND c.status='issued' AND c.version=NEW.credential_version
 AND g.status='active' AND g.controller_organization_id=a.controller_organization_id AND ((a.authorization_kind='standing' AND a.ingredient_code IS NOT NULL AND a.product_sku='') OR g.product_sku=c.product_sku)
 AND g.recipient_organization_id=NEW.recipient_organization_id AND g.access_level=NEW.access_level
 AND (a.authorization_kind!='standing' OR EXISTS (SELECT 1 FROM json_each(a.grant_ids_json) WHERE value=g.id))
 ) THEN RAISE(ABORT,'Recipient routing authority is no longer current') END;
END;
