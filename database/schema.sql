CREATE EXTENSION IF NOT EXISTS postgis;

DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS collaboration_requests CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    utility_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    contact_visibility VARCHAR(20) NOT NULL DEFAULT 'authenticated',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    utility_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subtype VARCHAR(150) NOT NULL,
    voltage_kv INT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Planned',
    geom GEOMETRY(GEOMETRY, 4326) NOT NULL,
    ownership_visibility VARCHAR(20) NOT NULL DEFAULT 'public',
    internal_notes TEXT,
    source_url TEXT,
    source_type VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date),
    CHECK (ownership_visibility IN ('public', 'authenticated', 'private'))
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE collaboration_requests (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sender_utility_id INT NOT NULL,
    recipient_utility_id INT NOT NULL,
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('pending', 'accepted', 'declined')),
    CHECK (sender_utility_id <> recipient_utility_id)
);

CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    utility_a_id INT NOT NULL,
    utility_b_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (utility_a_id <> utility_b_id),
    UNIQUE (utility_a_id, utility_b_id)
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_utility_id INT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_geom
    ON projects USING GIST (geom);

CREATE INDEX idx_projects_category
    ON projects (category);

CREATE INDEX idx_projects_dates
    ON projects (start_date, end_date);

CREATE INDEX idx_projects_status
    ON projects (status);

CREATE INDEX idx_notifications_user
    ON notifications (user_id, is_read);

CREATE INDEX idx_messages_conversation
    ON messages (conversation_id, created_at);

-- Demo users/utilities
INSERT INTO users
    (utility_id, name, email, password_hash, contact_visibility)
VALUES
    (1, 'FPL Demo User', 'fpl-demo@gridlock.local', 'DEMO_PASSWORD_HASH', 'authenticated'),
    (2, 'Duke Demo User', 'duke-demo@gridlock.local', 'DEMO_PASSWORD_HASH', 'authenticated');

-- Demo projects
INSERT INTO projects
    (utility_id, title, category, subtype, voltage_kv, start_date, end_date, status, geom, ownership_visibility, source_type)
VALUES
(
    1,
    'Everglades-Miami 230kV Upgrade',
    'Transmission',
    'Reconductoring / Upgrade',
    230,
    '2026-04-01',
    '2026-11-30',
    'Planned',
    ST_GeomFromText(
        'LINESTRING(-80.3500 25.7600, -80.3000 25.8500, -80.2500 25.9500)',
        4326
    ),
    'public',
    'demo'
),
(
    2,
    'Broward Regional Intertie Line',
    'Transmission',
    'Greenfield Line',
    230,
    '2026-05-15',
    '2026-12-15',
    'Planned',
    ST_GeomFromText(
        'LINESTRING(-80.3300 25.7700, -80.2800 25.8700)',
        4326
    ),
    'public',
    'demo'
),
(
    1,
    'Homestead Solar-BESS Storage Hub',
    'Generation & Storage Integration',
    'BESS (Battery Energy Storage System)',
    115,
    '2027-01-10',
    '2027-08-30',
    'Planned',
    ST_GeomFromText(
        'POINT(-80.4776 25.4687)',
        4326
    ),
    'public',
    'demo'
),
(
    2,
    'Orange County Substation Expansion',
    'Substations',
    'Substation Expansion',
    500,
    '2026-08-01',
    '2027-03-31',
    'Planned',
    ST_GeomFromText(
        'POINT(-81.3792 28.5383)',
        4326
    ),
    'public',
    'demo'
),
(
    1,
    'Palm Beach Coastal Undergrounding',
    'Grid Hardening & Resilience',
    'Undergrounding',
    23,
    '2026-03-01',
    '2026-09-30',
    'Planned',
    ST_GeomFromText(
        'LINESTRING(-80.0360 26.7153, -80.0350 26.7500)',
        4326
    ),
    'public',
    'demo'
);
