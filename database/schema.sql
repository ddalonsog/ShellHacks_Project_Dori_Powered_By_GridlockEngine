CREATE EXTENSION IF NOT EXISTS postgis;


-- ============================================================
-- RESET TABLES
-- ============================================================
--
-- Drop dependent tables first.
--
-- Existing GridLock tables are preserved conceptually.
-- New AI/extraction tables are added around projects.
--

DROP TABLE IF EXISTS event_sources CASCADE;
DROP TABLE IF EXISTS project_sources CASCADE;
DROP TABLE IF EXISTS project_relationships CASCADE;
DROP TABLE IF EXISTS plan_events CASCADE;
DROP TABLE IF EXISTS sources CASCADE;

DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS collaboration_requests CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS utilities CASCADE;


-- ============================================================
-- UTILITIES
-- ============================================================
--
-- Electric utility companies such as FPL and Duke Energy Florida.
--

CREATE TABLE utilities (
    id SERIAL PRIMARY KEY,

    name VARCHAR(150) UNIQUE NOT NULL,
    state VARCHAR(2) NOT NULL,

    contact_email VARCHAR(255),

    contact_visibility VARCHAR(20)
        NOT NULL
        DEFAULT 'public'
        CHECK (
            contact_visibility IN (
                'public',
                'authenticated',
                'private'
            )
        ),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- USERS
-- ============================================================
--
-- Users belonging to a utility.
--

CREATE TABLE users (
    id SERIAL PRIMARY KEY,

    utility_id INT NOT NULL
        REFERENCES utilities(id)
        ON DELETE CASCADE,

    name VARCHAR(120) NOT NULL,

    email VARCHAR(255)
        UNIQUE
        NOT NULL,

    password_hash TEXT NOT NULL,

    role VARCHAR(30)
        NOT NULL
        DEFAULT 'member',

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- PROJECTS
-- ============================================================
--
-- IMPORTANT:
--
-- The table keeps its existing name so the current GridLock
-- backend/frontend does not require a broad refactor.
--
-- Historically this table represented future projects.
--
-- It can now also represent other infrastructure entities
-- extracted from planning documents:
--
-- project
-- planning_group
-- existing_asset
-- contract
-- program
--
-- Existing columns are intentionally preserved for backward
-- compatibility.
-- ============================================================

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,


    -- ========================================================
    -- UTILITY
    -- ========================================================

    utility_id INT NOT NULL
        REFERENCES utilities(id)
        ON DELETE CASCADE,


    -- ========================================================
    -- STABLE EXTRACTION IDENTIFIER
    -- ========================================================
    --
    -- Examples:
    --
    -- jumper-creek-solar
    -- powerline-bess
    -- tbd-solar-2034
    -- jumper-creek-interconnection
    --
    -- Used by the importer for idempotent upserts.
    --

    external_id VARCHAR(200),


    -- ========================================================
    -- EXISTING BASIC PROJECT INFORMATION
    -- ========================================================

    title VARCHAR(150) NOT NULL,

    category VARCHAR(80) NOT NULL,

    subtype VARCHAR(100),


    -- ========================================================
    -- ENTITY CLASSIFICATION
    -- ========================================================

    entity_type VARCHAR(50)
        NOT NULL
        DEFAULT 'project',

    infrastructure_type VARCHAR(50),

    technology VARCHAR(150),


    -- ========================================================
    -- EXISTING SIMPLIFIED TECHNICAL INFORMATION
    -- ========================================================
    --
    -- These fields remain for compatibility with existing UI
    -- and backend code.
    --

    voltage_kv INT,

    capacity_mw NUMERIC(10,2),


    -- ========================================================
    -- DETAILED CAPACITY INFORMATION
    -- ========================================================
    --
    -- The AI pipeline preserves distinct capacity concepts.
    --

    nameplate_mw NUMERIC(12,3),

    summer_mw NUMERIC(12,3),

    winter_mw NUMERIC(12,3),

    storage_mwh NUMERIC(12,3),


    -- ========================================================
    -- EXISTING LOCATION INFORMATION
    -- ========================================================

    county VARCHAR(100),


    -- ========================================================
    -- EXTENDED LOCATION INFORMATION
    -- ========================================================

    state VARCHAR(2),

    address TEXT,

    location_source VARCHAR(50),


    -- ========================================================
    -- EXISTING PROJECT SCHEDULE
    -- ========================================================
    --
    -- Preserved for existing application compatibility.
    --

    start_year INT,

    end_year INT,

    start_date DATE,

    end_date DATE,


    -- ========================================================
    -- SOURCE-PRECISION TIMELINE
    -- ========================================================
    --
    -- Stored as TEXT intentionally.
    --
    -- Planning documents may provide:
    --
    -- 2026
    -- 2026-05
    -- 2034-06-01
    --
    -- Converting partial dates to DATE would invent precision.
    --

    construction_start_text TEXT,

    commercial_service_text TEXT,

    retirement_date_text TEXT,


    -- ========================================================
    -- STATUS
    -- ========================================================

    status VARCHAR(80)
        NOT NULL
        DEFAULT 'Planned',


    -- ========================================================
    -- INTERCONNECTION
    -- ========================================================

    station TEXT,

    connection TEXT,

    line_length_miles NUMERIC(12,3),


    -- ========================================================
    -- GENERATION / SITE DETAILS
    -- ========================================================

    primary_fuel VARCHAR(100),

    alternate_fuel VARCHAR(100),

    acreage NUMERIC(12,3),

    is_tbd BOOLEAN
        NOT NULL
        DEFAULT FALSE,


    -- ========================================================
    -- DESCRIPTION
    -- ========================================================

    description TEXT,


    -- ========================================================
    -- EXISTING OWNERSHIP VISIBILITY
    -- ========================================================

    ownership_visibility VARCHAR(20)
        NOT NULL
        DEFAULT 'public'
        CHECK (
            ownership_visibility IN (
                'public',
                'authenticated',
                'private'
            )
        ),


    -- ========================================================
    -- EXISTING INTERNAL NOTES
    -- ========================================================

    internal_notes TEXT,


    -- ========================================================
    -- GEOGRAPHIC LOCATION
    -- ========================================================
    --
    -- Can store:
    --
    -- POINT
    -- LINESTRING
    -- POLYGON
    --
    -- SRID 4326 = standard longitude/latitude coordinates.
    --

    geom GEOMETRY(GEOMETRY, 4326),


    -- ========================================================
    -- EXISTING SOURCE / TRACEABILITY FIELDS
    -- ========================================================
    --
    -- These remain for backward compatibility.
    --
    -- Detailed many-to-many traceability is handled separately
    -- through sources/project_sources.
    --

    source_url TEXT,

    source_type VARCHAR(30)
        DEFAULT 'official_tysp',

    source_document VARCHAR(255),

    source_page VARCHAR(30),


    -- ========================================================
    -- TIMESTAMPS
    -- ========================================================

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,


    -- ========================================================
    -- CONSTRAINTS
    -- ========================================================

    CHECK (
        end_date IS NULL
        OR start_date IS NULL
        OR end_date >= start_date
    ),

    /*
     * Existing manually created projects may not have an
     * external_id.
     *
     * PostgreSQL UNIQUE allows multiple NULL values, so this
     * remains backward-compatible while AI-imported records can
     * use stable external IDs.
     */

    UNIQUE (
        utility_id,
        external_id
    )
);


-- ============================================================
-- PROJECT INDEXES
-- ============================================================

CREATE INDEX idx_projects_geom
ON projects
USING GIST (geom);


CREATE INDEX idx_projects_category
ON projects(category);


CREATE INDEX idx_projects_dates
ON projects(
    start_date,
    end_date
);


CREATE INDEX idx_projects_utility
ON projects(utility_id);


CREATE INDEX idx_projects_external_id
ON projects(external_id);


CREATE INDEX idx_projects_entity_type
ON projects(entity_type);


CREATE INDEX idx_projects_infrastructure_type
ON projects(infrastructure_type);


-- ============================================================
-- SOURCES
-- ============================================================
--
-- Structured evidence extracted from public planning documents.
--
-- external_id corresponds to extraction identifiers such as:
--
-- s1
-- s4
-- s7
--
-- IDs are scoped to a utility because another utility/document
-- may independently use the same extraction source identifier.
--

CREATE TABLE sources (
    id BIGSERIAL PRIMARY KEY,

    utility_id INT NOT NULL
        REFERENCES utilities(id)
        ON DELETE CASCADE,

    external_id VARCHAR(100) NOT NULL,

    document VARCHAR(255),

    section TEXT,

    schedule VARCHAR(100),

    figure VARCHAR(100),

    pdf_page INT,

    printed_page VARCHAR(50),

    evidence TEXT,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        utility_id,
        external_id
    )
);


CREATE INDEX idx_sources_utility
ON sources(utility_id);


-- ============================================================
-- PLAN EVENTS
-- ============================================================
--
-- Represents changes/milestones in infrastructure planning.
--
-- Examples:
--
-- construction_start
-- commercial_service
-- retirement
-- capacity_increase
-- degradation
-- contract_expiration
--
-- project_id is intentionally nullable.
--
-- Some events describe utility-wide or portfolio-level planning
-- changes rather than one specific project.
-- ============================================================

CREATE TABLE plan_events (
    id BIGSERIAL PRIMARY KEY,

    utility_id INT NOT NULL
        REFERENCES utilities(id)
        ON DELETE CASCADE,

    external_id VARCHAR(255) NOT NULL,

    project_id INT
        REFERENCES projects(id)
        ON DELETE CASCADE,

    event_type VARCHAR(80) NOT NULL,

    /*
     * TEXT intentionally preserves source precision:
     *
     * 2026
     * 2026-05
     * 2026-05-01
     */

    effective_date TEXT,

    capacity_mw NUMERIC(12,3),

    capacity_type VARCHAR(50),

    description TEXT,

    is_derived BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    derivation_source TEXT,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        utility_id,
        external_id
    )
);


CREATE INDEX idx_plan_events_utility
ON plan_events(utility_id);


CREATE INDEX idx_plan_events_project
ON plan_events(project_id);


CREATE INDEX idx_plan_events_type
ON plan_events(event_type);


-- ============================================================
-- PROJECT RELATIONSHIPS
-- ============================================================
--
-- Represents explicit relationships between infrastructure
-- entities.
--
-- Examples:
--
-- solar project -> transmission interconnection
-- storage project -> transmission interconnection
--
-- Both endpoints continue to reference projects.id so the rest
-- of the GridLock application remains unchanged.
-- ============================================================

CREATE TABLE project_relationships (
    id BIGSERIAL PRIMARY KEY,

    from_project_id INT NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,

    to_project_id INT NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,

    relationship_type VARCHAR(80)
        NOT NULL,

    description TEXT,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        from_project_id,
        to_project_id,
        relationship_type
    ),

    CHECK (
        from_project_id <> to_project_id
    )
);


CREATE INDEX idx_project_relationships_from
ON project_relationships(from_project_id);


CREATE INDEX idx_project_relationships_to
ON project_relationships(to_project_id);


-- ============================================================
-- PROJECT SOURCES
-- ============================================================
--
-- Many-to-many traceability:
--
-- project/entity <-> document evidence
-- ============================================================

CREATE TABLE project_sources (
    project_id INT NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,

    source_id BIGINT NOT NULL
        REFERENCES sources(id)
        ON DELETE CASCADE,

    PRIMARY KEY (
        project_id,
        source_id
    )
);


CREATE INDEX idx_project_sources_source
ON project_sources(source_id);


-- ============================================================
-- EVENT SOURCES
-- ============================================================
--
-- Many-to-many traceability:
--
-- plan event <-> document evidence
-- ============================================================

CREATE TABLE event_sources (
    event_id BIGINT NOT NULL
        REFERENCES plan_events(id)
        ON DELETE CASCADE,

    source_id BIGINT NOT NULL
        REFERENCES sources(id)
        ON DELETE CASCADE,

    PRIMARY KEY (
        event_id,
        source_id
    )
);


CREATE INDEX idx_event_sources_source
ON event_sources(source_id);


-- ============================================================
-- NOTIFICATIONS
-- ============================================================
--
-- Existing structure preserved.
-- ============================================================

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,

    user_id INT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    type VARCHAR(50) NOT NULL,

    message TEXT NOT NULL,

    project_id INT
        REFERENCES projects(id)
        ON DELETE CASCADE,

    is_read BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- COLLABORATION REQUESTS
-- ============================================================
--
-- Existing structure preserved.
--
-- Allows utilities to contact each other about potential
-- coordination opportunities.
-- ============================================================

CREATE TABLE collaboration_requests (
    id SERIAL PRIMARY KEY,

    sender_utility_id INT NOT NULL
        REFERENCES utilities(id),

    receiver_utility_id INT NOT NULL
        REFERENCES utilities(id),

    project1_id INT NOT NULL
        REFERENCES projects(id),

    project2_id INT
        REFERENCES projects(id),

    message TEXT,

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'accepted',
                'declined'
            )
        ),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- CONVERSATIONS
-- ============================================================
--
-- Existing structure preserved.
-- ============================================================

CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,

    utility1_id INT NOT NULL
        REFERENCES utilities(id),

    utility2_id INT NOT NULL
        REFERENCES utilities(id),

    project_id INT
        REFERENCES projects(id),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- MESSAGES
-- ============================================================
--
-- Existing structure preserved.
-- ============================================================

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,

    conversation_id INT NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    sender_user_id INT NOT NULL
        REFERENCES users(id),

    body TEXT NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- PROCESSED DOCUMENTS
-- Prevents the same source document from
-- being analyzed/imported more than once.
-- ==========================================

CREATE TABLE IF NOT EXISTS processed_documents (
    id BIGSERIAL PRIMARY KEY,

    sha256 VARCHAR(64) NOT NULL UNIQUE,

    original_filename TEXT NOT NULL,

    utility_id INTEGER REFERENCES utilities(id)
        ON DELETE SET NULL,

    extraction_name TEXT,

    status VARCHAR(30) NOT NULL DEFAULT 'completed',

    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_documents_sha256
    ON processed_documents(sha256);