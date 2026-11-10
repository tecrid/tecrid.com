CREATE TABLE lab_applications (
 id TEXT PRIMARY KEY NOT NULL,
 lab_name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE,
 contact_email TEXT NOT NULL UNIQUE,
 accreditation_body TEXT NOT NULL, accreditation_number TEXT NOT NULL,
 scope_metals TEXT NOT NULL,
 certificate_key TEXT NOT NULL, certificate_filename TEXT NOT NULL,
 certificate_sha256 TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
 issuer_application_id TEXT REFERENCES issuer_applications(id),
 organization_id TEXT REFERENCES organizations(id),
 reviewed_by TEXT, review_note TEXT, reviewed_at TEXT,
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX lab_applications_queue ON lab_applications(status,created_at DESC,id DESC);
--> statement-breakpoint
CREATE INDEX lab_applications_all_queue ON lab_applications(created_at DESC,id DESC);
--> statement-breakpoint
CREATE TABLE onboarding_rate_limits (key TEXT PRIMARY KEY NOT NULL, count INTEGER NOT NULL, started_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX onboarding_rate_started ON onboarding_rate_limits(started_at);

--> statement-breakpoint
CREATE INDEX issuer_applications_review_queue ON issuer_applications(submitted_at DESC,id DESC);
