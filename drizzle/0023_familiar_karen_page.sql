CREATE TABLE `issuance_idempotency` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`credential_identifier` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credential_identifier`) REFERENCES `credentials`(`identifier`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sandbox_issuance_idempotency` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`credential_identifier` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credential_identifier`) REFERENCES `sandbox_registry_credentials`(`identifier`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sandbox_registry_credentials` (
	`identifier` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`source_document_hash` text NOT NULL,
	`request_hash` text NOT NULL,
	`document_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sandbox_registry_lab_source` ON `sandbox_registry_credentials` (`organization_id`,`source_document_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_credentials_lab_source_unique` ON `credentials` (`organization_id`,`source_document_hash`) WHERE "credentials"."source_document_hash" IS NOT NULL AND "credentials"."status" <> 'draft';--> statement-breakpoint
CREATE TRIGGER credential_issuance_source_required BEFORE INSERT ON credentials WHEN NEW.status='issued' BEGIN
 SELECT CASE WHEN NEW.source_document_hash IS NULL OR length(NEW.source_document_hash)<>64 OR NEW.source_document_hash GLOB '*[^0-9a-f]*' THEN RAISE(ABORT,'Issued credentials require a source-document SHA-256 hash') END;
END;
--> statement-breakpoint
CREATE TRIGGER controller_receipt_sample_link BEFORE INSERT ON controller_evidence_receipts BEGIN
 SELECT CASE WHEN EXISTS (SELECT 1 FROM credentials c WHERE c.identifier=NEW.credential_identifier AND COALESCE(c.product_sku,'')<>'' AND COALESCE(trim(c.lot_number),'')='' AND COALESCE(json_extract(c.signed_payload,'$.sourceDocument.intakeId'),json_extract(c.signed_payload,'$.credential.sourceDocument.intakeId'),'')='') THEN RAISE(ABORT,'Routed SKU requires signed lot or sample linkage') END;
END;
--> statement-breakpoint
CREATE TRIGGER recipient_delivery_sample_link BEFORE INSERT ON evidence_deliveries BEGIN
 SELECT CASE WHEN EXISTS (SELECT 1 FROM credentials c WHERE c.identifier=NEW.credential_identifier AND COALESCE(c.product_sku,'')<>'' AND COALESCE(trim(c.lot_number),'')='' AND COALESCE(json_extract(c.signed_payload,'$.sourceDocument.intakeId'),json_extract(c.signed_payload,'$.credential.sourceDocument.intakeId'),'')='') THEN RAISE(ABORT,'Routed SKU requires signed lot or sample linkage') END;
END;
--> statement-breakpoint
CREATE TRIGGER issuance_idempotency_immutable BEFORE UPDATE ON issuance_idempotency BEGIN SELECT RAISE(ABORT,'Issuance idempotency bindings are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER issuance_idempotency_no_delete BEFORE DELETE ON issuance_idempotency BEGIN SELECT RAISE(ABORT,'Issuance idempotency bindings are permanent'); END;
--> statement-breakpoint
CREATE TRIGGER sandbox_idempotency_immutable BEFORE UPDATE ON sandbox_issuance_idempotency BEGIN SELECT RAISE(ABORT,'Sandbox idempotency bindings are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER sandbox_idempotency_no_delete BEFORE DELETE ON sandbox_issuance_idempotency BEGIN SELECT RAISE(ABORT,'Sandbox idempotency bindings are permanent'); END;
--> statement-breakpoint
CREATE TRIGGER sandbox_registry_immutable BEFORE UPDATE ON sandbox_registry_credentials BEGIN SELECT RAISE(ABORT,'Sandbox issued records are immutable'); END;
