-- ==========================================
-- GRIDLOCK REAL DATA
-- Initial dataset from official 2026 TYSPs
-- ==========================================


-- ==========================================
-- UTILITIES
-- ==========================================

INSERT INTO utilities (name, state)
VALUES
    ('Florida Power & Light (FPL)', 'FL'),
    ('Duke Energy Florida', 'FL')
ON CONFLICT (name) DO NOTHING;


-- ==========================================
-- DUKE ENERGY FLORIDA
-- Jumper Creek Solar Center
-- ==========================================

INSERT INTO projects (
    utility_id,
    title,
    category,
    subtype,
    voltage_kv,
    capacity_mw,
    county,
    start_year,
    end_year,
    start_date,
    end_date,
    status,
    description,
    geom,
    source_type,
    source_document,
    source_page
)
VALUES (
    (
        SELECT id
        FROM utilities
        WHERE name = 'Duke Energy Florida'
    ),

    'Jumper Creek Solar Center',
    'Generation',
    'Solar',
    230,
    74.9,
    'Sumter',

    2025,
    2026,

    NULL,
    NULL,

    'Planned',

    '74.9 MWac solar photovoltaic project in Sumter County connected to a new 230 kV terminal at Cresent switching station.',

    ST_SetSRID(
        ST_MakePoint(-82.176522, 28.954544),
        4326
    ),

    'official_tysp',
    'Duke Energy Florida 2026 Ten-Year Site Plan',
    '4-2'
)
ON CONFLICT (utility_id, title) DO NOTHING;


-- ==========================================
-- FLORIDA POWER & LIGHT
-- Terrill Creek Battery Storage
-- ==========================================

INSERT INTO projects (
    utility_id,
    title,
    category,
    subtype,
    voltage_kv,
    capacity_mw,
    county,
    start_year,
    end_year,
    start_date,
    end_date,
    status,
    description,
    geom,
    source_type,
    source_document,
    source_page
)
VALUES (
    (
        SELECT id
        FROM utilities
        WHERE name = 'Florida Power & Light (FPL)'
    ),

    'Terrill Creek Battery Storage',
    'Generation & Storage',
    'Battery Storage',
    230,
    74.5,
    'Clay',

    2026,
    2027,

    NULL,
    NULL,

    'Planned',

    '74.5 MW battery storage project in Clay County. Field construction is planned for 2026 with commercial in-service in 2027.',

    NULL,

    'official_tysp',
    'FPL 2026-2035 Ten-Year Site Plan',
    'Schedule 9'
)
ON CONFLICT (utility_id, title) DO NOTHING;

-- ==========================================
-- DUKE ENERGY FLORIDA
-- Banner Solar Center
-- ==========================================

INSERT INTO projects (
    utility_id, title, category, subtype,
    voltage_kv, capacity_mw, county,
    start_year, end_year, start_date, end_date,
    status, description, geom,
    source_type, source_document, source_page
)
VALUES (
    (
        SELECT id FROM utilities
        WHERE name = 'Duke Energy Florida'
    ),
    'Banner Solar Center',
    'Generation',
    'Solar',
    230,
    74.5,
    'Columbia',
    2026,
    2027,
    NULL,
    NULL,
    'Planned',
    '74.5 MWac solar PV project in Columbia County. Construction is expected to start in June 2026 with expected in-service in April 2027.',
    ST_SetSRID(
        ST_MakePoint(-82.726739, 29.880411),
        4326
    ),
    'official_tysp',
    'Duke Energy Florida 2026 Ten-Year Site Plan',
    '4-5'
)
ON CONFLICT (utility_id, title) DO NOTHING;


-- ==========================================
-- DUKE ENERGY FLORIDA
-- Nova Solar Center
-- ==========================================

INSERT INTO projects (
    utility_id, title, category, subtype,
    voltage_kv, capacity_mw, county,
    start_year, end_year, start_date, end_date,
    status, description, geom,
    source_type, source_document, source_page
)
VALUES (
    (
        SELECT id FROM utilities
        WHERE name = 'Duke Energy Florida'
    ),
    'Nova Solar Center',
    'Generation',
    'Solar',
    230,
    74.9,
    'Orange',
    2026,
    2027,
    NULL,
    NULL,
    'Planned',
    '74.9 MWac solar project in Orange County. Construction is expected to start in Q4 2026 with expected in-service in December 2027.',
    ST_SetSRID(
        ST_MakePoint(-80.934377, 28.378061),
        4326
    ),
    'official_tysp',
    'Duke Energy Florida 2026 Ten-Year Site Plan',
    '4-8'
)
ON CONFLICT (utility_id, title) DO NOTHING;


-- ==========================================
-- DUKE ENERGY FLORIDA
-- Wewahootee Solar Center
-- ==========================================

INSERT INTO projects (
    utility_id, title, category, subtype,
    voltage_kv, capacity_mw, county,
    start_year, end_year, start_date, end_date,
    status, description, geom,
    source_type, source_document, source_page
)
VALUES (
    (
        SELECT id FROM utilities
        WHERE name = 'Duke Energy Florida'
    ),
    'Wewahootee Solar Center',
    'Generation',
    'Solar',
    230,
    74.9,
    'Orange',
    2026,
    2028,
    NULL,
    NULL,
    'Planned',
    '74.9 MWac solar project in Orange County. Construction is expected to start in Q4 2026 with expected in-service in March 2028.',
    ST_SetSRID(
        ST_MakePoint(-80.969111, 28.384832),
        4326
    ),
    'official_tysp',
    'Duke Energy Florida 2026 Ten-Year Site Plan',
    '4-10'
)
ON CONFLICT (utility_id, title) DO NOTHING;


-- ==========================================
-- FLORIDA POWER & LIGHT
-- Ambersweet Solar Energy Center
-- ==========================================

INSERT INTO projects (
    utility_id, title, category, subtype,
    voltage_kv, capacity_mw, county,
    start_year, end_year, start_date, end_date,
    status, description, geom,
    source_type, source_document, source_page
)
VALUES (
    (
        SELECT id FROM utilities
        WHERE name = 'Florida Power & Light (FPL)'
    ),
    'Ambersweet Solar Energy Center',
    'Generation',
    'Solar',
    NULL,
    74.5,
    'Indian River',
    2027,
    2028,
    NULL,
    NULL,
    'Planned',
    '74.5 MW photovoltaic solar project in Indian River County. Field construction is planned for 2027 with commercial in-service in 2028.',
    NULL,
    'official_tysp',
    'FPL 2026-2035 Ten-Year Site Plan',
    'Schedule 9 - Page 52 of 100'
)
ON CONFLICT (utility_id, title) DO NOTHING;


-- ==========================================
-- FLORIDA POWER & LIGHT
-- Grapefruit Solar Energy Center
-- ==========================================

INSERT INTO projects (
    utility_id, title, category, subtype,
    voltage_kv, capacity_mw, county,
    start_year, end_year, start_date, end_date,
    status, description, geom,
    source_type, source_document, source_page
)
VALUES (
    (
        SELECT id FROM utilities
        WHERE name = 'Florida Power & Light (FPL)'
    ),
    'Grapefruit Solar Energy Center',
    'Generation',
    'Solar',
    NULL,
    75.5,
    'Hendry',
    2027,
    2028,
    NULL,
    NULL,
    'Planned',
    '75.5 MW photovoltaic solar project in Hendry County. Field construction is planned for 2027 with commercial in-service in 2028.',
    NULL,
    'official_tysp',
    'FPL 2026-2035 Ten-Year Site Plan',
    'Schedule 9 - Page 57 of 100'
)
ON CONFLICT (utility_id, title) DO NOTHING;


-- ==========================================
-- FLORIDA POWER & LIGHT
-- Grapefruit Battery Storage
-- ==========================================

INSERT INTO projects (
    utility_id, title, category, subtype,
    voltage_kv, capacity_mw, county,
    start_year, end_year, start_date, end_date,
    status, description, geom,
    source_type, source_document, source_page
)
VALUES (
    (
        SELECT id FROM utilities
        WHERE name = 'Florida Power & Light (FPL)'
    ),
    'Grapefruit Battery Storage',
    'Generation & Storage',
    'Battery Storage',
    NULL,
    74.5,
    'Hendry',
    2027,
    2028,
    NULL,
    NULL,
    'Planned',
    '74.5 MW battery storage project in Hendry County. Field construction is planned for 2027 with commercial in-service in 2028.',
    NULL,
    'official_tysp',
    'FPL 2026-2035 Ten-Year Site Plan',
    'Schedule 9 - Page 67 of 100'
)
ON CONFLICT (utility_id, title) DO NOTHING;

