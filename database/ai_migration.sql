-- ============================================================
-- GRIDLOCK AI / DOCUMENT EXTRACTION MIGRATION
-- ============================================================
-- Extends the existing GridLock schema without replacing it.
-- Does NOT create a utilities table.
-- Does NOT drop existing tables or data.
-- ============================================================


-- ============================================================
-- PROJECT EXTENSIONS
-- ============================================================

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS external_id VARCHAR(200),
    ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50) DEFAULT 'project',
    ADD COLUMN IF NOT EXISTS infrastructure_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS technology VARCHAR(150),
    ADD COLUMN IF NOT EXISTS capacity_mw NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS nameplate_mw NUMERIC(12,3),
    ADD COLUMN IF NOT EXISTS summer_mw NUMERIC(12,3),
    ADD COLUMN IF NOT EXISTS winter_mw NUMERIC(12,3),
    ADD COLUMN IF NOT EXISTS storage_mwh NUMERIC(12,3),
    ADD COLUMN IF NOT EXISTS county VARCHAR(100),
    ADD COLUMN IF NOT EXISTS state VARCHAR(2),
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS location_source VARCHAR(50),
    ADD COLUMN IF NOT EXISTS start_year INT,
    ADD COLUMN IF NOT EXISTS end_year INT,
    ADD COLUMN IF NOT EXISTS construction_start_text TEXT,
    ADD COLUMN IF NOT EXISTS commercial_service_text TEXT,
    ADD COLUMN IF NOT EXISTS retirement_date_text TEXT,
    ADD COLUMN IF NOT EXISTS station TEXT,
    ADD COLUMN IF NOT EXISTS connection TEXT,
    ADD COLUMN IF NOT EXISTS line_length_miles NUMERIC(12,3),
    ADD COLUMN IF NOT EXISTS primary_fuel VARCHAR(100),
    ADD COLUMN IF NOT EXISTS alternate_fuel VARCHAR(100),
    ADD COLUMN IF NOT EXISTS acreage NUMERIC(12,3),
    ADD COLUMN IF NOT EXISTS is_tbd BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS source_document VARCHAR(255),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


-- AI-extracted projects may legitimately have incomplete
-- subtype, dates, or geographic information.

ALTER TABLE projects
    ALTER COLUMN subtype DROP NOT NULL;

ALTER TABLE projects
    ALTER COLUMN start_date DROP NOT NULL;

ALTER TABLE projects
    ALTER COLUMN end_date DROP NOT NULL;

ALTER TABLE projects
    ALTER COLUMN geom DROP NOT NULL;


-- ============================================================
-- AI SOURCE DOCUMENT EVIDENCE
-- ============================================================

CREATE TABLE IF NOT EXISTS sources (
    id BIGSERIAL PRIMARY KEY,
    utility_id INT NOT NULL,
    external_id VARCHAR(100) NOT NULL,
    document TEXT,
    section TEXT,
    schedule TEXT,
    figure TEXT,
    pdf_page INT,
    printed_page TEXT,
    evidence TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (utility_id, external_id)
);


-- ============================================================
-- PLANNING EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS plan_events (
    id BIGSERIAL PRIMARY KEY,
    utility_id INT NOT NULL,
    external_id VARCHAR(200) NOT NULL,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    effective_date TEXT,
    capacity_mw NUMERIC(12,3),
    capacity_type VARCHAR(50),
    description TEXT,
    is_derived BOOLEAN NOT NULL DEFAULT FALSE,
    derivation_source TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (utility_id, external_id)
);


-- ============================================================
-- PROJECT RELATIONSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS project_relationships (
    id BIGSERIAL PRIMARY KEY,
    from_project_id INT NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,
    to_project_id INT NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        from_project_id,
        to_project_id,
        relationship_type
    ),

    CHECK (from_project_id <> to_project_id)
);


-- ============================================================
-- PROJECT / SOURCE LINKS
-- ============================================================

CREATE TABLE IF NOT EXISTS project_sources (
    project_id INT NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,

    source_id BIGINT NOT NULL
        REFERENCES sources(id)
        ON DELETE CASCADE,

    PRIMARY KEY (project_id, source_id)
);


-- ============================================================
-- EVENT / SOURCE LINKS
-- ============================================================

CREATE TABLE IF NOT EXISTS event_sources (
    event_id BIGINT NOT NULL
        REFERENCES plan_events(id)
        ON DELETE CASCADE,

    source_id BIGINT NOT NULL
        REFERENCES sources(id)
        ON DELETE CASCADE,

    PRIMARY KEY (event_id, source_id)
);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_projects_external_id
    ON projects(utility_id, external_id);

CREATE INDEX IF NOT EXISTS idx_projects_entity_type
    ON projects(entity_type);

CREATE INDEX IF NOT EXISTS idx_projects_infrastructure_type
    ON projects(infrastructure_type);

CREATE INDEX IF NOT EXISTS idx_sources_utility
    ON sources(utility_id);

CREATE INDEX IF NOT EXISTS idx_plan_events_project
    ON plan_events(project_id);

CREATE INDEX IF NOT EXISTS idx_plan_events_utility
    ON plan_events(utility_id);

CREATE INDEX IF NOT EXISTS idx_project_relationships_from
    ON project_relationships(from_project_id);

CREATE INDEX IF NOT EXISTS idx_project_relationships_to
    ON project_relationships(to_project_id);

-- Required for idempotent AI project/entity imports.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'projects_utility_external_id_unique'
    ) THEN
        ALTER TABLE projects
            ADD CONSTRAINT projects_utility_external_id_unique
            UNIQUE (utility_id, external_id);
    END IF;
END $$;
