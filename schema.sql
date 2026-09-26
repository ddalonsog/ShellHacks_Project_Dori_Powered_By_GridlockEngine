-- 1. Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Clean up old tables
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS utilities;

-- 3. Create Utilities Table
CREATE TABLE utilities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    contact_email VARCHAR(100)
);

-- 4. Create Projects Table
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    utility_id INT REFERENCES utilities(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL, -- Transmission, Substation, Distribution, BESS, Hardening, GETs
    subtype VARCHAR(100) NOT NULL,
    voltage_kv INT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'Planned',
    geom GEOMETRY(GEOMETRY, 4326) NOT NULL, -- Stores Points or LineStrings (EPSG:4326)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create Spatial Index (GIST R-Tree) for fast geographical searches
CREATE INDEX idx_projects_geom ON projects USING GIST (geom);

-- ============================================================================
-- DUMMY DATA FOR SHELLHACKS DEMO (FLORIDA REGION)
-- ============================================================================

-- Insert Utilities
INSERT INTO utilities (name, state, contact_email) VALUES
('Florida Power & Light (FPL)', 'FL', 'planning@fpl.com'),
('Duke Energy Florida', 'FL', 'grid-coordination@duke-energy.com');

-- Insert Projects (Points and Lines in South/Central Florida)
-- Notice: FPL Project 1 and Duke Project 1 overlap in space (~3.5km apart) and time (Q2-Q4 2026)!

-- 1. FPL Transmission Line (Miami-Dade / Broward Corridor)
INSERT INTO projects (utility_id, title, category, subtype, voltage_kv, start_date, end_date, geom)
VALUES (
    1,
    'Everglades-Miami 230kV Upgrade',
    'Transmission',
    'Reconductoring / Upgrade',
    230,
    '2026-04-01',
    '2026-11-30',
    ST_GeomFromText('LINESTRING(-80.3500 25.7600, -80.3000 25.8500, -80.2500 25.9500)', 4326)
);

-- 2. Duke Energy Transmission Line (NEARBY FPL CORRIDOR - OVERLAP CONFLICT!)
INSERT INTO projects (utility_id, title, category, subtype, voltage_kv, start_date, end_date, geom)
VALUES (
    2,
    'Broward Regional Intertie Line',
    'Transmission',
    'Greenfield Line',
    230,
    '2026-05-15',
    '2026-12-15',
    ST_GeomFromText('LINESTRING(-80.3300 25.7700, -80.2800 25.8700)', 4326)
);

-- 3. FPL Battery Energy Storage System (BESS)
INSERT INTO projects (utility_id, title, category, subtype, voltage_kv, start_date, end_date, geom)
VALUES (
    1,
    'Homestead Solar-BESS Storage Hub',
    'Generation & Storage Integration',
    'BESS (Battery Energy Storage)',
    115,
    '2027-01-10',
    '2027-08-30',
    ST_GeomFromText('POINT(-80.4776 25.4687)', 4326)
);

-- 4. Duke Energy Substation Expansion (Orlando Region)
INSERT INTO projects (utility_id, title, category, subtype, voltage_kv, start_date, end_date, geom)
VALUES (
    2,
    'Orange County Substation Expansion',
    'Substations',
    'Substation Expansion',
    500,
    '2026-08-01',
    '2027-03-31',
    ST_GeomFromText('POINT(-81.3792 28.5383)', 4326)
);

-- 5. FPL Grid Hardening (Palm Beach)
INSERT INTO projects (utility_id, title, category, subtype, voltage_kv, start_date, end_date, geom)
VALUES (
    1,
    'Palm Beach Coastal Undergrounding',
    'Resilience & Hardening',
    'Undergrounding',
    23,
    '2026-03-01',
    '2026-09-30',
    ST_GeomFromText('LINESTRING(-80.0360 26.7153, -80.0350 26.7500)', 4326)
);