ALTER TABLE `credential_versions` ADD `issuer_public_key_jwk` text;--> statement-breakpoint
ALTER TABLE `credential_versions` ADD `issuer_key_verified_at` text;--> statement-breakpoint
ALTER TABLE `credential_versions` ADD `signed_payload` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `issuer_public_key_jwk` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `issuer_key_verified_at` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `signed_payload` text;--> statement-breakpoint
CREATE TRIGGER `credential_versions_no_update`
BEFORE UPDATE ON `credential_versions`
BEGIN
	SELECT RAISE(ABORT, 'credential_versions is append-only');
END;--> statement-breakpoint
CREATE TRIGGER `credential_versions_no_delete`
BEFORE DELETE ON `credential_versions`
BEGIN
	SELECT RAISE(ABORT, 'credential_versions is append-only');
END;
