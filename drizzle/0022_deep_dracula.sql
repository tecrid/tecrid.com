CREATE TABLE `delivery_policy` (
	`id` text PRIMARY KEY NOT NULL,
	`terms_version` text DEFAULT '' NOT NULL,
	`terms_url` text DEFAULT '' NOT NULL,
	`terms_required` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by_user_id` text
);
--> statement-breakpoint
ALTER TABLE `organizations` ADD `identity_status` text DEFAULT 'unreviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `terms_accepted_at` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `terms_version` text;
--> statement-breakpoint
INSERT INTO delivery_policy (id,terms_version,terms_url,terms_required,updated_at) VALUES ('global','','',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
--> statement-breakpoint
DROP TRIGGER route_recipient_delivery_authority;
--> statement-breakpoint
CREATE TRIGGER route_recipient_delivery_authority BEFORE INSERT ON evidence_deliveries BEGIN
 SELECT CASE WHEN NOT EXISTS (
 SELECT 1 FROM routing_authorizations a JOIN credentials c ON c.identifier=NEW.credential_identifier JOIN evidence_access_grants g ON g.id=NEW.grant_id
 WHERE a.id=NEW.routing_authorization_id AND a.status='active'
 AND (a.authorization_kind='standing' OR a.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))
 AND a.controller_organization_id=NEW.controller_organization_id AND a.laboratory_organization_id=c.organization_id
 AND (a.authorization_kind='standing' OR a.product_sku=c.product_sku)
 AND (a.authorization_kind!='standing' OR ((a.ingredient_code IS NULL AND c.ingredient_code IS NULL) OR a.ingredient_code=c.ingredient_code)) AND c.status='issued' AND c.version=NEW.credential_version
 AND (g.delivery_mode<>'one_time' OR NOT EXISTS (SELECT 1 FROM evidence_deliveries prior WHERE prior.grant_id=g.id))
 AND g.status='active' AND g.controller_organization_id=a.controller_organization_id AND ((a.authorization_kind='standing' AND a.ingredient_code IS NOT NULL AND a.product_sku='') OR g.product_sku=c.product_sku)
 AND g.recipient_organization_id=NEW.recipient_organization_id AND g.access_level=NEW.access_level
 AND (a.authorization_kind!='standing' OR EXISTS (SELECT 1 FROM json_each(a.grant_ids_json) WHERE value=g.id))

 AND EXISTS (SELECT 1 FROM organizations controller WHERE controller.id=NEW.controller_organization_id AND controller.organization_type IN ('brand','supplier'))
 AND EXISTS (SELECT 1 FROM organizations recipient WHERE recipient.id=NEW.recipient_organization_id AND (
 recipient.identity_status='verified' OR (recipient.identity_status='unreviewed' AND (recipient.issuer_status='verified' OR EXISTS (SELECT 1 FROM participant_profiles p WHERE p.organization_id=recipient.id AND p.registry_verified=1)))))
 AND EXISTS (SELECT 1 FROM delivery_policy WHERE id='global')
 AND NOT EXISTS (SELECT 1 FROM delivery_policy p JOIN organizations r ON r.id=NEW.recipient_organization_id WHERE p.id='global' AND p.terms_required=1 AND (p.terms_url='' OR p.terms_version='' OR r.terms_accepted_at IS NULL OR COALESCE(r.terms_version,'')<>p.terms_version))
 ) THEN RAISE(ABORT,'Recipient routing authority is no longer current') END;
END;
