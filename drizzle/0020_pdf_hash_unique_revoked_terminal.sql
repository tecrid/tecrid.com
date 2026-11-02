DROP INDEX `idx_credentials_source_document_hash`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_credentials_source_document_hash` ON `credentials` (`source_document_hash`);--> statement-breakpoint
ALTER TABLE `legacy_reports` ADD `pending_credential_identifier` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_legacy_reports_pending_credential_identifier` ON `legacy_reports` (`pending_credential_identifier`);--> statement-breakpoint
CREATE TRIGGER `credentials_revoked_is_terminal`
BEFORE UPDATE OF `status` ON `credentials`
WHEN OLD.`status` = 'revoked' AND NEW.`status` != 'revoked'
BEGIN
	SELECT RAISE(ABORT, 'revoked TECRID status is terminal');
END;--> statement-breakpoint
CREATE TRIGGER `credentials_lot_is_bound`
BEFORE UPDATE OF `lot_number` ON `credentials`
WHEN OLD.`lot_number` IS NOT NEW.`lot_number`
BEGIN
	SELECT RAISE(ABORT, 'a TECRID is bound to one lot');
END;
