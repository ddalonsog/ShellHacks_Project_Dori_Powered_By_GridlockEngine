CREATE EXTENSION IF NOT EXISTS postgis;

-- ==========================================
-- RESET TABLES
-- ==========================================

DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS collaboration_requests CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS utilities CASCADE;


-- ==========================================
-- UTILITIES
-- Electric utility companies such as
-- FPL and Duke Energy Florida
-- ==========================================

CREATE TABLE utilities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL,
    state VARCHAR(2) NOT NULL,

    contact_email VARCHAR(255),

    contact_visibility VARCHAR(20) NOT NULL DEFAULT 'public'
        CHECK (
            contact_visibility IN (
                'public',
                'authenticated',
                'private'
            )
        ),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- USERS
-- Users belonging to a utility
-- ==========================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,

    utility_id INT NOT NULL
        REFERENCES utilities(id)
        ON DELETE CASCADE,

    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,

    role VARCHAR(30) NOT NULL DEFAULT 'member',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- PROJECTS
-- Future infrastructure projects obtained
-- from public utility planning documents
-- ==========================================

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,

    -- Utility responsible for the project
    utility_id INT NOT NULL
        REFERENCES utilities(id)
        ON DELETE CASCADE,

    -- Basic project information
    title VARCHAR(150) NOT NULL,
    category VARCHAR(80) NOT NULL,
    subtype VARCHAR(100),

    -- Technical information
    voltage_kv INT,
    capacity_mw NUMERIC(10,2),

    -- Location information
    county VARCHAR(100),

    -- Project schedule
    start_year INT,
    end_year INT,
    start_date DATE,
    end_date DATE,

    status VARCHAR(30) NOT NULL DEFAULT 'Planned',

    -- Optional project description
    description TEXT,

    -- Who can see ownership information
    ownership_visibility VARCHAR(20)
        NOT NULL DEFAULT 'public'
        CHECK (
            ownership_visibility IN (
                'public',
                'authenticated',
                'private'
            )
        ),

    -- Notes used internally by GridLock users
    internal_notes TEXT,

    -- Geographic location.
    --
    -- Can store:
    -- POINT       -> solar site, substation, battery site
    -- LINESTRING  -> transmission line
    --
    -- SRID 4326 = standard latitude/longitude coordinates
    geom GEOMETRY(GEOMETRY, 4326),

    -- ======================================
    -- SOURCE / TRACEABILITY
    -- ======================================

    -- URL where the public document came from
    source_url TEXT,

    -- Example:
    -- "official_tysp"
    -- "manual"
    -- "csv"
    source_type VARCHAR(30) DEFAULT 'official_tysp',

    -- Example:
    -- "FPL 2026-2035 Ten-Year Site Plan"
    source_document VARCHAR(255),

    -- Page/table where GridLock obtained the data
    source_page VARCHAR(30),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- If both dates exist, end cannot precede start
        CHECK (
        end_date IS NULL
        OR start_date IS NULL
        OR end_date >= start_date
    ),

    UNIQUE (utility_id, title)
);


-- ==========================================
-- PROJECT INDEXES
-- Improve searches and PostGIS calculations
-- ==========================================

CREATE INDEX idx_projects_geom
ON projects
USING GIST (geom);

CREATE INDEX idx_projects_category
ON projects(category);

CREATE INDEX idx_projects_dates
ON projects(start_date, end_date);

CREATE INDEX idx_projects_utility
ON projects(utility_id);


-- ==========================================
-- NOTIFICATIONS
-- ==========================================

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

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- COLLABORATION REQUESTS
-- Allows utilities to contact each other
-- about potential coordination opportunities
-- ==========================================

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

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'accepted',
                'declined'
            )
        ),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- CONVERSATIONS
-- ==========================================

CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,

    utility1_id INT NOT NULL
        REFERENCES utilities(id),

    utility2_id INT NOT NULL
        REFERENCES utilities(id),

    project_id INT
        REFERENCES projects(id),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- MESSAGES
-- ==========================================

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,

    conversation_id INT NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    sender_user_id INT NOT NULL
        REFERENCES users(id),

    body TEXT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);