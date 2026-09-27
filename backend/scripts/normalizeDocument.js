const fs = require('fs');
const path = require('path');

const {
  normalizeExtraction
} = require('../src/ai/normalizeExtraction');


// ============================================================
// HELPERS
// ============================================================

function printUsage() {
  console.log('');
  console.log('Usage:');
  console.log('');
  console.log(
    '  node scripts/normalizeDocument.js <raw-json-path>'
  );
  console.log('');
  console.log('Example:');
  console.log('');
  console.log(
    '  node scripts/normalizeDocument.js data/extractions/duke-2026-tysp/raw.json'
  );
  console.log('');
}


function resolveInputPath(inputPath) {
  if (!inputPath) {
    return null;
  }

  if (path.isAbsolute(inputPath)) {
    return path.normalize(inputPath);
  }

  // Resolve relative paths from backend/
  return path.resolve(
    __dirname,
    '..',
    inputPath
  );
}


function getOutputPath(inputPath) {
  /*
   * Expected structure:
   *
   * data/extractions/<document>/raw.json
   *
   * Output:
   *
   * data/extractions/<document>/normalized.json
   */

  return path.join(
    path.dirname(inputPath),
    'normalized.json'
  );
}


function printSummaryValue(label, value) {
  const padded =
    `${label}:`.padEnd(26);

  console.log(
    `${padded}${value}`
  );
}


function countBy(items, field) {
  const counts = {};

  for (const item of items || []) {
    const value =
      item?.[field] ??
      'unknown';

    counts[value] =
      (counts[value] || 0) + 1;
  }

  return counts;
}


function printCounts(
  title,
  items,
  field
) {
  console.log('');
  console.log(title);
  console.log('-'.repeat(60));

  const counts =
    countBy(items, field);

  const entries =
    Object.entries(counts);

  if (entries.length === 0) {
    console.log('(none)');
    return;
  }

  for (const [value, count] of entries) {
    console.log(
      `${value}: ${count}`
    );
  }
}


function getEntityType(project) {
  return (
    project?.entity_type ??
    project?.record_type ??
    'unknown'
  );
}


function printEntityTypes(projects) {
  const counts = {};

  for (const project of projects || []) {
    const type =
      getEntityType(project);

    counts[type] =
      (counts[type] || 0) + 1;
  }

  console.log('');
  console.log('ENTITY TYPES');
  console.log('-'.repeat(60));

  const entries =
    Object.entries(counts);

  if (entries.length === 0) {
    console.log('(none)');
    return;
  }

  for (const [type, count] of entries) {
    console.log(
      `${type}: ${count}`
    );
  }
}


function hasProjectReference(event) {
  return (
    typeof event?.project_id === 'string' &&
    event.project_id.trim().length > 0
  );
}


function isPortfolioLevelEvent(event) {
  const explicitScope =
    String(
      event?.scope ||
      event?.event_scope ||
      ''
    )
      .trim()
      .toLowerCase();

  if (
    explicitScope === 'portfolio' ||
    explicitScope === 'document' ||
    explicitScope === 'system' ||
    explicitScope === 'fleet'
  ) {
    return true;
  }

  /*
   * Compatibility with the current extraction format.
   *
   * A legitimate document/portfolio event can omit project_id.
   * We preserve it rather than inventing a project reference.
   */

  if (
    !hasProjectReference(event) &&
    typeof event?.event_type === 'string' &&
    event.event_type.trim().length > 0 &&
    typeof event?.event_id === 'string' &&
    event.event_id.trim().length > 0
  ) {
    return true;
  }

  return false;
}


function runStructuralChecks(data) {
  const warnings = [];

  const projects =
    Array.isArray(data.projects)
      ? data.projects
      : [];

  const events =
    Array.isArray(data.plan_events)
      ? data.plan_events
      : [];

  const relationships =
    Array.isArray(data.relationships)
      ? data.relationships
      : [];


  // ----------------------------------------------------------
  // PROJECT IDS
  // ----------------------------------------------------------

  const projectIds =
    new Set();

  for (const project of projects) {
    const id =
      project?.project_id;

    if (!id) {
      warnings.push(
        'Project/entity exists without project_id.'
      );

      continue;
    }

    if (projectIds.has(id)) {
      warnings.push(
        `Duplicate project_id: ${id}`
      );
    }

    projectIds.add(id);
  }


  // ----------------------------------------------------------
  // PLAN EVENT REFERENCES
  // ----------------------------------------------------------

  for (const event of events) {
    if (!hasProjectReference(event)) {
      if (isPortfolioLevelEvent(event)) {
        continue;
      }

      warnings.push(
        `Plan event ${
          event?.event_id ||
          '(unknown event)'
        } has neither a valid project reference nor a recognizable portfolio/document scope.`
      );

      continue;
    }

    if (
      !projectIds.has(
        event.project_id
      )
    ) {
      warnings.push(
        `Plan event ${
          event?.event_id ||
          '(unknown event)'
        } references unknown project ${event.project_id}.`
      );
    }
  }


  // ----------------------------------------------------------
  // RELATIONSHIP REFERENCES
  // ----------------------------------------------------------

  for (
    const relationship
    of relationships
  ) {
    if (
      !projectIds.has(
        relationship?.from_project_id
      )
    ) {
      warnings.push(
        `Relationship references unknown source project ${relationship?.from_project_id}.`
      );
    }

    if (
      !projectIds.has(
        relationship?.to_project_id
      )
    ) {
      warnings.push(
        `Relationship references unknown target project ${relationship?.to_project_id}.`
      );
    }
  }


  // ----------------------------------------------------------
  // RELATED PROJECT REFERENCES
  // ----------------------------------------------------------

  for (const project of projects) {
    if (
      !Array.isArray(
        project.related_project_ids
      )
    ) {
      continue;
    }

    for (
      const relatedId
      of project.related_project_ids
    ) {
      if (
        !projectIds.has(
          relatedId
        )
      ) {
        warnings.push(
          `${project.project_id} references unknown related project ${relatedId}.`
        );
      }
    }
  }


  // ----------------------------------------------------------
  // EVENT IDS
  // ----------------------------------------------------------

  const eventIds =
    new Set();

  for (const event of events) {
    const id =
      event?.event_id;

    if (!id) {
      warnings.push(
        `Plan event for ${
          event?.project_id ||
          '(portfolio/document level)'
        } has no event_id.`
      );

      continue;
    }

    if (eventIds.has(id)) {
      warnings.push(
        `Duplicate event_id: ${id}`
      );
    }

    eventIds.add(id);
  }


  // ----------------------------------------------------------
  // PORTFOLIO EVENT MINIMUM STRUCTURE
  // ----------------------------------------------------------

  for (const event of events) {
    if (hasProjectReference(event)) {
      continue;
    }

    if (!isPortfolioLevelEvent(event)) {
      continue;
    }

    if (
      typeof event?.event_type !== 'string' ||
      event.event_type.trim().length === 0
    ) {
      warnings.push(
        `Portfolio/document-level event ${
          event?.event_id ||
          '(unknown event)'
        } has no event_type.`
      );
    }
  }

  return warnings;
}


// ============================================================
// MAIN
// ============================================================

function main() {

  const inputArgument =
    process.argv[2];


  if (!inputArgument) {
    console.error('');
    console.error(
      'GRIDLOCK NORMALIZATION FAILED'
    );
    console.error(
      '='.repeat(60)
    );
    console.error(
      'No raw extraction JSON path was provided.'
    );

    printUsage();

    process.exit(1);
  }


  const inputFile =
    resolveInputPath(
      inputArgument
    );


  if (!fs.existsSync(inputFile)) {
    throw new Error(
      `Input file not found:\n${inputFile}`
    );
  }


  if (
    path.extname(inputFile)
      .toLowerCase() !== '.json'
  ) {
    throw new Error(
      `Input file must be JSON:\n${inputFile}`
    );
  }


  const outputFile =
    getOutputPath(
      inputFile
    );


  console.log('');
  console.log(
    'GRIDLOCK DOCUMENT NORMALIZATION'
  );
  console.log(
    '='.repeat(60)
  );

  console.log('');
  console.log(
    `Input:  ${inputFile}`
  );

  console.log(
    `Output: ${outputFile}`
  );


  // ----------------------------------------------------------
  // LOAD RAW EXTRACTION
  // ----------------------------------------------------------

  const raw =
    fs.readFileSync(
      inputFile,
      'utf8'
    );

  const original =
    JSON.parse(raw);


  console.log('');
  console.log('INPUT');
  console.log('-'.repeat(60));

  printSummaryValue(
    'Projects',
    original.projects?.length || 0
  );

  printSummaryValue(
    'Plan events',
    original.plan_events?.length || 0
  );

  printSummaryValue(
    'Relationships',
    original.relationships?.length || 0
  );

  printSummaryValue(
    'Sources',
    original.sources?.length || 0
  );

  printSummaryValue(
    'Claims',
    original.claims?.length || 0
  );


  // ----------------------------------------------------------
  // NORMALIZE
  // ----------------------------------------------------------

  const normalized =
    normalizeExtraction(
      original
    );


  const derivedEvents =
    normalized.derived_plan_events || [];

  const removedDuplicateEvents =
    normalized.removed_duplicate_events || [];

  const removedRelationships =
    normalized.removed_relationships || [];

  const coverageWarnings =
    normalized.event_coverage_warnings || [];

  const normalizationNotes =
    normalized.normalization_notes || [];


  // ----------------------------------------------------------
  // OUTPUT SUMMARY
  // ----------------------------------------------------------

  console.log('');
  console.log(
    'NORMALIZED OUTPUT'
  );
  console.log(
    '-'.repeat(60)
  );

  printSummaryValue(
    'Projects',
    normalized.projects?.length || 0
  );

  printSummaryValue(
    'Plan events',
    normalized.plan_events?.length || 0
  );

  printSummaryValue(
    'Derived events',
    derivedEvents.length
  );

  printSummaryValue(
    'Removed duplicates',
    removedDuplicateEvents.length
  );

  printSummaryValue(
    'Relationships',
    normalized.relationships?.length || 0
  );

  printSummaryValue(
    'Removed relationships',
    removedRelationships.length
  );

  printSummaryValue(
    'Sources',
    normalized.sources?.length || 0
  );

  printSummaryValue(
    'Claims',
    normalized.claims?.length || 0
  );

  printSummaryValue(
    'Coverage warnings',
    coverageWarnings.length
  );


  printEntityTypes(
    normalized.projects
  );


  printCounts(
    'FINAL PLAN EVENT TYPES',
    normalized.plan_events,
    'event_type'
  );


  // ----------------------------------------------------------
  // EVENT SCOPE
  // ----------------------------------------------------------

  const entityEvents =
    (normalized.plan_events || [])
      .filter(
        event =>
          hasProjectReference(event)
      );

  const portfolioEvents =
    (normalized.plan_events || [])
      .filter(
        event =>
          !hasProjectReference(event) &&
          isPortfolioLevelEvent(event)
      );


  console.log('');
  console.log('EVENT SCOPE');
  console.log('-'.repeat(60));

  printSummaryValue(
    'Entity-level events',
    entityEvents.length
  );

  printSummaryValue(
    'Portfolio-level events',
    portfolioEvents.length
  );


  // ----------------------------------------------------------
  // NORMALIZATION CHANGES
  // ----------------------------------------------------------

  console.log('');
  console.log(
    'NORMALIZATION CHANGES'
  );
  console.log(
    '-'.repeat(60)
  );

  printSummaryValue(
    'Derived events',
    derivedEvents.length
  );

  printSummaryValue(
    'Removed duplicate events',
    removedDuplicateEvents.length
  );

  printSummaryValue(
    'Removed relationships',
    removedRelationships.length
  );

  printSummaryValue(
    'Coverage warnings',
    coverageWarnings.length
  );


  if (normalizationNotes.length > 0) {
    console.log('');

    for (
      const note
      of normalizationNotes
    ) {
      console.log(
        `• ${note}`
      );
    }
  }


  // ----------------------------------------------------------
  // STRUCTURAL CHECK
  // ----------------------------------------------------------

  const structuralWarnings =
    runStructuralChecks(
      normalized
    );


  console.log('');
  console.log(
    'LOCAL STRUCTURAL CHECK'
  );
  console.log(
    '-'.repeat(60)
  );


  if (
    structuralWarnings.length === 0
  ) {
    console.log(
      '✓ No structural reference problems detected.'
    );
  } else {
    for (
      const warning
      of structuralWarnings
    ) {
      console.log(
        `⚠ ${warning}`
      );
    }
  }


  printSummaryValue(
    'Structural warnings',
    structuralWarnings.length
  );


  // ----------------------------------------------------------
  // SAVE
  // ----------------------------------------------------------

  fs.writeFileSync(
    outputFile,

    JSON.stringify(
      normalized,
      null,
      2
    ),

    'utf8'
  );


  console.log('');
  console.log('OUTPUT');
  console.log('-'.repeat(60));

  console.log(
    `Saved normalized extraction to:\n${outputFile}`
  );

  console.log('');
  console.log(
    'No OpenAI API request was made.'
  );

  console.log(
    'PostgreSQL was not modified.'
  );

  console.log('');
}


// ============================================================
// EXECUTION
// ============================================================

try {
  main();
} catch (error) {
  console.error('');

  console.error(
    'GRIDLOCK NORMALIZATION FAILED'
  );

  console.error(
    '='.repeat(60)
  );

  console.error(
    error.stack ||
    error.message
  );

  process.exit(1);
}