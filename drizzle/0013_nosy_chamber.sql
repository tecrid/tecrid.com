CREATE TABLE `evidence_share_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`controller_organization_id` text NOT NULL,
	`recipient_organization_id` text NOT NULL,
	`label` text NOT NULL,
	`purpose` text NOT NULL,
	`scope_mode` text NOT NULL,
	`scope_json` text NOT NULL,
	`access_level` text NOT NULL,
	`analyte_scope_json` text,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`token_last_four` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	`redeemed_at` text,
	`revoked_by_user_id` text,
	`revoked_at` text,
	FOREIGN KEY (`controller_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recipient_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_evidence_share_codes_token_hash` ON `evidence_share_codes` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_evidence_share_codes_controller_status` ON `evidence_share_codes` (`controller_organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_evidence_share_codes_recipient_status` ON `evidence_share_codes` (`recipient_organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `evidence_share_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`share_code_id` text NOT NULL,
	`controller_organization_id` text NOT NULL,
	`recipient_organization_id` text NOT NULL,
	`package_json` text NOT NULL,
	`package_fingerprint` text NOT NULL,
	`record_count` integer NOT NULL,
	`redeemed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`share_code_id`) REFERENCES `evidence_share_codes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`controller_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recipient_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_evidence_share_redemptions_code` ON `evidence_share_redemptions` (`share_code_id`);--> statement-breakpoint
CREATE INDEX `idx_evidence_share_redemptions_recipient_created` ON `evidence_share_redemptions` (`recipient_organization_id`,`redeemed_at`);--> statement-breakpoint
CREATE TABLE `laboratory_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`controller_organization_id` text NOT NULL,
	`laboratory_name` text NOT NULL,
	`laboratory_email` text NOT NULL,
	`product_skus_json` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'drafted' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`sent_at` text,
	FOREIGN KEY (`controller_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_laboratory_invitations_controller_created` ON `laboratory_invitations` (`controller_organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `participant_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`public_slug` text NOT NULL,
	`display_name` text NOT NULL,
	`website` text,
	`summary` text NOT NULL,
	`participation_status` text DEFAULT 'active' NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`registry_verified` integer DEFAULT false NOT NULL,
	`published_at` text,
	`updated_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_participant_profiles_organization` ON `participant_profiles` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_participant_profiles_slug` ON `participant_profiles` (`public_slug`);--> statement-breakpoint
CREATE INDEX `idx_participant_profiles_public_status` ON `participant_profiles` (`is_public`,`participation_status`);--> statement-breakpoint
INSERT INTO `organizations` (`id`,`name`,`slug`,`organization_type`,`website`,`owner_user_id`,`owner_email`,`issuer_code`,`issuer_status`,`plan`,`created_at`,`updated_at`) VALUES
  ('org_paleo_foundation','Paleo Foundation','paleo-foundation','certification_body','https://paleofoundation.com','system:registry-pilot:paleo','system@tecrid.com','PALEO','not_applicable','free',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('org_heavy_metal_tested_certified','Heavy Metal Tested & Certified','heavy-metal-tested-certified','certification_body','https://heavymetalcertified.com','system:registry-pilot:hmtc','system@tecrid.com','HMTC','not_applicable','free',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);--> statement-breakpoint
INSERT INTO `participant_profiles` (`id`,`organization_id`,`public_slug`,`display_name`,`website`,`summary`,`participation_status`,`is_public`,`registry_verified`,`published_at`,`created_at`,`updated_at`) VALUES
  ('participant_paleo_foundation','org_paleo_foundation','paleo-foundation','Paleo Foundation','https://paleofoundation.com','Certification organization integrating TECRID evidence intake and supply-chain traceability into its brand portal.','integration_pilot',1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('participant_heavy_metal_tested_certified','org_heavy_metal_tested_certified','heavy-metal-tested-certified','Heavy Metal Tested & Certified','https://heavymetalcertified.com','Third-party testing and certification program integrating recipient-bound TECRID evidence packages into readiness review.','integration_pilot',1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);--> statement-breakpoint
CREATE TRIGGER evidence_share_codes_identity_immutable
BEFORE UPDATE ON evidence_share_codes
WHEN OLD.id IS NOT NEW.id
  OR OLD.controller_organization_id IS NOT NEW.controller_organization_id
  OR OLD.recipient_organization_id IS NOT NEW.recipient_organization_id
  OR OLD.label IS NOT NEW.label
  OR OLD.purpose IS NOT NEW.purpose
  OR OLD.scope_mode IS NOT NEW.scope_mode
  OR OLD.scope_json IS NOT NEW.scope_json
  OR OLD.access_level IS NOT NEW.access_level
  OR OLD.analyte_scope_json IS NOT NEW.analyte_scope_json
  OR OLD.token_hash IS NOT NEW.token_hash
  OR OLD.token_prefix IS NOT NEW.token_prefix
  OR OLD.token_last_four IS NOT NEW.token_last_four
  OR OLD.created_by_user_id IS NOT NEW.created_by_user_id
  OR OLD.created_at IS NOT NEW.created_at
  OR OLD.expires_at IS NOT NEW.expires_at
BEGIN
  SELECT RAISE(ABORT, 'evidence share code scope is immutable');
END;--> statement-breakpoint
CREATE TRIGGER evidence_share_redemptions_no_update
BEFORE UPDATE ON evidence_share_redemptions
BEGIN
  SELECT RAISE(ABORT, 'evidence share redemptions are immutable');
END;--> statement-breakpoint
CREATE TRIGGER evidence_share_redemptions_no_delete
BEFORE DELETE ON evidence_share_redemptions
BEGIN
  SELECT RAISE(ABORT, 'evidence share redemptions are append-only');
END;
