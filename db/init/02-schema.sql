DROP TABLE IF EXISTS "SETTINGS" CASCADE;
DROP TABLE IF EXISTS "AUDIT_LOGS" CASCADE;
DROP TABLE IF EXISTS "NOTIFICATIONS" CASCADE;
DROP TABLE IF EXISTS "REPORT_IMAGES" CASCADE;
DROP TABLE IF EXISTS "CONTESTATIONS" CASCADE;
DROP TABLE IF EXISTS "INTERVENTION_HISTORY" CASCADE;
DROP TABLE IF EXISTS "INTERVENTIONS" CASCADE;
DROP TABLE IF EXISTS "COMMENTS" CASCADE;
DROP TABLE IF EXISTS "SUPPORTS" CASCADE;
DROP TABLE IF EXISTS "REPORT_STATUS_HISTORY" CASCADE;
DROP TABLE IF EXISTS "REPORTS" CASCADE;
DROP TABLE IF EXISTS "CATEGORIES" CASCADE;
DROP TABLE IF EXISTS "TEAMS" CASCADE;
DROP TABLE IF EXISTS "PASSWORD_RESET_TOKENS" CASCADE;
DROP TABLE IF EXISTS "USERS" CASCADE;
DROP TABLE IF EXISTS "ORGANIZATIONS" CASCADE;

DROP TYPE IF EXISTS role_enum CASCADE;
DROP TYPE IF EXISTS state_enum CASCADE;
DROP TYPE IF EXISTS report_status_enum CASCADE;
DROP TYPE IF EXISTS priority_enum CASCADE;
DROP TYPE IF EXISTS rejection_reason_enum CASCADE;
DROP TYPE IF EXISTS intervention_status_enum CASCADE;
DROP TYPE IF EXISTS decision_enum CASCADE;
DROP TYPE IF EXISTS visibility_enum CASCADE;
DROP TYPE IF EXISTS context_enum CASCADE;
DROP TYPE IF EXISTS image_kind_enum CASCADE;

CREATE TYPE role_enum AS ENUM ('Citoyen', 'Administrateur', 'Organisme', 'Responsable d''équipe');
CREATE TYPE state_enum AS ENUM ('Actif', 'Inactif', 'Suspendu');
CREATE TYPE report_status_enum AS ENUM ('Soumis', 'En vérification', 'Accepté', 'Affecté', 'En cours', 'Résolu', 'Clos', 'Rejeté');
CREATE TYPE priority_enum AS ENUM ('Basse', 'Moyenne', 'Haute', 'Critique');
CREATE TYPE rejection_reason_enum AS ENUM ('Hors compétence', 'Autre organisme concerné', 'Informations insuffisantes', 'Autre');
CREATE TYPE intervention_status_enum AS ENUM ('À affecter', 'Affectée', 'En cours', 'À valider', 'Terminée');
CREATE TYPE decision_enum AS ENUM ('Acceptée', 'Rejetée');
CREATE TYPE visibility_enum AS ENUM ('Public', 'Interne', 'Privé');
CREATE TYPE context_enum AS ENUM ('Signalement', 'Intervention', 'Contestation');
CREATE TYPE image_kind_enum AS ENUM ('Avant', 'Après');

CREATE TABLE "ORGANIZATIONS" (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE,
    type VARCHAR(100),
    description TEXT,
    public_email VARCHAR(255),
    public_phone VARCHAR(50),
    opening_hours VARCHAR(255)
);

CREATE TABLE "USERS" (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT REFERENCES "ORGANIZATIONS"(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role role_enum NOT NULL,
    state state_enum DEFAULT 'Actif',
    privacy_accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PASSWORD_RESET_TOKENS" (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES "USERS"(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);

CREATE TABLE "TEAMS" (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT REFERENCES "ORGANIZATIONS"(id) ON DELETE CASCADE,
    lead_id BIGINT REFERENCES "USERS"(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    members_count INT DEFAULT 0
);

CREATE TABLE "CATEGORIES" (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT REFERENCES "ORGANIZATIONS"(id) ON DELETE CASCADE,
    label VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    severity_weight NUMERIC,
    risk_weight NUMERIC,
    is_active BOOLEAN DEFAULT TRUE,
    icon_key VARCHAR(30) NOT NULL DEFAULT 'autre',
    CONSTRAINT chk_categories_icon_key CHECK (icon_key IN ('eclairage', 'voirie', 'proprete', 'eau', 'mobilier', 'autre'))
);

CREATE TABLE "REPORTS" (
    id BIGSERIAL PRIMARY KEY,
    reference VARCHAR(50) UNIQUE NOT NULL,
    user_id BIGINT REFERENCES "USERS"(id) ON DELETE SET NULL,
    category_id BIGINT NOT NULL REFERENCES "CATEGORIES"(id) ON DELETE RESTRICT,
    duplicate_of_id BIGINT REFERENCES "REPORTS"(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    address VARCHAR(500),
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    status report_status_enum NOT NULL DEFAULT 'Soumis',
    priority_score SMALLINT,
    priority priority_enum,
    priority_set_by BIGINT REFERENCES "USERS"(id) ON DELETE SET NULL,
    priority_justification TEXT,
    rejection_reason rejection_reason_enum,
    rejection_comment TEXT,
    resolution_round SMALLINT DEFAULT 0,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    contest_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_reports_description_not_blank CHECK (length(btrim(description)) > 0),
    CONSTRAINT chk_reports_latitude  CHECK (latitude  BETWEEN -90  AND 90),
    CONSTRAINT chk_reports_longitude CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_reports_rejection_reason CHECK (status <> 'Rejeté' OR rejection_reason IS NOT NULL),
    CONSTRAINT chk_reports_rejection_other  CHECK (rejection_reason IS DISTINCT FROM 'Autre'
                                                   OR length(btrim(COALESCE(rejection_comment, ''))) > 0)
);

CREATE TABLE "REPORT_STATUS_HISTORY" (
    id BIGSERIAL PRIMARY KEY,
    report_id BIGINT REFERENCES "REPORTS"(id) ON DELETE CASCADE,
    author_id BIGINT REFERENCES "USERS"(id) ON DELETE SET NULL,
    old_status report_status_enum,
    new_status report_status_enum NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SUPPORTS" (
    id BIGSERIAL PRIMARY KEY,
    report_id BIGINT NOT NULL REFERENCES "REPORTS"(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES "USERS"(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(report_id, user_id)
);

CREATE TABLE "COMMENTS" (
    id BIGSERIAL PRIMARY KEY,
    report_id BIGINT REFERENCES "REPORTS"(id) ON DELETE CASCADE,
    author_id BIGINT REFERENCES "USERS"(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    visibility visibility_enum DEFAULT 'Public',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "INTERVENTIONS" (
    id BIGSERIAL PRIMARY KEY,
    reference VARCHAR(50) UNIQUE NOT NULL,
    report_id BIGINT REFERENCES "REPORTS"(id) ON DELETE CASCADE,
    organization_id BIGINT REFERENCES "ORGANIZATIONS"(id) ON DELETE RESTRICT,
    team_id BIGINT REFERENCES "TEAMS"(id) ON DELETE SET NULL,
    lead_id BIGINT REFERENCES "USERS"(id) ON DELETE SET NULL,
    created_by BIGINT REFERENCES "USERS"(id) ON DELETE SET NULL,
    priority priority_enum,
    planned_date DATE,
    instructions TEXT,
    status intervention_status_enum NOT NULL DEFAULT 'À affecter',
    work_report TEXT,
    submitted_at TIMESTAMPTZ,
    validated_by BIGINT REFERENCES "USERS"(id) ON DELETE SET NULL,
    validated_at TIMESTAMPTZ
);

CREATE TABLE "INTERVENTION_HISTORY" (
    id BIGSERIAL PRIMARY KEY,
    intervention_id BIGINT REFERENCES "INTERVENTIONS"(id) ON DELETE CASCADE,
    author_id BIGINT REFERENCES "USERS"(id) ON DELETE SET NULL,
    old_status intervention_status_enum,
    new_status intervention_status_enum NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "CONTESTATIONS" (
    id BIGSERIAL PRIMARY KEY,
    report_id BIGINT NOT NULL REFERENCES "REPORTS"(id) ON DELETE CASCADE,
    author_id BIGINT REFERENCES "USERS"(id) ON DELETE CASCADE,
    resolution_round SMALLINT NOT NULL,
    message VARCHAR(1000),
    decision decision_enum,
    decision_reason TEXT,
    decided_by BIGINT REFERENCES "USERS"(id) ON DELETE SET NULL,
    escalated_to_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(report_id, resolution_round)
);

CREATE TABLE "REPORT_IMAGES" (
    id BIGSERIAL PRIMARY KEY,
    context context_enum NOT NULL,
    kind image_kind_enum,
    report_id BIGINT REFERENCES "REPORTS"(id) ON DELETE CASCADE,
    intervention_id BIGINT REFERENCES "INTERVENTIONS"(id) ON DELETE CASCADE,
    contestation_id BIGINT REFERENCES "CONTESTATIONS"(id) ON DELETE CASCADE,
    uploaded_by BIGINT REFERENCES "USERS"(id) ON DELETE SET NULL,
    storage_path VARCHAR(500) UNIQUE NOT NULL,
    mime_type VARCHAR(100),
    size_bytes INT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_images_kind CHECK (
        (context = 'Intervention' AND kind IS NOT NULL)
        OR (context <> 'Intervention' AND kind IS NULL)
    )
);

CREATE TABLE "NOTIFICATIONS" (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES "USERS"(id) ON DELETE CASCADE,
    report_id BIGINT REFERENCES "REPORTS"(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    content TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AUDIT_LOGS" (
    id BIGSERIAL PRIMARY KEY,
    actor_id BIGINT REFERENCES "USERS"(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    resource_id BIGINT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SETTINGS" (
    key VARCHAR(255) PRIMARY KEY,
    value VARCHAR(1000),
    updated_by BIGINT REFERENCES "USERS"(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_category_status ON "REPORTS" (category_id, status);
CREATE INDEX idx_reports_coords         ON "REPORTS" (latitude, longitude);
CREATE INDEX idx_reports_user           ON "REPORTS" (user_id);
CREATE INDEX idx_reports_duplicate_of   ON "REPORTS" (duplicate_of_id);
CREATE INDEX idx_categories_org         ON "CATEGORIES" (organization_id);
CREATE INDEX idx_interventions_team_status ON "INTERVENTIONS" (team_id, status);
CREATE INDEX idx_interventions_report      ON "INTERVENTIONS" (report_id);
CREATE INDEX idx_interventions_org         ON "INTERVENTIONS" (organization_id);
CREATE INDEX idx_report_history_report  ON "REPORT_STATUS_HISTORY" (report_id, created_at);
CREATE INDEX idx_interv_history_interv  ON "INTERVENTION_HISTORY" (intervention_id, created_at);
CREATE INDEX idx_comments_report        ON "COMMENTS" (report_id, created_at);
CREATE INDEX idx_images_report          ON "REPORT_IMAGES" (report_id);
CREATE INDEX idx_images_intervention    ON "REPORT_IMAGES" (intervention_id);
CREATE INDEX idx_images_contestation    ON "REPORT_IMAGES" (contestation_id);
CREATE INDEX idx_notifications_user_read ON "NOTIFICATIONS" (user_id, is_read, created_at);
CREATE INDEX idx_users_org              ON "USERS" (organization_id);
CREATE INDEX idx_teams_org              ON "TEAMS" (organization_id);
