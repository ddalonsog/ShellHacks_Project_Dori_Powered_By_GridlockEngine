require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

const dataPath = path.join(__dirname, '../data/projects.json');

const projects = JSON.parse(
  fs.readFileSync(dataPath, 'utf8')
);

console.log(`Found ${projects.length} projects to import.`);


async function importProjects() {
  try {

    for (const project of projects) {

      const utilityResult = await pool.query(
        'SELECT id FROM utilities WHERE name = $1',
        [project.utility]
      );

      if (utilityResult.rows.length === 0) {
        console.log(`Utility not found: ${project.utility}`);
        continue;
      }

      const utilityId = utilityResult.rows[0].id;

      await pool.query(
        `
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
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,

          CASE
            WHEN $14::double precision IS NOT NULL
             AND $15::double precision IS NOT NULL
            THEN ST_SetSRID(
              ST_MakePoint(
                $15::double precision,
                $14::double precision
              ),
              4326
            )
            ELSE NULL
          END,

          $16, $17, $18
        )
        ON CONFLICT (utility_id, title)
        DO NOTHING
        `,
        [
          utilityId,
          project.title,
          project.category,
          project.subtype,
          project.voltage_kv,
          project.capacity_mw,
          project.county,
          project.start_year,
          project.end_year,
          project.start_date,
          project.end_date,
          project.status,
          project.description,
          project.latitude,
          project.longitude,
          project.source_type,
          project.source_document,
          project.source_page
        ]
      );

      console.log(`Processed: ${project.title}`);
    }

  } catch (error) {
    console.error('Import failed:', error);

  } finally {
    await pool.end();
  }
}


importProjects();