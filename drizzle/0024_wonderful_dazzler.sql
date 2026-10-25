CREATE TABLE `marketplace_grant_settings` (
	`grant_id` text PRIMARY KEY NOT NULL,
	`public_status` integer DEFAULT false NOT NULL,
	`brand_organization_ids_json` text DEFAULT '[]' NOT NULL,
	`supersedes_grant_id` text,
	`updated_by_user_id` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `marketplace_stream_events` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` integer NOT NULL,
	`stream_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`credential_identifier` text NOT NULL,
	`recipient_organization_id` text NOT NULL,
	`grant_id` text NOT NULL,
	`delivery_id` text NOT NULL,
	`operation` text NOT NULL,
	`semantic_hash` text NOT NULL,
	`body_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marketplace_stream_events_job_id_unique` ON `marketplace_stream_events` (`job_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `marketplace_stream_sequence` ON `marketplace_stream_events` (`stream_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `marketplace_stream_grant` ON `marketplace_stream_events` (`stream_id`,`grant_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `marketplace_stream_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`delivery_id` text NOT NULL,
	`cause` text NOT NULL,
	`created_at` text NOT NULL,
	`processed_at` text,
	`held_reason` text
);
--> statement-breakpoint
CREATE TABLE `marketplace_supplier_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_organization_id` text NOT NULL,
	`recipient_organization_id` text NOT NULL,
	`external_supplier_id` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`reviewed_by_user_id` text NOT NULL,
	`review_note` text NOT NULL,
	`reviewed_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marketplace_mapping_pair` ON `marketplace_supplier_mappings` (`supplier_organization_id`,`recipient_organization_id`);
--> statement-breakpoint
CREATE TRIGGER marketplace_job_delivery AFTER INSERT ON evidence_deliveries BEGIN
 INSERT INTO marketplace_stream_jobs(delivery_id,cause,created_at) SELECT NEW.id,'delivered',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM organizations WHERE id=NEW.recipient_organization_id AND organization_type='marketplace';
END;
--> statement-breakpoint
CREATE TRIGGER marketplace_job_revision AFTER UPDATE OF version,status ON credentials WHEN NEW.version<>OLD.version OR NEW.status<>OLD.status BEGIN
 INSERT INTO marketplace_stream_jobs(delivery_id,cause,created_at) SELECT d.id,'credential_changed',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM evidence_deliveries d JOIN organizations o ON o.id=d.recipient_organization_id WHERE d.credential_identifier=NEW.identifier AND o.organization_type='marketplace';
END;
--> statement-breakpoint
CREATE TRIGGER marketplace_job_grant AFTER UPDATE OF status ON evidence_access_grants WHEN NEW.status<>OLD.status BEGIN
 INSERT INTO marketplace_stream_jobs(delivery_id,cause,created_at) SELECT id,'grant_changed',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM evidence_deliveries WHERE grant_id=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER marketplace_job_authority AFTER UPDATE OF status,grant_ids_json ON routing_authorizations BEGIN
 INSERT INTO marketplace_stream_jobs(delivery_id,cause,created_at) SELECT id,'authority_changed',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM evidence_deliveries WHERE routing_authorization_id=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER marketplace_job_identity AFTER UPDATE OF identity_status,terms_accepted_at,terms_version ON organizations BEGIN
 INSERT INTO marketplace_stream_jobs(delivery_id,cause,created_at) SELECT id,'recipient_changed',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM evidence_deliveries WHERE recipient_organization_id=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER marketplace_job_policy AFTER UPDATE ON delivery_policy BEGIN
 INSERT INTO marketplace_stream_jobs(delivery_id,cause,created_at) SELECT d.id,'terms_policy_changed',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM evidence_deliveries d JOIN organizations o ON o.id=d.recipient_organization_id WHERE o.organization_type='marketplace';
END;
--> statement-breakpoint
CREATE TRIGGER marketplace_job_mapping_insert AFTER INSERT ON marketplace_supplier_mappings BEGIN
 INSERT INTO marketplace_stream_jobs(delivery_id,cause,created_at) SELECT d.id,'mapping_changed',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM evidence_deliveries d JOIN credentials c ON c.identifier=d.credential_identifier WHERE d.recipient_organization_id=NEW.recipient_organization_id AND COALESCE(json_extract(c.signed_payload,'$.originatingSupplier'),json_extract(c.signed_payload,'$.credential.originatingSupplier'))=NEW.supplier_organization_id;
END;
--> statement-breakpoint
CREATE TRIGGER marketplace_job_consent_insert AFTER INSERT ON marketplace_grant_settings BEGIN
 INSERT INTO marketplace_stream_jobs(delivery_id,cause,created_at) SELECT id,'consent_changed',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM evidence_deliveries WHERE grant_id=NEW.grant_id OR grant_id=NEW.supersedes_grant_id;
END;
--> statement-breakpoint
CREATE TRIGGER marketplace_job_mapping_update AFTER UPDATE ON marketplace_supplier_mappings BEGIN
 INSERT INTO marketplace_stream_jobs(delivery_id,cause,created_at) SELECT d.id,'mapping_changed',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM evidence_deliveries d JOIN credentials c ON c.identifier=d.credential_identifier WHERE d.recipient_organization_id=NEW.recipient_organization_id AND COALESCE(json_extract(c.signed_payload,'$.originatingSupplier'),json_extract(c.signed_payload,'$.credential.originatingSupplier'))=NEW.supplier_organization_id;
END;
--> statement-breakpoint
CREATE TRIGGER marketplace_job_consent_update AFTER UPDATE ON marketplace_grant_settings BEGIN
 INSERT INTO marketplace_stream_jobs(delivery_id,cause,created_at) SELECT id,'consent_changed',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM evidence_deliveries WHERE grant_id=NEW.grant_id OR grant_id=NEW.supersedes_grant_id;
END;
--> statement-breakpoint
CREATE TRIGGER marketplace_event_no_update BEFORE UPDATE ON marketplace_stream_events BEGIN SELECT RAISE(ABORT,'Marketplace stream events are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER marketplace_event_no_delete BEFORE DELETE ON marketplace_stream_events BEGIN SELECT RAISE(ABORT,'Marketplace stream events are permanent'); END;
--> statement-breakpoint
CREATE TRIGGER marketplace_event_sequence BEFORE INSERT ON marketplace_stream_events BEGIN SELECT CASE WHEN NEW.sequence<>COALESCE((SELECT MAX(sequence) FROM marketplace_stream_events WHERE stream_id=NEW.stream_id),0)+1 OR COALESCE(json_extract(NEW.body_json,'$.sequence'),0)<>NEW.sequence OR COALESCE(json_extract(NEW.body_json,'$.eventId'),'')<>NEW.id OR COALESCE(json_extract(NEW.body_json,'$.recipient.organizationId'),'')<>NEW.recipient_organization_id OR COALESCE(json_extract(NEW.body_json,'$.credential.tecrid'),'')<>NEW.credential_identifier OR COALESCE(json_extract(NEW.body_json,'$.grant.id'),'')<>NEW.grant_id THEN RAISE(ABORT,'Marketplace stream identity or sequence mismatch') END; END;

--> statement-breakpoint
INSERT INTO marketplace_stream_jobs(delivery_id,cause,created_at) SELECT d.id,'migration_review',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM evidence_deliveries d JOIN organizations o ON o.id=d.recipient_organization_id WHERE o.organization_type='marketplace';
