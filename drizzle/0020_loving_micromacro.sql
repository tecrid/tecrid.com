CREATE TABLE `notification_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`destination_hash` text NOT NULL,
	`encrypted_config` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notification_channel_destination` ON `notification_channels` (`organization_id`,`kind`,`destination_hash`);--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text NOT NULL,
	`lease_until` text,
	`lease_token` text,
	`delivered_at` text,
	`acknowledged_at` text,
	`last_status_code` integer,
	`last_error` text,
	FOREIGN KEY (`event_id`) REFERENCES `notification_outbox`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `notification_channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notification_delivery_event_channel` ON `notification_deliveries` (`event_id`,`channel_id`);--> statement-breakpoint
CREATE INDEX `idx_notification_delivery_due` ON `notification_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `notification_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`event_type` text NOT NULL,
	`product_sku` text,
	`entity_id` text NOT NULL,
	`action_path` text NOT NULL,
	`occurred_at` text NOT NULL,
	`expanded_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notification_outbox_pending` ON `notification_outbox` (`expanded_at`,`occurred_at`);
--> statement-breakpoint
CREATE TRIGGER notification_outbox_on_insert AFTER INSERT ON organization_notifications BEGIN
 INSERT OR IGNORE INTO notification_outbox (id, organization_id, event_type, product_sku, entity_id, action_path, occurred_at)
 VALUES (CASE WHEN NEW.event_type IN ('credential.issued','credential.corrected','credential.revoked') AND EXISTS (SELECT 1 FROM credentials WHERE identifier=NEW.entity_id) THEN 'credential:' || NEW.entity_id || ':' || (SELECT version FROM credentials WHERE identifier=NEW.entity_id) || ':' || NEW.organization_id ELSE 'notification:' || NEW.id END, NEW.organization_id, NEW.event_type,
 COALESCE((SELECT product_sku FROM credentials WHERE identifier=NEW.entity_id),
 (SELECT c.product_sku FROM evidence_deliveries d JOIN credentials c ON c.identifier=d.credential_identifier WHERE d.id=NEW.entity_id),
 (SELECT product_sku FROM report_reservations WHERE id=NEW.entity_id)),
 NEW.entity_id, COALESCE(NEW.action_path, '/dashboard'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER notification_outbox_on_issuance AFTER INSERT ON credentials WHEN NEW.status='issued' BEGIN
 INSERT INTO notification_outbox (id, organization_id, event_type, product_sku, entity_id, action_path, occurred_at)
 VALUES ('credential:' || NEW.identifier || ':1:' || NEW.organization_id, NEW.organization_id, 'credential.issued', NEW.product_sku, NEW.identifier, '/dashboard/issuance', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER notification_outbox_on_revision AFTER UPDATE OF version ON credentials WHEN NEW.version > OLD.version BEGIN
 INSERT OR IGNORE INTO notification_outbox (id, organization_id, event_type, product_sku, entity_id, action_path, occurred_at)
 SELECT 'credential:' || NEW.identifier || ':' || NEW.version || ':' || org_id, org_id,
 CASE WHEN NEW.status='revoked' THEN 'credential.revoked' ELSE 'credential.corrected' END,
 NEW.product_sku, NEW.identifier, '/dashboard/evidence-routing', strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM (
 SELECT NEW.organization_id AS org_id
 UNION SELECT controller_organization_id FROM controller_evidence_receipts WHERE credential_identifier=NEW.identifier
 UNION SELECT d.recipient_organization_id FROM evidence_deliveries d JOIN evidence_access_grants g ON g.id=d.grant_id WHERE d.credential_identifier=NEW.identifier AND g.status IN ('active','fulfilled')
 );
END;
--> statement-breakpoint
CREATE TRIGGER notification_outbox_on_route AFTER INSERT ON evidence_deliveries BEGIN
 INSERT OR IGNORE INTO notification_outbox (id, organization_id, event_type, product_sku, entity_id, action_path, occurred_at)
 SELECT 'routed:' || NEW.id, laboratory_organization_id, 'credential.routed', product_sku, NEW.credential_identifier, '/dashboard/issuance', strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM routing_authorizations WHERE id=NEW.routing_authorization_id;
END;
--> statement-breakpoint
CREATE TRIGGER notification_outbox_on_claim AFTER INSERT ON legacy_report_events WHEN NEW.event_type='report.claimed' BEGIN
 INSERT OR IGNORE INTO notification_outbox (id, organization_id, event_type, product_sku, entity_id, action_path, occurred_at)
 VALUES ('claimed:' || NEW.id, NEW.organization_id, 'credential.claimed', NULL, NEW.legacy_report_id, '/dashboard/reports/' || NEW.legacy_report_id, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
