require('dotenv').config();

const path = require('path');
const XLSX = require('xlsx');
const pool = require('../src/db');

async function main() {
  const excelPath = process.argv[2];

  if (!excelPath) {
    throw new Error(
      'Usage: node scripts/importOverlapProjects.js <xlsx-file>'
    );
  }

  const absolutePath = path.resolve(excelPath);

  console.log('\nGRIDLOCK PROJECT DATASET IMPORT');
  console.log('============================================================');
  console.log(`Source: ${absolutePath}`);

  const workbook = XLSX.readFile(absolutePath);

  if (!workbook.SheetNames.includes('projects')) {
    throw new Error('Workbook does not contain a "projects" sheet.');
  }

  // IMPORTANT:
  // We intentionally read ONLY "projects".
  // The "overlaps" sheet is ground truth and is NOT imported.
  const sheet = workbook.Sheets['projects'];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: false
  });

  console.log(`Projects found: ${rows.length}`);
  console.log('Ground-truth overlaps are NOT being imported.');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      let utilityName = row.utility;

      // Keep this dataset aligned with the existing DB utility.
      if (utilityName === 'Georgia Power') {
        utilityName = 'Georgia Power Company';
      }

      const state = row.state;

      const utilityResult = await client.query(
        `
        INSERT INTO utilities (
          name,
          state
        )
        VALUES ($1, $2)

        ON CONFLICT (name)
        DO UPDATE SET
          state = EXCLUDED.state

        RETURNING id;
        `,
        [utilityName, state]
      );

      const utilityId = utilityResult.rows[0].id;

      const latitude =
        row.lat_center !== null
          ? Number(row.lat_center)
          : null;

      const longitude =
        row.lon_center !== null
          ? Number(row.lon_center)
          : null;

      let inServiceDate = null;

      if (row.in_service_date) {
        const parsed = new Date(row.in_service_date);

        if (!Number.isNaN(parsed.getTime())) {
          inServiceDate = parsed;
        }
      }

      const startYear =
        inServiceDate
          ? inServiceDate.getFullYear()
          : null;

      await client.query(
        `
        INSERT INTO projects (
          utility_id,
          external_id,
          title,
          category,
          entity_type,
          infrastructure_type,
          state,
          start_year,
          start_date,
          status,
          ownership_visibility,
          geom,
          source_type,
          source_document,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          'transmission',
          'planned_asset',
          'transmission',
          $4,
          $5,
          $6,
          'planned',
          'public',

          CASE
            WHEN $7::double precision IS NOT NULL
             AND $8::double precision IS NOT NULL
            THEN ST_SetSRID(
              ST_MakePoint(
                $8::double precision,
                $7::double precision
              ),
              4326
            )
            ELSE NULL
          END,

          'validation_dataset',
          'Projects_Overlaps(2).xlsx',
          CURRENT_TIMESTAMP
        )

        ON CONFLICT (
          utility_id,
          external_id
        )
        DO UPDATE SET
          title = EXCLUDED.title,
          state = EXCLUDED.state,
          start_year = EXCLUDED.start_year,
          start_date = EXCLUDED.start_date,
          status = EXCLUDED.status,
          ownership_visibility = EXCLUDED.ownership_visibility,
          geom = EXCLUDED.geom,
          source_type = EXCLUDED.source_type,
          source_document = EXCLUDED.source_document,
          updated_at = CURRENT_TIMESTAMP;
        `,
        [
          utilityId,
          row.project_id,
          row.project_name,
          state,
          startYear,
          inServiceDate,
          latitude,
          longitude
        ]
      );

      console.log(
        `✓ ${row.project_id} | ${utilityName} | ${row.project_name}`
      );
    }

    await client.query('COMMIT');

    console.log('\n============================================================');
    console.log(`✓ Imported ${rows.length} project records.`);
    console.log('✓ No overlap relationships were imported.');
    console.log('✓ GridLock must discover conflicts independently.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('\nIMPORT FAILED');
  console.error(error);
  process.exit(1);
});