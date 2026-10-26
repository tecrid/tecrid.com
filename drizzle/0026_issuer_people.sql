CREATE TABLE `issuer_people` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`email_domain` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`identity_status` text DEFAULT 'pending' NOT NULL,
	`identity_verified_at` text,
	`approved_by_user_id` text,
	`approved_at` text,
	`removed_at` text,
	`suspended_at` text,
	`status_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_issuer_person_lab_user` ON `issuer_people` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_issuer_person_lab_status` ON `issuer_people` (`organization_id`,`status`);--> statement-breakpoint
ALTER TABLE `api_keys` ADD `issuer_person_id` text;--> statement-breakpoint
ALTER TABLE `credential_versions` ADD `issuer_person_id` text;--> statement-breakpoint
ALTER TABLE `credential_versions` ADD `issuer_user_id` text;--> statement-breakpoint
ALTER TABLE `credential_versions` ADD `issuer_display_name` text;--> statement-breakpoint
ALTER TABLE `credential_versions` ADD `issuing_api_key_id` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `issuer_person_id` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `issuer_user_id` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `issuer_display_name` text;--> statement-breakpoint
ALTER TABLE `credentials` ADD `issuing_api_key_id` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `verified_email_domain` text;
--> statement-breakpoint
UPDATE organizations SET verified_email_domain=(
 SELECT lower(substr(a.contact_email,instr(a.contact_email,'@')+1))
 FROM issuer_applications a JOIN audit_events e ON e.entity_id=a.id
 WHERE a.organization_id=organizations.id AND a.status='approved'
 AND e.event_type='issuer.application_submitted'
 AND json_valid(e.payload) AND json_extract(e.payload,'$.signupVerificationVersion')=1
 ORDER BY a.reviewed_at DESC LIMIT 1
) WHERE organization_type='laboratory' AND issuer_status='verified';

--> statement-breakpoint
CREATE TRIGGER credentials_person_insert BEFORE INSERT ON credentials
WHEN NEW.public_record=1 AND NOT EXISTS(SELECT 1 FROM issuer_people p JOIN organizations o ON o.id=p.organization_id
 JOIN auth_user u ON 'email:'||u.id=p.user_id
 JOIN organization_members m ON m.user_id=p.user_id AND m.organization_id=o.id
 WHERE o.id=NEW.organization_id AND o.organization_type='laboratory' AND o.issuer_status='verified'
 AND p.id=NEW.issuer_person_id AND p.user_id=NEW.issuer_user_id AND p.status='active'
 AND p.identity_status='verified' AND p.identity_verified_at IS NOT NULL AND p.approved_at IS NOT NULL
 AND u.email_verified=1 AND lower(u.email)=p.email AND p.email_domain=o.verified_email_domain
 AND p.email_domain=lower(substr(u.email,instr(u.email,'@')+1))
 AND EXISTS(SELECT 1 FROM auth_passkey k WHERE k.user_id=u.id) AND p.display_name=NEW.issuer_display_name AND (NEW.issuing_api_key_id IS NULL OR EXISTS(SELECT 1 FROM api_keys k WHERE k.id=NEW.issuing_api_key_id
 AND k.organization_id=o.id AND k.created_by_user_id=p.user_id AND k.issuer_person_id=p.id AND k.revoked_at IS NULL)))
BEGIN SELECT RAISE(ABORT,'Active verified issuer person required'); END;

--> statement-breakpoint
CREATE TRIGGER credential_versions_person_insert BEFORE INSERT ON credential_versions
WHEN 1=1 AND NOT EXISTS(SELECT 1 FROM issuer_people p JOIN organizations o ON o.id=p.organization_id
 JOIN auth_user u ON 'email:'||u.id=p.user_id
 JOIN organization_members m ON m.user_id=p.user_id AND m.organization_id=o.id
 WHERE o.id=(SELECT organization_id FROM credentials WHERE identifier=NEW.credential_identifier) AND o.organization_type='laboratory' AND o.issuer_status='verified'
 AND p.id=NEW.issuer_person_id AND p.user_id=NEW.issuer_user_id AND p.status='active'
 AND p.identity_status='verified' AND p.identity_verified_at IS NOT NULL AND p.approved_at IS NOT NULL
 AND u.email_verified=1 AND lower(u.email)=p.email AND p.email_domain=o.verified_email_domain
 AND p.email_domain=lower(substr(u.email,instr(u.email,'@')+1))
 AND EXISTS(SELECT 1 FROM auth_passkey k WHERE k.user_id=u.id) AND p.display_name=NEW.issuer_display_name AND (NEW.issuing_api_key_id IS NULL OR EXISTS(SELECT 1 FROM api_keys k WHERE k.id=NEW.issuing_api_key_id
 AND k.organization_id=o.id AND k.created_by_user_id=p.user_id AND k.issuer_person_id=p.id AND k.revoked_at IS NULL)))
BEGIN SELECT RAISE(ABORT,'Active verified issuer person required'); END;

--> statement-breakpoint
CREATE TRIGGER credential_person_immutable BEFORE UPDATE OF issuer_person_id,issuer_user_id,issuer_display_name,issuing_api_key_id ON credentials
WHEN OLD.public_record=1 AND (NEW.issuer_person_id IS NOT OLD.issuer_person_id OR NEW.issuer_user_id IS NOT OLD.issuer_user_id OR NEW.issuer_display_name IS NOT OLD.issuer_display_name OR NEW.issuing_api_key_id IS NOT OLD.issuing_api_key_id)
BEGIN SELECT RAISE(ABORT,'Original issuer attribution is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER credential_person_publish BEFORE UPDATE OF public_record,status ON credentials
WHEN OLD.public_record=0 AND NEW.public_record=1 AND NOT EXISTS(SELECT 1 FROM issuer_people p JOIN organizations o ON o.id=p.organization_id
 JOIN auth_user u ON 'email:'||u.id=p.user_id
 JOIN organization_members m ON m.user_id=p.user_id AND m.organization_id=o.id
 WHERE o.id=NEW.organization_id AND o.organization_type='laboratory' AND o.issuer_status='verified'
 AND p.id=NEW.issuer_person_id AND p.user_id=NEW.issuer_user_id AND p.status='active'
 AND p.identity_status='verified' AND p.identity_verified_at IS NOT NULL AND p.approved_at IS NOT NULL
 AND u.email_verified=1 AND lower(u.email)=p.email AND p.email_domain=o.verified_email_domain
 AND p.email_domain=lower(substr(u.email,instr(u.email,'@')+1))
 AND EXISTS(SELECT 1 FROM auth_passkey k WHERE k.user_id=u.id) AND p.display_name=NEW.issuer_display_name AND (NEW.issuing_api_key_id IS NULL OR EXISTS(SELECT 1 FROM api_keys k WHERE k.id=NEW.issuing_api_key_id
 AND k.organization_id=o.id AND k.created_by_user_id=p.user_id AND k.issuer_person_id=p.id AND k.revoked_at IS NULL)))
BEGIN SELECT RAISE(ABORT,'Active verified issuer person required'); END;

--> statement-breakpoint
CREATE TRIGGER api_key_person_insert BEFORE INSERT ON api_keys
WHEN NEW.scopes<>'["read"]' AND NOT EXISTS(SELECT 1 FROM issuer_people p JOIN organizations o ON o.id=p.organization_id
 JOIN auth_user u ON 'email:'||u.id=p.user_id
 JOIN organization_members m ON m.user_id=p.user_id AND m.organization_id=o.id
 WHERE o.id=NEW.organization_id AND o.organization_type='laboratory' AND o.issuer_status='verified'
 AND p.id=NEW.issuer_person_id AND p.user_id=NEW.created_by_user_id AND p.status='active'
 AND p.identity_status='verified' AND p.identity_verified_at IS NOT NULL AND p.approved_at IS NOT NULL
 AND u.email_verified=1 AND lower(u.email)=p.email AND p.email_domain=o.verified_email_domain
 AND p.email_domain=lower(substr(u.email,instr(u.email,'@')+1))
 AND EXISTS(SELECT 1 FROM auth_passkey k WHERE k.user_id=u.id))
BEGIN SELECT RAISE(ABORT,'Verified laboratory person required for a write key'); END;

--> statement-breakpoint
CREATE TRIGGER issuer_person_revoke_keys AFTER UPDATE OF status,identity_status ON issuer_people
WHEN NEW.status<>'active' OR NEW.identity_status<>'verified'
BEGIN UPDATE api_keys SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP) WHERE organization_id=NEW.organization_id AND (issuer_person_id=NEW.id OR created_by_user_id=NEW.user_id); END;
--> statement-breakpoint
CREATE TRIGGER issuer_lab_revoke_keys AFTER UPDATE OF issuer_status ON organizations
WHEN NEW.organization_type='laboratory' AND NEW.issuer_status<>'verified'
BEGIN UPDATE api_keys SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP) WHERE organization_id=NEW.id; END;

--> statement-breakpoint
CREATE TRIGGER issuer_lab_suspension_sticky BEFORE UPDATE OF issuer_status ON organizations
WHEN OLD.issuer_status='suspended' AND NEW.issuer_status<>'suspended'
BEGIN SELECT RAISE(ABORT,'ICS suspension cannot be cleared by resubmission'); END;
