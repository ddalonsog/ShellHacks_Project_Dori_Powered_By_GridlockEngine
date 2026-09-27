
const express = require('express');
const pool = require('../db');

const router = express.Router();


// ============================================================
// GET /api/conflicts
//
// Detects possible coordination opportunities between projects
// belonging to different utilities.
//
// A candidate must:
//
// 1. Belong to a different utility.
// 2. Have geographic coordinates.
// 3. Be within the requested geographic radius.
// 4. Have planning timelines that overlap or occur close enough
//    to one another.
//
// GridLock does not automatically claim that two projects must
// collaborate. This endpoint returns potential conflicts /
// coordination opportunities supported by spatial and temporal
// evidence.
// ============================================================

router.get('/', async (req, res) => {
  const radiusKm =
  Number(req.query.radiusKm ?? req.query.radius ?? 40.2336);

  const maxYearGap =
    Number(req.query.maxYearGap ?? 2);

  const minOverlapDays =
    Number(req.query.minOverlapDays ?? 1);


  // ----------------------------------------------------------
  // Validate query parameters
  // ----------------------------------------------------------

  if (
    !Number.isFinite(radiusKm) ||
    radiusKm <= 0 ||
    radiusKm > 1000
  ) {
    return res.status(400).json({
      error:
        'radiusKm must be greater than 0 and at most 1000'
    });
  }


  if (
    !Number.isInteger(maxYearGap) ||
    maxYearGap < 0 ||
    maxYearGap > 20
  ) {
    return res.status(400).json({
      error:
        'maxYearGap must be an integer between 0 and 20'
    });
  }


  if (
    !Number.isInteger(minOverlapDays) ||
    minOverlapDays < 1
  ) {
    return res.status(400).json({
      error:
        'minOverlapDays must be a positive integer'
    });
  }


  try {

    const result = await pool.query(
      `

      WITH project_windows AS (

        SELECT

          p.id,
          p.external_id,
          p.title,
          p.category,
          p.subtype,

          p.entity_type,
          p.infrastructure_type,
          p.technology,

          p.capacity_mw,
          p.voltage_kv,

          p.county,
          p.state,

          p.start_year,
          p.end_year,

          p.start_date,
          p.end_date,

          p.construction_start_text,
          p.commercial_service_text,

          p.status,

          p.geom,

          p.ownership_visibility,

          u.id AS utility_id,
          u.name AS utility_name,


          -- --------------------------------------------------
          -- Best available start date
          --
          -- Priority:
          -- exact project date
          -- construction year
          -- start year
          -- earliest plan event
          -- --------------------------------------------------

          COALESCE(

            p.start_date,

            CASE
              WHEN p.start_year IS NOT NULL
              THEN make_date(
                p.start_year,
                1,
                1
              )
            END,

            (
              SELECT MIN(
                CASE

                  WHEN pe.effective_date
                    ~ '^\\d{4}-\\d{2}-\\d{2}$'
                  THEN pe.effective_date::date

                  WHEN pe.effective_date
                    ~ '^\\d{4}-\\d{2}$'
                  THEN (
                    pe.effective_date ||
                    '-01'
                  )::date

                  WHEN pe.effective_date
                    ~ '^\\d{4}$'
                  THEN make_date(
                    pe.effective_date::int,
                    1,
                    1
                  )

                  ELSE NULL

                END
              )

              FROM plan_events pe

              WHERE
                pe.project_id = p.id
            )

          ) AS effective_start,


          -- --------------------------------------------------
          -- Best available end date
          --
          -- Priority:
          -- exact project end date
          -- end year
          -- commercial-service year
          -- latest plan event
          --
          -- For projects with only one known milestone,
          -- effective_end may equal effective_start later.
          -- --------------------------------------------------

          COALESCE(

            p.end_date,

            CASE
              WHEN p.end_year IS NOT NULL
              THEN make_date(
                p.end_year,
                12,
                31
              )
            END,

            (
              SELECT MAX(
                CASE

                  WHEN pe.effective_date
                    ~ '^\\d{4}-\\d{2}-\\d{2}$'
                  THEN pe.effective_date::date

                  WHEN pe.effective_date
                    ~ '^\\d{4}-\\d{2}$'
                  THEN (
                    pe.effective_date ||
                    '-01'
                  )::date

                  WHEN pe.effective_date
                    ~ '^\\d{4}$'
                  THEN make_date(
                    pe.effective_date::int,
                    12,
                    31
                  )

                  ELSE NULL

                END
              )

              FROM plan_events pe

              WHERE
                pe.project_id = p.id
            )

          ) AS effective_end


        FROM projects p

        JOIN utilities u
          ON u.id = p.utility_id

        WHERE

          p.geom IS NOT NULL

          AND p.ownership_visibility = 'public'

      ),


      normalized_windows AS (

        SELECT

          *,

          COALESCE(
            effective_start,
            effective_end
          ) AS window_start,

          COALESCE(
            effective_end,
            effective_start
          ) AS window_end

        FROM project_windows

      ),


      candidate_pairs AS (

        SELECT

          p1.id AS project1_id,
          p1.external_id AS project1_external_id,
          p1.title AS project1_title,
          p1.category AS project1_category,
          p1.subtype AS project1_subtype,

          p1.entity_type AS project1_entity_type,

          p1.infrastructure_type
            AS project1_infrastructure_type,

          p1.technology
            AS project1_technology,

          p1.capacity_mw
            AS project1_capacity_mw,

          p1.voltage_kv
            AS project1_voltage_kv,

          p1.county
            AS project1_county,

          p1.state
            AS project1_state,

          p1.utility_id
            AS utility1_id,

          p1.utility_name
            AS utility1_name,


          ST_Y(p1.geom)
            AS project1_latitude,

          ST_X(p1.geom)
            AS project1_longitude,


          p1.window_start
            AS project1_start,

          p1.window_end
            AS project1_end,


          p2.id AS project2_id,
          p2.external_id AS project2_external_id,
          p2.title AS project2_title,
          p2.category AS project2_category,
          p2.subtype AS project2_subtype,

          p2.entity_type AS project2_entity_type,

          p2.infrastructure_type
            AS project2_infrastructure_type,

          p2.technology
            AS project2_technology,

          p2.capacity_mw
            AS project2_capacity_mw,

          p2.voltage_kv
            AS project2_voltage_kv,

          p2.county
            AS project2_county,

          p2.state
            AS project2_state,

          p2.utility_id
            AS utility2_id,

          p2.utility_name
            AS utility2_name,


          ST_Y(p2.geom)
            AS project2_latitude,

          ST_X(p2.geom)
            AS project2_longitude,


          p2.window_start
            AS project2_start,

          p2.window_end
            AS project2_end,


          ROUND(

            (
              ST_Distance(
                p1.geom::geography,
                p2.geom::geography
              ) / 1000.0
            )::numeric,

            2

          ) AS distance_km,


          ROUND(

            (
              ST_Distance(
                p1.geom::geography,
                p2.geom::geography
              ) / 1609.344
            )::numeric,

            2

          ) AS distance_miles


        FROM normalized_windows p1

        JOIN normalized_windows p2

          ON p1.utility_id <> p2.utility_id

          AND p1.id < p2.id


        WHERE

          ST_DWithin(
  			p1.geom::geography,
  			p2.geom::geography,
  			$1::double precision * 1000.0
			)

      ),


      temporal_analysis AS (

        SELECT

          *,

          CASE

            WHEN
              project1_start IS NOT NULL
              AND project1_end IS NOT NULL
              AND project2_start IS NOT NULL
              AND project2_end IS NOT NULL

              AND project1_start <= project2_end
              AND project1_end >= project2_start

            THEN TRUE

            ELSE FALSE

          END AS timelines_overlap,


          CASE

            WHEN
              project1_start IS NULL
              OR project2_start IS NULL

            THEN NULL


            ELSE ABS(

              EXTRACT(
                YEAR FROM project1_start
              )

              -

              EXTRACT(
                YEAR FROM project2_start
              )

            )::int

          END AS start_year_gap,


          CASE

            WHEN
              project1_start IS NOT NULL
              AND project1_end IS NOT NULL
              AND project2_start IS NOT NULL
              AND project2_end IS NOT NULL

              AND project1_start <= project2_end
              AND project1_end >= project2_start

            THEN

              LEAST(
                project1_end,
                project2_end
              )

              -

              GREATEST(
                project1_start,
                project2_start
              )

              + 1

            ELSE 0

          END AS overlap_days


        FROM candidate_pairs

      )


      SELECT

        *,

        CASE

          WHEN timelines_overlap
          THEN 'overlapping'

          WHEN start_year_gap <= $2
          THEN 'near_term'

          ELSE 'outside_window'

        END AS temporal_relationship,


        CASE

          WHEN
            project1_infrastructure_type =
            project2_infrastructure_type

          THEN TRUE

          WHEN
            (
              project1_infrastructure_type = 'generation'
              AND
              project2_infrastructure_type = 'storage'
            )

            OR

            (
              project1_infrastructure_type = 'storage'
              AND
              project2_infrastructure_type = 'generation'
            )

          THEN TRUE

          ELSE FALSE

        END AS infrastructure_compatible


      FROM temporal_analysis


      WHERE

        (

          (
            timelines_overlap = TRUE
            AND overlap_days >= $3
          )

          OR

          (
            timelines_overlap = FALSE
            AND start_year_gap IS NOT NULL
            AND start_year_gap <= $2
          )

        )


      ORDER BY

        distance_km ASC,

        timelines_overlap DESC,

        overlap_days DESC,

        start_year_gap ASC

      `,

      [
        radiusKm,
        maxYearGap,
        minOverlapDays
      ]

    );


    // --------------------------------------------------------
    // Add human-readable evidence.
    // This does not alter the database.
    // --------------------------------------------------------

    const conflicts = result.rows.map(row => {

      const reasons = [];


      reasons.push(
        `Projects are ${row.distance_km} km ` +
        `(${row.distance_miles} miles) apart.`
      );


      if (row.timelines_overlap) {

        reasons.push(
          `Project timelines overlap for ` +
          `${row.overlap_days} day(s).`
        );

      } else if (row.start_year_gap !== null) {

        reasons.push(
          `Project start timelines are ` +
          `${row.start_year_gap} year(s) apart.`
        );

      }


      if (row.infrastructure_compatible) {

        reasons.push(
          'The projects involve compatible infrastructure types.'
        );

      }


      return {
        ...row,

        reasons
      };

    });


    res.json({

      criteria: {

        radiusKm,
        maxYearGap,
        minOverlapDays

      },

      count: conflicts.length,

      conflicts

    });


  } catch (error) {

    console.error(
      'Conflict lookup error:',
      error
    );

    res.status(500).json({
      error:
        'Failed to find project conflicts'
    });

  }
});


module.exports = router;
