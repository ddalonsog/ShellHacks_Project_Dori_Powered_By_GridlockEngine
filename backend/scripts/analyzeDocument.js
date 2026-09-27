require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
  analyzeDocument
} = require('../src/ai/documentAnalyzer');


// ============================================================
// HELPERS
// ============================================================

function printUsage() {
  console.log('');
  console.log('Usage:');
  console.log('');
  console.log(
    '  node scripts/analyzeDocument.js <pdf-path>'
  );
  console.log('');
  console.log('Example:');
  console.log('');
  console.log(
    '  node scripts/analyzeDocument.js data/source/duke-2026-tysp.pdf'
  );
  console.log('');
}


function resolvePdfPath(inputPath) {
  if (!inputPath) {
    return null;
  }

  if (path.isAbsolute(inputPath)) {
    return path.normalize(inputPath);
  }

  /*
   * Relative paths are resolved from backend/,
   * not from scripts/.
   *
   * Example:
   *
   * data/source/fpl-2026-tysp.pdf
   *
   * becomes:
   *
   * backend/data/source/fpl-2026-tysp.pdf
   */

  return path.resolve(
    __dirname,
    '..',
    inputPath
  );
}


function getExtractionName(pdfPath) {
  const extension =
    path.extname(pdfPath);

  return path
    .basename(pdfPath, extension)
    .trim();
}


function getOutputPaths(pdfPath) {
  const extractionName =
    getExtractionName(pdfPath);

  const extractionDirectory =
    path.join(
      __dirname,
      '../data/extractions',
      extractionName
    );

  const rawOutputPath =
    path.join(
      extractionDirectory,
      'raw.json'
    );

  return {
    extractionName,
    extractionDirectory,
    rawOutputPath
  };
}


// ============================================================
// MAIN
// ============================================================

async function main() {

  /*
   * ----------------------------------------------------------
   * INPUT DOCUMENT
   * ----------------------------------------------------------
   *
   * The PDF is supplied from the command line.
   *
   * Example:
   *
   * node scripts/analyzeDocument.js \
   *   data/source/duke-2026-tysp.pdf
   */

  const inputArgument =
    process.argv[2];


  if (!inputArgument) {

    console.error('');
    console.error(
      'GRIDLOCK AI EXTRACTION FAILED'
    );

    console.error(
      '============================================================'
    );

    console.error(
      'No PDF path was provided.'
    );

    printUsage();

    process.exit(1);
  }


  const pdfPath =
    resolvePdfPath(
      inputArgument
    );


  if (!fs.existsSync(pdfPath)) {

    console.error('');
    console.error(
      'GRIDLOCK AI EXTRACTION FAILED'
    );

    console.error(
      '============================================================'
    );

    console.error(
      `PDF not found: ${pdfPath}`
    );

    printUsage();

    process.exit(1);
  }


  const extension =
    path.extname(pdfPath)
      .toLowerCase();


  if (extension !== '.pdf') {

    console.error('');
    console.error(
      'GRIDLOCK AI EXTRACTION FAILED'
    );

    console.error(
      '============================================================'
    );

    console.error(
      `Input file is not a PDF: ${pdfPath}`
    );

    process.exit(1);
  }


  /*
   * ----------------------------------------------------------
   * OUTPUT LOCATION
   * ----------------------------------------------------------
   *
   * Every source PDF gets its own extraction directory.
   *
   * Example:
   *
   * duke-2026-tysp.pdf
   *
   * ->
   *
   * data/extractions/duke-2026-tysp/raw.json
   */

  const {
    extractionName,
    extractionDirectory,
    rawOutputPath
  } = getOutputPaths(
    pdfPath
  );


  fs.mkdirSync(
    extractionDirectory,
    {
      recursive: true
    }
  );


  console.log('');

  console.log(
    'GRIDLOCK AI DOCUMENT EXTRACTION'
  );

  console.log(
    '============================================================'
  );

  console.log(
    `Source: ${pdfPath}`
  );

  console.log(
    `Extraction: ${extractionName}`
  );

  console.log(
    `Output: ${rawOutputPath}`
  );

  console.log('');


  const started =
    Date.now();


  /*
   * ----------------------------------------------------------
   * AI EXTRACTION
   * ----------------------------------------------------------
   */

  const result =
    await analyzeDocument(
      pdfPath
    );


  /*
   * ----------------------------------------------------------
   * STAGING OUTPUT
   * ----------------------------------------------------------
   */

  const output = {

    metadata: {

      generated_at:
        new Date().toISOString(),

      schema_version:
        '3.0',

      source_file:
        path.basename(pdfPath),

      source_path:
        pdfPath,

      extraction_name:
        extractionName,

      model:
        result.model,

      response_id:
        result.response_id,

      openai_file_id:
        result.file_id,

      usage:
        result.usage,

      estimated_cost:
        result.cost,

      validation_warnings:
        result.validation_warnings

    },

    ...result.data

  };


  /*
   * IMPORTANT:
   *
   * This remains a staging file.
   *
   * Nothing is imported into PostgreSQL automatically.
   */

  fs.writeFileSync(
    rawOutputPath,

    JSON.stringify(
      output,
      null,
      2
    ),

    'utf8'
  );


  const elapsedSeconds =
    (
      (
        Date.now() -
        started
      ) /
      1000
    ).toFixed(1);


  const projects =
    result.data.projects || [];


  const events =
    result.data.plan_events || [];


  const relationships =
    result.data.relationships || [];


  const sources =
    result.data.sources || [];


  const documentConflicts =
    result.data.document_conflicts || [];


  const unresolved =
    result.data.unresolved_items || [];


  const validationWarnings =
    result.validation_warnings || [];


  // ==========================================================
  // ENTITY TYPE COUNTS
  // ==========================================================

  const entityTypeCounts =
    projects.reduce(
      (
        counts,
        project
      ) => {

        const type =
          project.entity_type ||
          'unknown';


        counts[type] =
          (
            counts[type] ||
            0
          ) + 1;


        return counts;

      },
      {}
    );


  // ==========================================================
  // INFRASTRUCTURE TYPE COUNTS
  // ==========================================================

  const infrastructureTypeCounts =
    projects.reduce(
      (
        counts,
        project
      ) => {

        const type =
          project.infrastructure_type ||
          'unknown';


        counts[type] =
          (
            counts[type] ||
            0
          ) + 1;


        return counts;

      },
      {}
    );


  // ==========================================================
  // EVENT COUNTS
  // ==========================================================

  const eventTypeCounts =
    events.reduce(
      (
        counts,
        event
      ) => {

        const type =
          event.event_type ||
          'unknown';


        counts[type] =
          (
            counts[type] ||
            0
          ) + 1;


        return counts;

      },
      {}
    );


  // ==========================================================
  // CLAIMS / CONFLICTS
  // ==========================================================

  const totalClaims =
    projects.reduce(
      (
        total,
        project
      ) =>

        total +
        (
          project.claims?.length ||
          0
        ),

      0
    );


  const projectConflicts =
    projects.reduce(
      (
        total,
        project
      ) =>

        total +
        (
          project.conflicts?.length ||
          0
        ),

      0
    );


  // ==========================================================
  // LOCATION COVERAGE
  // ==========================================================

  let exactCoordinates = 0;
  let addressOnly = 0;
  let countyOnly = 0;
  let unknownLocation = 0;


  for (
    const project
    of projects
  ) {

    const location =
      project.location || {};


    if (
      location.latitude !== null &&
      location.latitude !== undefined &&
      location.longitude !== null &&
      location.longitude !== undefined
    ) {

      exactCoordinates++;

    }

    else if (
      location.address
    ) {

      addressOnly++;

    }

    else if (
      location.county
    ) {

      countyOnly++;

    }

    else {

      unknownLocation++;

    }

  }


  // ==========================================================
  // MAIN SUMMARY
  // ==========================================================

  console.log('');

  console.log(
    'AI EXTRACTION COMPLETE'
  );

  console.log(
    '============================================================'
  );


  console.log(
    `Entities:              ${projects.length}`
  );

  console.log(
    `Plan events:           ${events.length}`
  );

  console.log(
    `Relationships:         ${relationships.length}`
  );

  console.log(
    `Sources:               ${sources.length}`
  );

  console.log(
    `Claims:                ${totalClaims}`
  );

  console.log(
    `Project conflicts:     ${projectConflicts}`
  );

  console.log(
    `Document conflicts:    ${documentConflicts.length}`
  );

  console.log(
    `Unresolved items:      ${unresolved.length}`
  );

  console.log(
    `Validation warnings:   ${validationWarnings.length}`
  );


  // ==========================================================
  // ENTITY TYPES
  // ==========================================================

  console.log('');

  console.log(
    'ENTITY TYPES'
  );

  console.log(
    '------------------------------------------------------------'
  );


  for (
    const [
      type,
      count
    ]
    of Object.entries(
      entityTypeCounts
    )
  ) {

    console.log(
      `${type}: ${count}`
    );

  }


  // ==========================================================
  // INFRASTRUCTURE TYPES
  // ==========================================================

  console.log('');

  console.log(
    'INFRASTRUCTURE TYPES'
  );

  console.log(
    '------------------------------------------------------------'
  );


  for (
    const [
      type,
      count
    ]
    of Object.entries(
      infrastructureTypeCounts
    )
  ) {

    console.log(
      `${type}: ${count}`
    );

  }


  // ==========================================================
  // EVENT TYPES
  // ==========================================================

  console.log('');

  console.log(
    'PLAN EVENT TYPES'
  );

  console.log(
    '------------------------------------------------------------'
  );


  for (
    const [
      type,
      count
    ]
    of Object.entries(
      eventTypeCounts
    )
  ) {

    console.log(
      `${type}: ${count}`
    );

  }


  // ==========================================================
  // LOCATION COVERAGE
  // ==========================================================

  console.log('');

  console.log(
    'LOCATION COVERAGE'
  );

  console.log(
    '------------------------------------------------------------'
  );


  console.log(
    `Exact coordinates:     ${exactCoordinates}`
  );

  console.log(
    `Address only:          ${addressOnly}`
  );

  console.log(
    `County only:           ${countyOnly}`
  );

  console.log(
    `Unknown location:      ${unknownLocation}`
  );


  // ==========================================================
  // PROJECT CONFLICTS
  // ==========================================================

  console.log('');

  console.log(
    'CONFLICTS'
  );

  console.log(
    '------------------------------------------------------------'
  );


  if (
    projectConflicts === 0 &&
    documentConflicts.length === 0
  ) {

    console.log(
      'No explicit conflicts reported.'
    );

  }


  for (
    const project
    of projects
  ) {

    for (
      const conflict
      of project.conflicts || []
    ) {

      console.log(
        `⚠ ${project.canonical_name}`
      );

      console.log(
        `  Field: ${conflict.field}`
      );

      console.log(
        `  ${conflict.description}`
      );

      console.log(
        `  Status: ${conflict.resolution_status}`
      );

    }

  }


  for (
    const conflict
    of documentConflicts
  ) {

    console.log(
      `⚠ DOCUMENT: ${conflict.field}`
    );

    console.log(
      `  ${conflict.description}`
    );

    console.log(
      `  Status: ${conflict.resolution_status}`
    );

  }


  // ==========================================================
  // UNRESOLVED
  // ==========================================================

  console.log('');

  console.log(
    'UNRESOLVED ITEMS'
  );

  console.log(
    '------------------------------------------------------------'
  );


  if (
    unresolved.length === 0
  ) {

    console.log(
      'None.'
    );

  }

  else {

    for (
      const item
      of unresolved
    ) {

      console.log(
        `? ${item}`
      );

    }

  }


  // ==========================================================
  // LOCAL VALIDATION
  // ==========================================================

  console.log('');

  console.log(
    'LOCAL VALIDATION'
  );

  console.log(
    '------------------------------------------------------------'
  );


  if (
    validationWarnings.length === 0
  ) {

    console.log(
      '✓ No structural or semantic validation warnings.'
    );

  }

  else {

    for (
      const warning
      of validationWarnings
    ) {

      console.log(
        `⚠ ${warning}`
      );

    }

  }


  // ==========================================================
  // API USAGE
  // ==========================================================

  console.log('');

  console.log(
    'API USAGE'
  );

  console.log(
    '------------------------------------------------------------'
  );


  console.log(
    `Input tokens:          ${result.cost.input_tokens}`
  );

  console.log(
    `Output tokens:         ${result.cost.output_tokens}`
  );

  console.log(
    `Est. API cost:         $${result.cost.estimated_usd.toFixed(4)}`
  );

  console.log(
    `Long-context pricing:  ${
      result.cost.long_context_pricing
        ? 'yes'
        : 'no'
    }`
  );

  console.log(
    `Elapsed:               ${elapsedSeconds}s`
  );


  // ==========================================================
  // OUTPUT
  // ==========================================================

  console.log('');

  console.log(
    'OUTPUT'
  );

  console.log(
    '------------------------------------------------------------'
  );


  console.log(
    'Saved to:'
  );

  console.log(
    rawOutputPath
  );

  console.log('');


  console.log(
    'This script did NOT modify PostgreSQL.'
  );

  console.log(
    'Review raw.json before normalizing or importing anything.'
  );

  console.log('');

}


main().catch(
  error => {

    console.error('');

    console.error(
      'GRIDLOCK AI EXTRACTION FAILED'
    );

    console.error(
      '============================================================'
    );

    console.error(
      error
    );

    process.exit(1);

  }
);