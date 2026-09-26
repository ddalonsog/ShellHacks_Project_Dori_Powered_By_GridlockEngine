const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
	const radiusKm = Number(req.query.radiusKm ?? req.query.radius ?? 15);
	const minOverlapDays = Number(req.query.minOverlapDays ?? 30);
	const minOverlapPercent = req.query.minOverlapPercent === undefined
		? null
		: Number(req.query.minOverlapPercent);

	if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 1000) {
		return res.status(400).json({ error: 'radiusKm must be greater than 0 and at most 1000' });
	}
	if (!Number.isInteger(minOverlapDays) || minOverlapDays < 1) {
		return res.status(400).json({ error: 'minOverlapDays must be a positive integer' });
	}
	if (
		minOverlapPercent !== null &&
		(!Number.isFinite(minOverlapPercent) || minOverlapPercent < 0 || minOverlapPercent > 100)
	) {
		return res.status(400).json({ error: 'minOverlapPercent must be between 0 and 100' });
	}

	try {
		const result = await pool.query(
			`WITH candidate_conflicts AS (
				 SELECT
					 p1.id AS project1_id,
					 p1.title AS project1_title,
					 p1.category AS project1_category,
					 u1.id AS utility1_id,
					 u1.name AS utility1_name,
					 p2.id AS project2_id,
					 p2.title AS project2_title,
					 p2.category AS project2_category,
					 u2.id AS utility2_id,
					 u2.name AS utility2_name,
					 ROUND((ST_Distance(p1.geom::geography, p2.geom::geography) / 1000.0)::numeric, 2) AS distance_km,
					 GREATEST(p1.start_date, p2.start_date) AS overlap_start,
					 LEAST(p1.end_date, p2.end_date) AS overlap_end,
					 (p1.end_date - p1.start_date + 1) AS project1_duration_days,
					 (p2.end_date - p2.start_date + 1) AS project2_duration_days
				 FROM projects p1
				 JOIN projects p2
					 ON p1.utility_id <> p2.utility_id
					AND p1.id < p2.id
				 JOIN utilities u1 ON u1.id = p1.utility_id
				 JOIN utilities u2 ON u2.id = p2.utility_id
				 WHERE p1.ownership_visibility = 'public'
					 AND p2.ownership_visibility = 'public'
					 AND ST_DWithin(
						 p1.geom::geography,
						 p2.geom::geography,
						 $1 * 1000
					 )
					 AND p1.start_date <= p2.end_date
					 AND p1.end_date >= p2.start_date
			 ), scored_conflicts AS (
				 SELECT
					 *,
					 (overlap_end - overlap_start + 1) AS overlap_days,
					 ROUND(
						 (100.0 * (overlap_end - overlap_start + 1) / project1_duration_days)::numeric,
						 2
					 ) AS overlap_percent_project1,
					 ROUND(
						 (100.0 * (overlap_end - overlap_start + 1) / project2_duration_days)::numeric,
						 2
					 ) AS overlap_percent_project2
				 FROM candidate_conflicts
			 )
			 SELECT
				 project1_id,
				 project1_title,
				 project1_category,
				 utility1_id,
				 utility1_name,
				 project2_id,
				 project2_title,
				 project2_category,
				 utility2_id,
				 utility2_name,
				 distance_km,
				 overlap_start,
				 overlap_end,
				 overlap_days,
				 overlap_percent_project1,
				 overlap_percent_project2
			 FROM scored_conflicts
			 WHERE overlap_days >= $2
				 AND (
					 $3::numeric IS NULL
					 OR (
						 overlap_percent_project1 >= $3
						 AND overlap_percent_project2 >= $3
					 )
				 )
			 ORDER BY distance_km ASC, overlap_days DESC`,
			[radiusKm, minOverlapDays, minOverlapPercent]
		);

		res.json({
			criteria: { radiusKm, minOverlapDays, minOverlapPercent },
			conflicts: result.rows,
		});
	} catch (error) {
		console.error('Conflict lookup error:', error);
		res.status(500).json({ error: 'Failed to find project conflicts' });
	}
});

module.exports = router;
