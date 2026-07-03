-- TeamFlow database schema (PostgreSQL)
-- Run against a fresh database: psql -U postgres -d teamflow -f db/schema.sql

CREATE TYPE task_status AS ENUM ('backlog', 'in_progress', 'review', 'done');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE relation_type AS ENUM ('blocks', 'blocked_by');
CREATE TYPE project_role AS ENUM ('owner', 'member');
CREATE TYPE view_mode AS ENUM ('kanban', 'calendar', 'list');
CREATE TYPE rca_status AS ENUM ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'closed');
CREATE TYPE rca_severity AS ENUM ('SEV-1', 'SEV-2', 'SEV-3');
CREATE TYPE rca_section_type AS ENUM ('timeline', 'contributing_factors', 'corrective_actions', 'preventive_measures');
CREATE TYPE review_decision AS ENUM ('approved', 'rejected');
CREATE TYPE notification_channel AS ENUM ('in_app', 'email');

-- ============ Users ============
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(120) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    email_opt_out   BOOLEAN NOT NULL DEFAULT FALSE,
    theme           VARCHAR(10) NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ Projects ============
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(160) NOT NULL,
    description     TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membership + per-user, per-project view preference (persists across sessions)
CREATE TABLE project_members (
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            project_role NOT NULL DEFAULT 'member',
    view_preference view_mode NOT NULL DEFAULT 'kanban',
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);

-- ============ Tasks ============
CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_task_id  UUID REFERENCES tasks(id) ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    status          task_status NOT NULL DEFAULT 'backlog',
    priority        task_priority NOT NULL DEFAULT 'medium',
    assignee_id     UUID REFERENCES users(id),
    due_date        DATE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(project_id, status);
CREATE INDEX idx_tasks_due_date ON tasks(project_id, due_date);

-- Dependency links.
CREATE TABLE task_relations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    related_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    relation_type   relation_type NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (task_id, related_task_id, relation_type),
    CHECK (task_id <> related_task_id)
);
CREATE INDEX idx_task_relations_task ON task_relations(task_id);
CREATE INDEX idx_task_relations_related ON task_relations(related_task_id);

-- ============ RCA (Root Cause Analysis) ============
CREATE TABLE rcas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    severity        rca_severity NOT NULL DEFAULT 'SEV-2',
    status          rca_status NOT NULL DEFAULT 'draft',
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at    TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ
);
CREATE INDEX idx_rcas_project ON rcas(project_id, status);

CREATE TABLE rca_sections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rca_id          UUID NOT NULL REFERENCES rcas(id) ON DELETE CASCADE,
    section_type    rca_section_type NOT NULL,
    content         TEXT NOT NULL DEFAULT '',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (rca_id, section_type)
);

-- A reviewer is "assigned" the moment a row exists here; decision stays NULL
-- until they act.
CREATE TABLE reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rca_id          UUID NOT NULL REFERENCES rcas(id) ON DELETE CASCADE,
    reviewer_id     UUID NOT NULL REFERENCES users(id),
    decision        review_decision,
    comment         TEXT,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at      TIMESTAMPTZ,
    UNIQUE (rca_id, reviewer_id),
    CHECK (decision IS NULL OR comment IS NOT NULL)  -- decision requires a mandatory comment
);
CREATE INDEX idx_reviews_rca ON reviews(rca_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);

-- ============ Comments & Attachments (shared across tasks and RCAs) ============
CREATE TABLE comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE,
    rca_id          UUID REFERENCES rcas(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users(id),
    body            TEXT NOT NULL,
    mentioned_user_ids UUID[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(task_id, rca_id) = 1)  -- belongs to exactly one of task/RCA
);
CREATE INDEX idx_comments_task ON comments(task_id);
CREATE INDEX idx_comments_rca ON comments(rca_id);

CREATE TABLE attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE,
    rca_id          UUID REFERENCES rcas(id) ON DELETE CASCADE,
    file_name       VARCHAR(255) NOT NULL,
    content_type    VARCHAR(120) NOT NULL,
    size_bytes      BIGINT NOT NULL,
    storage_path    TEXT NOT NULL, -- object storage key (see storage.js)
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(task_id, rca_id) = 1)
);
CREATE INDEX idx_attachments_task ON attachments(task_id);
CREATE INDEX idx_attachments_rca ON attachments(rca_id);

-- ============ Notifications ============
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type      VARCHAR(60) NOT NULL,
    entity_type     VARCHAR(30) NOT NULL,
    entity_id       UUID NOT NULL,
    channel         notification_channel NOT NULL,
    message         TEXT NOT NULL,
    dedupe_key      VARCHAR(160) NOT NULL,
    read            BOOLEAN NOT NULL DEFAULT FALSE,
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (dedupe_key)
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read);

-- ============ Activity log (append-only) ============
CREATE TABLE activity_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     VARCHAR(30) NOT NULL,
    entity_id       UUID NOT NULL,
    actor_id        UUID REFERENCES users(id),
    action          VARCHAR(60) NOT NULL,
    context         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_entity ON activity_log(entity_type, entity_id);

-- updated_at maintenance
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
