-- ============================================================
-- TachoCompliance — Migration initiale Railway PostgreSQL
-- Compatible Better Auth + Drizzle ORM
-- ============================================================

-- ============================================================
-- TABLES BETTER AUTH
-- ============================================================

CREATE TABLE IF NOT EXISTS "user" (
  "id"             TEXT        PRIMARY KEY,
  "name"           TEXT        NOT NULL,
  "email"          TEXT        NOT NULL UNIQUE,
  "email_verified" BOOLEAN     NOT NULL DEFAULT FALSE,
  "image"          TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id"          TEXT        PRIMARY KEY,
  "expires_at"  TIMESTAMPTZ NOT NULL,
  "token"       TEXT        NOT NULL UNIQUE,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ip_address"  TEXT,
  "user_agent"  TEXT,
  "user_id"     TEXT        NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id"                       TEXT        PRIMARY KEY,
  "account_id"               TEXT        NOT NULL,
  "provider_id"              TEXT        NOT NULL,
  "user_id"                  TEXT        NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token"             TEXT,
  "refresh_token"            TEXT,
  "id_token"                 TEXT,
  "access_token_expires_at"  TIMESTAMPTZ,
  "refresh_token_expires_at" TIMESTAMPTZ,
  "scope"                    TEXT,
  "password"                 TEXT,
  "created_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id"          TEXT        PRIMARY KEY,
  "identifier"  TEXT        NOT NULL,
  "value"       TEXT        NOT NULL,
  "expires_at"  TIMESTAMPTZ NOT NULL,
  "created_at"  TIMESTAMPTZ DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLES MÉTIER
-- ============================================================

CREATE TABLE IF NOT EXISTS "companies" (
  "id"           SERIAL      PRIMARY KEY,
  "name"         TEXT        NOT NULL,
  "siret"        TEXT,
  "driver_count" TEXT,
  "created_at"   TIMESTAMPTZ DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "user_companies" (
  "id"         SERIAL      PRIMARY KEY,
  "user_id"    TEXT        NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "company_id" INTEGER     NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "role"       TEXT        NOT NULL DEFAULT 'driver'
                           CHECK ("role" IN ('admin', 'manager', 'driver')),
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_companies_user_company_idx"
  ON "user_companies"("user_id", "company_id");

CREATE TABLE IF NOT EXISTS "drivers" (
  "id"         SERIAL      PRIMARY KEY,
  "company_id" INTEGER     REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id"    TEXT        REFERENCES "user"("id") ON DELETE SET NULL,
  "name"       TEXT        NOT NULL,
  "initials"   TEXT        NOT NULL,
  "email"      TEXT,
  "phone"      TEXT,
  "score"      INTEGER     NOT NULL DEFAULT 100,
  "status"     TEXT        NOT NULL DEFAULT 'active'
                           CHECK ("status" IN ('active', 'inactive')),
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_drivers_company_id"  ON "drivers"("company_id");

CREATE TABLE IF NOT EXISTS "analyses" (
  "id"           SERIAL      PRIMARY KEY,
  "driver_id"    INTEGER     REFERENCES "drivers"("id") ON DELETE CASCADE,
  "company_id"   INTEGER     REFERENCES "companies"("id") ON DELETE CASCADE,
  "period_start" DATE        NOT NULL,
  "period_end"   DATE        NOT NULL,
  "upload_date"  TIMESTAMPTZ DEFAULT NOW(),
  "score"        INTEGER     NOT NULL,
  "status"       TEXT        NOT NULL DEFAULT 'completed'
                             CHECK ("status" IN ('completed', 'processing', 'failed')),
  "created_at"   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_analyses_driver_id"  ON "analyses"("driver_id");
CREATE INDEX IF NOT EXISTS "idx_analyses_company_id" ON "analyses"("company_id");

CREATE TABLE IF NOT EXISTS "infractions" (
  "id"          SERIAL  PRIMARY KEY,
  "driver_id"   INTEGER REFERENCES "drivers"("id") ON DELETE CASCADE,
  "company_id"  INTEGER REFERENCES "companies"("id") ON DELETE CASCADE,
  "analysis_id" INTEGER REFERENCES "analyses"("id") ON DELETE CASCADE,
  "type"        TEXT    NOT NULL,
  "severity"    TEXT    NOT NULL
                        CHECK ("severity" IN ('low', 'medium', 'high', 'critical')),
  "date"        DATE    NOT NULL,
  "created_at"  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_infractions_driver_id"   ON "infractions"("driver_id");
CREATE INDEX IF NOT EXISTS "idx_infractions_company_id"  ON "infractions"("company_id");
CREATE INDEX IF NOT EXISTS "idx_infractions_analysis_id" ON "infractions"("analysis_id");

-- ============================================================
-- FIN
-- ============================================================
