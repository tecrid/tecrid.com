CREATE TABLE admin_second_factors (
 email TEXT PRIMARY KEY,
 totp_secret TEXT NOT NULL,
 verified_at TEXT,
 failed_attempts INTEGER NOT NULL DEFAULT 0,
 locked_until TEXT,
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE admin_recovery_codes (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL,
 code_hash TEXT NOT NULL,
 used_at TEXT
);
--> statement-breakpoint
CREATE INDEX idx_admin_recovery_email ON admin_recovery_codes (email);
--> statement-breakpoint
CREATE TABLE admin_factor_sessions (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL,
 token_hash TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_admin_factor_token ON admin_factor_sessions (token_hash);
