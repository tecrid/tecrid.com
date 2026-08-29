ALTER TABLE `certification_intakes` ADD `manifest_json` text NOT NULL;
--> statement-breakpoint
PRAGMA optimize;
