const express = require('express');
const pool = require('../db');

const router = express.Router();


// ============================================================
// GET /api/projects
// ============================================================
//
// Returns all GridLock infrastructure entities.
//
// Backward compatibility:
// Existing fields such as title, category, capacity_mw,
// county, start_year, etc. remain unchanged.
//
// New extraction fields are returned alongside them.
// ============================================================

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id,

        -- Utility
        u.id AS utility_id,
        u.name AS utility,

        -- Stable extraction identifier
        p.external_id,

        -- Existing project information
        p.title,
        p.category,
        p.subtype,

        -- New entity classification
        p.entity_type,
        p.infrastructure_type,
        p.technology,

        -- Existing simplified technical information
        p.voltage_kv,
        p.capacity_mw,

        -- Detailed capacity information
        p.nameplate_mw,
        p.summer_mw,
        p.winter_mw,
        p.storage_mwh,

        -- Location
        p.county,
        p.state,
        p.address,
        p.location_source,

        -- Existing timeline fields
        p.start_year,
        p.end_year,
        p.start_date,
        p.end_date,

        -- Source-precision timeline
        p.construction_start_text,
        p.commercial_service_text,
        p.retirement_date_text,

        -- Status
        p.status,

        -- Interconnection
        p.station,
        p.connection,
        p.line_length_miles,

        -- Generation / site information
        p.primary_fuel,
        p.alternate_fuel,
        p.acreage,
        p.is_tbd,

        -- Description
        p.description,

        -- Geometry type
        ST_GeometryType(p.geom) AS geometry_type,

        -- Point coordinates
        CASE
          WHEN p.geom IS NOT NULL
               AND GeometryType(p.geom) = 'POINT'
          THEN ST_Y(p.geom)
          ELSE NULL
        END AS latitude,

        CASE
          WHEN p.geom IS NOT NULL
               AND GeometryType(p.geom) = 'POINT'
          THEN ST_X(p.geom)
          ELSE NULL
        END AS longitude,

        -- Existing source fields
        p.source_type,
        p.source_document,
        p.source_page,
        p.source_url,

        -- Timestamps
        p.created_at,
        p.updated_at

      FROM projects p

      JOIN utilities u
        ON p.utility_id = u.id

      ORDER BY p.id;
    `);

    res.json(result.rows);

  } catch (error) {
    console.error(
      'Error getting projects:',
      error
    );

    res.status(500).json({
      error: 'Failed to get projects'
    });
  }
});


// ============================================================
// GET /api/projects/:id
// ============================================================
//
// Returns one infrastructure entity with:
//
// - complete project/entity information
// - plan events
// - relationships
// - document sources
//
// This endpoint is additive and does not affect the existing
// GET /api/projects endpoint.
// ============================================================

router.get('/:id', async (req, res) => {
  const projectId = Number(req.params.id);

  if (
    !Number.isInteger(projectId) ||
    projectId <= 0
  ) {
    return res.status(400).json({
      error: 'Invalid project id'
    });
  }

  try {

    // --------------------------------------------------------
    // PROJECT / ENTITY
    // --------------------------------------------------------

    const projectResult = await pool.query(`
      SELECT
        p.id,

        u.id AS utility_id,
        u.name AS utility,

        p.external_id,

        p.title,
        p.category,
        p.subtype,

        p.entity_type,
        p.infrastructure_type,
        p.technology,

        p.voltage_kv,
        p.capacity_mw,

        p.nameplate_mw,
        p.summer_mw,
        p.winter_mw,
        p.storage_mwh,

        p.county,
        p.state,
        p.address,
        p.location_source,

        p.start_year,
        p.end_year,
        p.start_date,
        p.end_date,

        p.construction_start_text,
        p.commercial_service_text,
        p.retirement_date_text,

        p.status,

        p.station,
        p.connection,
        p.line_length_miles,

        p.primary_fuel,
        p.alternate_fuel,
        p.acreage,
        p.is_tbd,

        p.description,

        ST_GeometryType(p.geom)
          AS geometry_type,

        CASE
          WHEN p.geom IS NOT NULL
               AND GeometryType(p.geom) = 'POINT'
          THEN ST_Y(p.geom)
          ELSE NULL
        END AS latitude,

        CASE
          WHEN p.geom IS NOT NULL
               AND GeometryType(p.geom) = 'POINT'
          THEN ST_X(p.geom)
          ELSE NULL
        END AS longitude,

        p.source_type,
        p.source_document,
        p.source_page,
        p.source_url,

        p.created_at,
        p.updated_at

      FROM projects p

      JOIN utilities u
        ON p.utility_id = u.id

      WHERE p.id = $1;
    `, [projectId]);


    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }


    // --------------------------------------------------------
    // PLAN EVENTS
    // --------------------------------------------------------

    const eventsResult = await pool.query(`
      SELECT
        pe.id,
        pe.external_id,
        pe.event_type,
        pe.effective_date,
        pe.capacity_mw,
        pe.capacity_type,
        pe.description,
        pe.is_derived,
        pe.derivation_source,
        pe.created_at,
        pe.updated_at

      FROM plan_events pe

      WHERE pe.project_id = $1

      ORDER BY
        pe.effective_date NULLS LAST,
        pe.id;
    `, [projectId]);


    // --------------------------------------------------------
    // RELATIONSHIPS
    // --------------------------------------------------------
    //
    // Return relationships in BOTH directions.
    // --------------------------------------------------------

    const relationshipsResult = await pool.query(`
      SELECT
        pr.id,
        pr.relationship_type,
        pr.description,

        CASE
          WHEN pr.from_project_id = $1
          THEN 'outgoing'
          ELSE 'incoming'
        END AS direction,

        related.id AS project_id,
        related.external_id,
        related.title,
        related.category,
        related.entity_type,
        related.infrastructure_type

      FROM project_relationships pr

      JOIN projects related
        ON related.id =
          CASE
            WHEN pr.from_project_id = $1
            THEN pr.to_project_id
            ELSE pr.from_project_id
          END

      WHERE
        pr.from_project_id = $1
        OR pr.to_project_id = $1

      ORDER BY pr.id;
    `, [projectId]);


    // --------------------------------------------------------
    // SOURCES
    // --------------------------------------------------------

    const sourcesResult = await pool.query(`
      SELECT
        s.id,
        s.external_id,
        s.document,
        s.section,
        s.schedule,
        s.figure,
        s.pdf_page,
        s.printed_page,
        s.evidence

      FROM project_sources ps

      JOIN sources s
        ON s.id = ps.source_id

      WHERE ps.project_id = $1

      ORDER BY
        s.pdf_page NULLS LAST,
        s.id;
    `, [projectId]);


    // --------------------------------------------------------
    // EVENT SOURCES
    // --------------------------------------------------------
    //
    // Useful for tracing individual timeline events back to
    // the planning document.
    // --------------------------------------------------------

    const eventSourcesResult = await pool.query(`
      SELECT
        pe.id AS event_id,
        pe.external_id AS event_external_id,

        s.id AS source_id,
        s.external_id AS source_external_id,
        s.document,
        s.section,
        s.schedule,
        s.figure,
        s.pdf_page,
        s.printed_page,
        s.evidence

      FROM plan_events pe

      JOIN event_sources es
        ON es.event_id = pe.id

      JOIN sources s
        ON s.id = es.source_id

      WHERE pe.project_id = $1

      ORDER BY
        pe.id,
        s.pdf_page NULLS LAST,
        s.id;
    `, [projectId]);


    // --------------------------------------------------------
    // GROUP EVENT SOURCES BY EVENT
    // --------------------------------------------------------

    const sourcesByEvent = {};

    for (
      const source
      of eventSourcesResult.rows
    ) {
      const eventId =
        source.event_id;

      if (!sourcesByEvent[eventId]) {
        sourcesByEvent[eventId] = [];
      }

      sourcesByEvent[eventId].push({
        id:
          source.source_id,

        external_id:
          source.source_external_id,

        document:
          source.document,

        section:
          source.section,

        schedule:
          source.schedule,

        figure:
          source.figure,

        pdf_page:
          source.pdf_page,

        printed_page:
          source.printed_page,

        evidence:
          source.evidence
      });
    }


    // --------------------------------------------------------
    // ATTACH SOURCES TO EVENTS
    // --------------------------------------------------------

    const events =
      eventsResult.rows.map(
        event => ({
          ...event,

          sources:
            sourcesByEvent[event.id] || []
        })
      );


    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    res.json({
      ...projectResult.rows[0],

      events,

      relationships:
        relationshipsResult.rows,

      sources:
        sourcesResult.rows
    });

  } catch (error) {
    console.error(
      'Error getting project:',
      error
    );

    res.status(500).json({
      error: 'Failed to get project'
    });
  }
});


module.exports = router;