const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.title,
        p.utility_id,
        p.category,
        p.subtype,
        p.voltage_kv,
        p.start_date,
        p.end_date,
        p.status,
        p.ownership_visibility,
        ST_AsGeoJSON(p.geom)::json AS geometry
      FROM projects p
      ORDER BY p.id;
    `);

    const features = result.rows.map((project) => ({
      type: 'Feature',
      geometry: project.geometry,
      properties: {
        id: project.id,
        title: project.title,
        utility_id: project.utility_id,
        category: project.category,
        subtype: project.subtype,
        voltage_kv: project.voltage_kv,
        status: project.status,
        start_date: project.start_date,
        end_date: project.end_date,
        ownership_visibility: project.ownership_visibility,
      },
    }));

    res.json({
      type: 'FeatureCollection',
      features,
    });
  } catch (error) {
    console.error('Error loading projects:', error);
    res.status(500).json({
      error: 'Unable to load projects',
    });
  }
});

module.exports = router;
