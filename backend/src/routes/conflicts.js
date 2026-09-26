const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const radius = Number(req.query.radius || 15);

    const result = await pool.query(
      `
      SELECT
        p1.id AS project_id,
        p1.title AS project_title,
        p2.id AS conflict_id,
        p2.title AS conflict_title,
        p1.category AS project_category,
        p2.category AS conflict_category,
        p1.start_date AS project_start_date,
        p1.end_date AS project_end_date,
        p2.start_date AS conflict_start_date,
        p2.end_date AS conflict_end_date,
        ST_Distance(
          p1.geom::geography,
          p2.geom::geography
        ) AS distance_meters
      FROM projects p1
      JOIN projects p2
        ON p1.id < p2.id
      WHERE
        ST_DWithin(
          p1.geom::geography,
          p2.geom::geography,
          $1 * 1000
        )
        AND p1.start_date <= p2.end_date
        AND p1.end_date >= p2.start_date
      ORDER BY distance_meters;
      `,
      [radius]
    );

    const conflicts = result.rows.map((row) => ({
      project_id: row.project_id,
      project_title: row.project_title,
      conflict_id: row.conflict_id,
      conflict_title: row.conflict_title,
      distance_meters: Number(row.distance_meters),
      dates: {
        project_start: row.project_start_date,
        project_end: row.project_end_date,
        conflict_start: row.conflict_start_date,
        conflict_end: row.conflict_end_date,
      },
    }));

    res.json({
      radius_km: radius,
      conflicts,
    });
  } catch (error) {
    console.error('Error detecting conflicts:', error);

    res.status(500).json({
      error: 'Unable to detect project conflicts',
    });
  }
});

module.exports = router;
