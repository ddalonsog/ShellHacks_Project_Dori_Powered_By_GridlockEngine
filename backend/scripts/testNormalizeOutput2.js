const fs = require('fs');
const path = require('path');

const {
  normalizeExtraction
} = require('../src/ai/normalizeExtraction');


/*
 * ============================================================
 * GRIDLOCK NORMALIZATION TEST
 * ============================================================
 *
 * This script:
 *
 * 1. Loads the current AI extraction.
 * 2. Runs normalizeExtraction().
 * 3. Reports derived timeline events.
 * 4. Reports removed duplicate events.
 * 5. Reports removed invalid relationships.
 * 6. Reports timeline/event coverage.
 * 7. Performs local structural/reference checks.
 * 8. Saves the normalized result separately.
 *
 * IMPORTANT:
 *
 * - No OpenAI API request is made.
 * - PostgreSQL is not modified.
 * - data/ai-projects.json is not modified.
 */


const INPUT_FILE = path.join(
  __dirname,
  '../data/ai-projects.json'
);

const OUTPUT_FILE = path.join(
  __dirname,
  '../data/ai-projects-normalized.json'
);


/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

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


function countEntityTypes(projects) {
  const counts = {};

  for (const project of projects || []) {
    const type =
      getEntityType(project);

    counts[type] =
      (counts[type] || 0) + 1;
  }

  return counts;
}


function printEntityTypes(projects) {
  console.log('');
  console.log('ENTITY TYPES');
  console.log('-'.repeat(60));

  const counts =
    countEntityTypes(projects);

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


function printSummaryValue(
  label,
  value
) {
  const padded =
    `${label}:`.padEnd(24);

  console.log(
    `${padded}${value}`
  );
}


function projectTitleById(
  projects,
  projectId
) {
  const project =
    (projects || []).find(
      item =>
        item?.project_id === projectId
    );

  return (
    project?.title ||
    projectId ||
    '(portfolio/document-level event)'
  );
}


/*
 * ============================================================
 * EVENT SCOPE HELPERS
 * ============================================================
 *
 * GridLock supports two broad event scopes:
 *
 * 1. Entity-level events
 *    These reference a specific project/entity through project_id.
 *
 * 2. Portfolio/document-level events
 *    These represent planning assumptions or changes that apply
 *    across a portfolio rather than to one specific entity.
 *
 * A missing project_id is therefore not automatically a structural
 * error.
 *
 * IMPORTANT:
 *
 * We do NOT infer a project_id for portfolio-level events.
 * Inventing an entity relationship would be worse than preserving
 * an explicitly document-level event.
 */

function hasProjectReference(event) {
  return (
    typeof event?.project_id === 'string' &&
    event.project_id.trim().length > 0
  );
}


function isPortfolioLevelEvent(event) {
  /*
   * Explicit scope metadata takes precedence if the extraction
   * schema provides it now or in the future.
   */
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
   * Current extraction compatibility:
   *
   * Some legitimate planning events, such as degradation
   * assumptions, may not belong to a single infrastructure
   * entity and therefore have no project_id.
   *
   * We preserve them instead of manufacturing a foreign key.
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


/*
 * ============================================================
 * MAIN
 * ============================================================
 */

function main() {
  console.log('');
  console.log(
    'GRIDLOCK NORMALIZATION TEST'
  );

  console.log(
    '='.repeat(60)
  );


  /*
   * ----------------------------------------------------------
   * LOAD CURRENT AI EXTRACTION
   * ----------------------------------------------------------
   */

  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(
      `Input file not found:\n${INPUT_FILE}`
    );
  }

  const raw =
    fs.readFileSync(
      INPUT_FILE,
      'utf8'
    );

  const original =
    JSON.parse(raw);


  /*
   * ----------------------------------------------------------
   * INPUT SUMMARY
   * ----------------------------------------------------------
   */

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


  /*
   * ----------------------------------------------------------
   * NORMALIZE
   * ----------------------------------------------------------
   */

  const normalized =
    normalizeExtraction(
      original
    );


  /*
   * ----------------------------------------------------------
   * NORMALIZATION RESULT COLLECTIONS
   * ----------------------------------------------------------
   */

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


  /*
   * ----------------------------------------------------------
   * NORMALIZED SUMMARY
   * ----------------------------------------------------------
   */

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


  /*
   * ----------------------------------------------------------
   * ENTITY TYPES
   * ----------------------------------------------------------
   */

  printEntityTypes(
    normalized.projects
  );


  /*
   * ----------------------------------------------------------
   * PLAN EVENT TYPES
   * ----------------------------------------------------------
   */

  printCounts(
    'FINAL PLAN EVENT TYPES',
    normalized.plan_events,
    'event_type'
  );


  /*
   * ----------------------------------------------------------
   * EVENT SCOPE SUMMARY
   * ----------------------------------------------------------
   */

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
  console.log(
    'EVENT SCOPE'
  );

  console.log(
    '-'.repeat(60)
  );

  printSummaryValue(
    'Entity-level events',
    entityEvents.length
  );

  printSummaryValue(
    'Portfolio-level events',
    portfolioEvents.length
  );


  /*
   * ----------------------------------------------------------
   * DERIVED EVENTS
   * ----------------------------------------------------------
   */

  console.log('');
  console.log(
    'DERIVED TIMELINE EVENTS'
  );

  console.log(
    '-'.repeat(60)
  );

  if (derivedEvents.length === 0) {
    console.log(
      'No additional events were derived from entity timelines.'
    );
  } else {
    for (const event of derivedEvents) {
      const title =
        projectTitleById(
          normalized.projects,
          event.project_id
        );

      console.log(
        `+ ${event.event_type} | ${title}`
      );

      console.log(
        `  Project ID: ${event.project_id}`
      );

      console.log(
        `  Date: ${event.effective_date}`
      );

      if (
        Array.isArray(event.source_ids) &&
        event.source_ids.length > 0
      ) {
        console.log(
          `  Sources: ${event.source_ids.join(', ')}`
        );
      }

      console.log('');
    }
  }


  /*
   * ----------------------------------------------------------
   * PORTFOLIO/DOCUMENT EVENTS
   * ----------------------------------------------------------
   */

  console.log('');
  console.log(
    'PORTFOLIO / DOCUMENT-LEVEL EVENTS'
  );

  console.log(
    '-'.repeat(60)
  );

  if (portfolioEvents.length === 0) {
    console.log(
      'No portfolio/document-level events detected.'
    );
  } else {
    for (const event of portfolioEvents) {
      console.log(
        `• ${event.event_type} | ${event.event_id}`
      );

      console.log(
        `  Date: ${event.effective_date || '(none)'}`
      );

      if (event.description) {
        console.log(
          `  Description: ${event.description}`
        );
      }

      console.log('');
    }
  }


  /*
   * ----------------------------------------------------------
   * REMOVED DUPLICATE EVENTS
   * ----------------------------------------------------------
   */

  console.log('');
  console.log(
    'REMOVED DUPLICATE EVENTS'
  );

  console.log(
    '-'.repeat(60)
  );

  if (
    removedDuplicateEvents.length === 0
  ) {
    console.log(
      '✓ No duplicate semantic events were removed.'
    );
  } else {
    for (
      const event
      of removedDuplicateEvents
    ) {
      const title =
        projectTitleById(
          normalized.projects,
          event.project_id
        );

      console.log(
        `✗ ${event.event_type} | ${title}`
      );

      console.log(
        `  Project ID: ${event.project_id}`
      );

      console.log(
        `  Date: ${event.effective_date}`
      );

      console.log(
        `  Reason: ${event.normalization_reason}`
      );

      console.log('');
    }
  }


  /*
   * ----------------------------------------------------------
   * REMOVED RELATIONSHIPS
   * ----------------------------------------------------------
   */

  console.log('');
  console.log(
    'REMOVED RELATIONSHIPS'
  );

  console.log(
    '-'.repeat(60)
  );

  if (
    removedRelationships.length === 0
  ) {
    console.log(
      '✓ No invalid relationships were removed.'
    );
  } else {
    for (
      const relationship
      of removedRelationships
    ) {
      console.log(
        `✗ ${relationship.from_project_id} -> ${relationship.to_project_id}`
      );

      console.log(
        `  Reason: ${relationship.normalization_reason}`
      );

      console.log('');
    }
  }


  /*
   * ----------------------------------------------------------
   * TIMELINE EVENT COVERAGE
   * ----------------------------------------------------------
   */

  console.log('');
  console.log(
    'TIMELINE EVENT COVERAGE'
  );

  console.log(
    '-'.repeat(60)
  );

  if (coverageWarnings.length === 0) {
    console.log(
      '✓ Every planning-relevant normalized timeline milestone has a corresponding plan event.'
    );
  } else {
    for (
      const warning
      of coverageWarnings
    ) {
      console.log(
        `⚠ ${warning}`
      );
    }
  }


  /*
   * ----------------------------------------------------------
   * NORMALIZATION NOTES
   * ----------------------------------------------------------
   */

  console.log('');
  console.log(
    'NORMALIZATION NOTES'
  );

  console.log(
    '-'.repeat(60)
  );

  if (
    normalizationNotes.length === 0
  ) {
    console.log(
      '(none)'
    );
  } else {
    for (
      const note
      of normalizationNotes
    ) {
      console.log(
        `• ${note}`
      );
    }
  }


  /*
   * ----------------------------------------------------------
   * BASIC REFERENTIAL CHECK
   * ----------------------------------------------------------
   *
   * This test intentionally does not depend on
   * documentAnalyzer.validateExtraction().
   *
   * Entity-level event references are checked as foreign keys.
   *
   * Portfolio/document-level events are allowed to omit
   * project_id because they do not refer to a single entity.
   */

  console.log('');
  console.log(
    'LOCAL STRUCTURAL CHECK'
  );

  console.log(
    '-'.repeat(60)
  );

  const structuralWarnings =
    runStructuralChecks(
      normalized
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


  /*
   * ----------------------------------------------------------
   * SAVE NORMALIZED RESULT
   * ----------------------------------------------------------
   */

  fs.writeFileSync(
    OUTPUT_FILE,

    JSON.stringify(
      normalized,
      null,
      2
    ),

    'utf8'
  );


  /*
   * ----------------------------------------------------------
   * FINAL OUTPUT
   * ----------------------------------------------------------
   */

  console.log('');
  console.log('OUTPUT');
  console.log('-'.repeat(60));

  console.log(
    `Saved normalized extraction to:\n${OUTPUT_FILE}`
  );

  console.log('');

  console.log(
    'No OpenAI API request was made.'
  );

  console.log(
    'PostgreSQL was not modified.'
  );

  console.log(
    'data/ai-projects.json was not modified.'
  );

  console.log('');
}


/*
 * ============================================================
 * LOCAL STRUCTURAL CHECKS
 * ============================================================
 */

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


  /*
   * ----------------------------------------------------------
   * PROJECT IDS
   * ----------------------------------------------------------
   */

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


  /*
   * ----------------------------------------------------------
   * PLAN EVENT REFERENCES
   * ----------------------------------------------------------
   *
   * project_id is required only for entity-level events.
   *
   * Portfolio/document-level events may legitimately omit it.
   */

  for (const event of events) {
    if (!hasProjectReference(event)) {
      if (isPortfolioLevelEvent(event)) {
        continue;
      }

      warnings.push(
        `Plan event ${event?.event_id || '(unknown event)'} has neither a valid project reference nor a recognizable portfolio/document scope.`
      );

      continue;
    }

    if (
      !projectIds.has(
        event.project_id
      )
    ) {
      warnings.push(
        `Plan event ${event?.event_id || '(unknown event)'} references unknown project ${event.project_id}.`
      );
    }
  }


  /*
   * ----------------------------------------------------------
   * RELATIONSHIP REFERENCES
   * ----------------------------------------------------------
   */

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


  /*
   * ----------------------------------------------------------
   * RELATED PROJECT REFERENCES
   * ----------------------------------------------------------
   */

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


  /*
   * ----------------------------------------------------------
   * EVENT IDS
   * ----------------------------------------------------------
   */

  const eventIds =
    new Set();

  for (const event of events) {
    const id =
      event?.event_id;

    if (!id) {
      warnings.push(
        `Plan event for ${event?.project_id || '(portfolio/document level)'} has no event_id.`
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


  /*
   * ----------------------------------------------------------
   * PORTFOLIO EVENT MINIMUM STRUCTURE
   * ----------------------------------------------------------
   *
   * If an event has no project reference, it still needs enough
   * identity to be useful:
   *
   * - event_id
   * - event_type
   *
   * effective_date may remain null because some document-level
   * assumptions may not have a precise date.
   */

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
        `Portfolio/document-level event ${event?.event_id || '(unknown event)'} has no event_type.`
      );
    }
  }


  return warnings;
}


/*
 * ============================================================
 * EXECUTION
 * ============================================================
 */

try {
  main();
} catch (error) {
  console.error('');

  console.error(
    'NORMALIZATION TEST FAILED'
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