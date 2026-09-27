const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

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

router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      title,
      category,
      subtype,
      voltage_kv,
      start_date,
      end_date,
      status,
      latitude,
      longitude,
    } = req.body;

    if (
      !title ||
      !category ||
      !subtype ||
      !start_date ||
      !end_date ||
      !status ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({
        error: 'Missing required project fields',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO projects (
        utility_id,
        title,
        category,
        subtype,
        voltage_kv,
        start_date,
        end_date,
        status,
        geom,
        ownership_visibility,
        source_type
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
	$8,
        ST_SetSRID(ST_MakePoint($9, $10), 4326),
        'public',
        'manual'
      )
      RETURNING
        id,
        title,
        category,
        subtype,
        voltage_kv,
        start_date,
        end_date,
        status,
        ST_AsGeoJSON(geom)::json AS geometry;
      `,
      [
        req.user.utility_id,
        title,
        category,
        subtype,
        voltage_kv || null,
        start_date,
        end_date,
        status,
        Number(longitude),
        Number(latitude),
      ]
    );

    res.status(201).json({
      message: 'Project created successfully',
      project: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating project:', error);

    res.status(500).json({
      error: 'Unable to create project',
    });
  }
});

module.exports = router;
