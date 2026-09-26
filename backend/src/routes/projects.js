const express = require('express');
const pool = require('../db');

const router = express.Router();


// GET /api/projects
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id,

        u.id AS utility_id,
        u.name AS utility,

        p.title,
        p.category,
        p.subtype,
        p.voltage_kv,
        p.capacity_mw,
        p.county,

        p.start_year,
        p.end_year,
        p.start_date,
        p.end_date,

        p.status,
        p.description,

        ST_GeometryType(p.geom) AS geometry_type,

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

        p.created_at

      FROM projects p

      JOIN utilities u
        ON p.utility_id = u.id

      ORDER BY p.id;
    `);

    res.json(result.rows);

  } catch (error) {
    console.error('Error getting projects:', error);

    res.status(500).json({
      error: 'Failed to get projects'
    });
  }
});


module.exports = router;