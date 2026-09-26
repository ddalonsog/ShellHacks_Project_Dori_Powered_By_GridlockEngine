CREATE EXTENSION IF NOT EXISTS postgis;

DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS collaboration_requests CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS utilities CASCADE;

CREATE TABLE utilities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL,
    state VARCHAR(2) NOT NULL,
    contact_email VARCHAR(255),
    contact_visibility VARCHAR(20) NOT NULL DEFAULT 'public'
        CHECK (contact_visibility IN ('public', 'authenticated', 'private')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    utility_id INT NOT NULL REFERENCES utilities(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'member',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    utility_id INT NOT NULL REFERENCES utilities(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(80) NOT NULL,
    subtype VARCHAR(100) NOT NULL,
    voltage_kv INT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Planned',
    ownership_visibility VARCHAR(20) NOT NULL DEFAULT 'public'
        CHECK (ownership_visibility IN ('public', 'authenticated', 'private')),
    internal_notes TEXT,
    geom GEOMETRY(GEOMETRY, 4326) NOT NULL,
    source_url TEXT,
    source_type VARCHAR(30) DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date)
);

CREATE INDEX idx_projects_geom ON projects USING GIST (geom);
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_projects_dates ON projects(start_date, end_date);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE collaboration_requests (
    id SERIAL PRIMARY KEY,
    sender_utility_id INT NOT NULL REFERENCES utilities(id),
    receiver_utility_id INT NOT NULL REFERENCES utilities(id),
    project1_id INT NOT NULL REFERENCES projects(id),
    project2_id INT REFERENCES projects(id),
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    utility1_id INT NOT NULL REFERENCES utilities(id),
    utility2_id INT NOT NULL REFERENCES utilities(id),
    project_id INT REFERENCES projects(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_user_id INT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO utilities (name, state, contact_email) VALUES
('Florida Power & Light (FPL)', 'FL', 'planning@fpl.com'),
('Duke Energy Florida', 'FL', 'grid-coordination@duke-energy.com');

INSERT INTO projects
(utility_id, title, category, subtype, voltage_kv, start_date, end_date, geom)
VALUES
(
  1,
  'Everglades-Miami 230kV Upgrade',
  'Transmission',
  'Reconductoring / Upgrade',
  230,
  '2026-04-01',
  '2026-11-30',
  ST_GeomFromText(
    'LINESTRING(-80.3500 25.7600, -80.3000 25.8500, -80.2500 25.9500)',
    4326
  )
),
(
  2,
  'Broward Regional Intertie Line',
  'Transmission',
  'Greenfield Line',
  230,
  '2026-05-15',
  '2026-12-15',
  ST_GeomFromText(
    'LINESTRING(-80.3300 25.7700, -80.2800 25.8700)',
    4326
  )
),
(
  1,
  'Homestead Solar-BESS Storage Hub',
  'Generation & Storage Integration',
  'BESS (Battery Energy Storage System)',
  115,
  '2027-01-10',
  '2027-08-30',
  ST_GeomFromText('POINT(-80.4776 25.4687)', 4326)
),
(
  2,
  'Orange County Substation Expansion',
  'Substations',
  'Substation Expansion',
  500,
  '2026-08-01',
  '2027-03-31',
  ST_GeomFromText('POINT(-81.3792 28.5383)', 4326)
),
(
  1,
  'Palm Beach Coastal Undergrounding',
  'Grid Hardening & Resilience',
  'Pole & Tower Hardening',
  23,
  '2026-03-01',
  '2026-09-30',
  ST_GeomFromText('LINESTRING(-80.0360 26.7153, -80.0350 26.7500)', 4326)
);