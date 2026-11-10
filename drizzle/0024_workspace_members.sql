ALTER TABLE organization_members ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE workspace_invites (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','member')),
  invited_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_workspace_invites_organization ON workspace_invites(organization_id);
--> statement-breakpoint
CREATE TRIGGER protect_last_workspace_owner_delete BEFORE DELETE ON organization_members
WHEN OLD.role='owner' AND (SELECT count(*) FROM organization_members WHERE organization_id=OLD.organization_id AND role='owner')=1
BEGIN SELECT RAISE(ABORT, 'The last Owner cannot be removed. Assign another Owner first.'); END;
--> statement-breakpoint
CREATE TRIGGER protect_last_workspace_owner_role BEFORE UPDATE OF role ON organization_members
WHEN OLD.role='owner' AND NEW.role!='owner' AND (SELECT count(*) FROM organization_members WHERE organization_id=OLD.organization_id AND role='owner')=1
BEGIN SELECT RAISE(ABORT, 'The last Owner cannot be demoted. Assign another Owner first.'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_member_email_unique BEFORE INSERT ON organization_members
WHEN EXISTS (SELECT 1 FROM organization_members WHERE lower(email)=lower(NEW.email))
BEGIN SELECT RAISE(ABORT, 'That email already belongs to a TECRID workspace.'); END;
