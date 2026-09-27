const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = require('../src/db');

const DEFAULT_FILE = path.join(
  __dirname,
  '../data/enrichment/fpl-project-locations.json'
);

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/battery energy storage system center/g, '')
    .replace(/battery energy storage center/g, '')
    .replace(/solar energy center/g, '')
    .replace(/solar center/g, '')
    .replace(/\bbess\b/g, '')
    .replace(/\bsolar\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function resolveInput(arg) {
  if (!arg) return DEFAULT_FILE;
  return path.isAbsolute(arg)
    ? path.normalize(arg)
    : path.resolve(__dirname, '..', arg);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const fileArg = process.argv
    .slice(2)
    .find(arg => arg !== '--apply');

  const inputFile = resolveInput(fileArg);

  console.log('');
  console.log('GRIDLOCK FPL LOCATION ENRICHMENT');
  console.log('='.repeat(60));
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`File: ${inputFile}`);

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Enrichment file not found:\n${inputFile}`);
  }

  const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const utilityResult = await client.query(
      `SELECT id, name
       FROM utilities
       WHERE name = $1
       LIMIT 1`,
      [data.utility]
    );

    if (utilityResult.rowCount !== 1) {
      throw new Error(
        `Utility not found exactly once: ${data.utility}`
      );
    }

    const utility = utilityResult.rows[0];

    const projectsResult = await client.query(
      `SELECT id, external_id, title, county,
              ST_Y(geom) AS latitude,
              ST_X(geom) AS longitude
       FROM projects
       WHERE utility_id = $1
       ORDER BY id`,
      [utility.id]
    );

    const projects = projectsResult.rows;
    let matchedRows = 0;
    let unmatchedLocations = 0;

    console.log('');
    console.log(`Utility: ${utility.name}`);
    console.log(`Projects in DB: ${projects.length}`);
    console.log(`Location records: ${data.locations.length}`);
    console.log('');
    console.log('MATCHES');
    console.log('-'.repeat(60));

    for (const location of data.locations) {
      const target = normalizeName(location.match_name);

      const matches = projects.filter(project => {
        const title = normalizeName(project.title);
        const external = normalizeName(project.external_id);
        return title === target ||
               external === target ||
               title.includes(target) ||
               external.includes(target);
      });

      if (matches.length === 0) {
        unmatchedLocations++;
        console.log(`? ${location.match_name}: no DB match`);
        continue;
      }

      for (const project of matches) {
        matchedRows++;

        console.log(
          `${apply ? '✓' : '•'} ${location.match_name} -> ` +
          `${project.external_id || project.title} ` +
          `(${location.latitude}, ${location.longitude})`
        );

        if (apply) {
          await client.query(
            `UPDATE projects
             SET
               geom = ST_SetSRID(
                 ST_MakePoint($1, $2),
                 4326
               ),
               county = COALESCE(county, $3),
               updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [
              location.longitude,
              location.latitude,
              location.county || null,
              project.id
            ]
          );
        }
      }
    }

    console.log('');
    console.log('SUMMARY');
    console.log('-'.repeat(60));
    console.log(`Matched project rows: ${matchedRows}`);
    console.log(`Unmatched location records: ${unmatchedLocations}`);

    if (apply) {
      await client.query('COMMIT');
      console.log('');
      console.log('✓ LOCATION ENRICHMENT COMMITTED');
    } else {
      await client.query('ROLLBACK');
      console.log('');
      console.log('DRY RUN ONLY — PostgreSQL was not modified.');
      console.log('Run again with --apply after reviewing the matches.');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error('');
  console.error('GRIDLOCK LOCATION ENRICHMENT FAILED');
  console.error('='.repeat(60));
  console.error(error.stack || error.message);
  process.exit(1);
});
