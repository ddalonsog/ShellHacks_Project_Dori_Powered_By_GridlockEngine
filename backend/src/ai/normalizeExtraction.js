/*
 * ============================================================
 * GRIDLOCK SEMANTIC NORMALIZER
 * ============================================================
 *
 * This layer enforces GENERAL GridLock data invariants after
 * AI extraction.
 *
 * IMPORTANT:
 *
 * Do not add:
 * - utility names
 * - project names
 * - schedule numbers
 * - known MW values
 * - page-specific hacks
 *
 * Everything here must remain utility-agnostic.
 */

function normalizeExtraction(input) {
  if (!input || typeof input !== 'object') {
    return input;
  }

  const data = structuredClone(input);

  ensureNormalizationContainers(data);

  /*
   * ORDER MATTERS:
   *
   * 1. Clear normalized values affected by unresolved conflicts.
   * 2. Derive deterministic events only from values that survived.
   * 3. Deduplicate AI + derived events.
   * 4. Normalize references.
   * 5. Audit timeline/event consistency.
   */
  normalizeUnresolvedConflicts(data);

  deriveTimelineEvents(data);

  deduplicatePlanEvents(data);

  normalizeRelationships(data);

  normalizeRelatedProjectIds(data);

  inspectDuplicateProjectIds(data);

  auditTimelineEventCoverage(data);

  return data;
}


/*
 * ============================================================
 * CONTAINERS
 * ============================================================
 */

function ensureNormalizationContainers(data) {
  if (!Array.isArray(data.normalization_notes)) {
    data.normalization_notes = [];
  }

  if (!Array.isArray(data.removed_relationships)) {
    data.removed_relationships = [];
  }

  if (!Array.isArray(data.plan_events)) {
    data.plan_events = [];
  }

  if (!Array.isArray(data.derived_plan_events)) {
    data.derived_plan_events = [];
  }

  if (!Array.isArray(data.removed_duplicate_events)) {
    data.removed_duplicate_events = [];
  }

  if (!Array.isArray(data.event_coverage_warnings)) {
    data.event_coverage_warnings = [];
  }
}


/*
 * ============================================================
 * UNRESOLVED CONFLICTS
 * ============================================================
 *
 * If a normalized field is explicitly affected by an unresolved
 * conflict, GridLock must not expose that normalized value as
 * authoritative.
 *
 * Clear ONLY the affected field.
 */

function normalizeUnresolvedConflicts(data) {
  if (!Array.isArray(data.projects)) {
    return;
  }

  for (const project of data.projects) {
    if (!Array.isArray(project.conflicts)) {
      continue;
    }

    for (const conflict of project.conflicts) {
      if (conflict?.resolution_status !== 'unresolved') {
        continue;
      }

      const field =
        normalizeFieldName(conflict.field);

      /*
       * NAMEPLATE
       */

      if (
        mentionsNameplate(field) &&
        project.capacity
      ) {
        project.capacity.nameplate_mw = null;

        addWarning(
          project,
          'Normalized nameplate capacity cleared because supporting evidence has an unresolved conflict.'
        );
      }

      /*
       * SUMMER
       */

      if (
        mentionsSummer(field) &&
        project.capacity
      ) {
        project.capacity.summer_mw = null;

        addWarning(
          project,
          'Normalized summer capacity cleared because supporting evidence has an unresolved conflict.'
        );
      }

      /*
       * WINTER
       */

      if (
        mentionsWinter(field) &&
        project.capacity
      ) {
        project.capacity.winter_mw = null;

        addWarning(
          project,
          'Normalized winter capacity cleared because supporting evidence has an unresolved conflict.'
        );
      }

      /*
       * GENERIC CAPACITY CONFLICT
       *
       * Generic capacity conflicts are too broad to destroy
       * independently supported nameplate values.
       *
       * Seasonal normalized values are cleared.
       */

      if (
        isGenericCapacityConflict(field) &&
        project.capacity
      ) {
        project.capacity.summer_mw = null;
        project.capacity.winter_mw = null;

        addWarning(
          project,
          'Normalized seasonal capacities cleared because capacity evidence has an unresolved conflict.'
        );
      }

      /*
       * STORAGE ENERGY
       */

      if (
        mentionsStorageEnergy(field) &&
        project.capacity
      ) {
        project.capacity.storage_mwh = null;

        addWarning(
          project,
          'Normalized storage energy cleared because supporting evidence has an unresolved conflict.'
        );
      }

      /*
       * INTERCONNECTION STATION
       */

      if (
        mentionsInterconnectionStation(field) &&
        project.interconnection
      ) {
        project.interconnection.station = null;

        addWarning(
          project,
          'Normalized interconnection station cleared because supporting evidence has an unresolved conflict.'
        );
      }

      /*
       * VOLTAGE
       */

      if (
        mentionsVoltage(field) &&
        project.interconnection
      ) {
        project.interconnection.voltage_kv = null;

        addWarning(
          project,
          'Normalized interconnection voltage cleared because supporting evidence has an unresolved conflict.'
        );
      }

      /*
       * LINE LENGTH
       */

      if (
        mentionsLineLength(field) &&
        project.interconnection
      ) {
        project.interconnection.line_length_miles = null;

        addWarning(
          project,
          'Normalized line length cleared because supporting evidence has an unresolved conflict.'
        );
      }

      /*
       * ACREAGE
       */

      if (mentionsAcreage(field)) {
        project.acreage = null;

        addWarning(
          project,
          'Normalized acreage cleared because supporting evidence has an unresolved conflict.'
        );
      }

      /*
       * DATES
       */

      if (
        mentionsConstructionStart(field) &&
        project.timeline
      ) {
        project.timeline.construction_start = null;

        addWarning(
          project,
          'Normalized construction-start date cleared because supporting evidence has an unresolved conflict.'
        );
      }

      if (
        mentionsCommercialService(field) &&
        project.timeline
      ) {
        project.timeline.commercial_service = null;

        addWarning(
          project,
          'Normalized commercial-service date cleared because supporting evidence has an unresolved conflict.'
        );
      }

      if (
        mentionsRetirement(field) &&
        project.timeline
      ) {
        project.timeline.retirement_date = null;

        addWarning(
          project,
          'Normalized retirement date cleared because supporting evidence has an unresolved conflict.'
        );
      }
    }
  }
}


/*
 * ============================================================
 * DERIVE PLAN EVENTS FROM NORMALIZED TIMELINES
 * ============================================================
 *
 * The LLM extracts facts.
 *
 * Node deterministically materializes timeline milestones as
 * events when those milestones belong to the planning context.
 *
 * General mapping:
 *
 * timeline.construction_start
 *     -> construction_start
 *
 * timeline.commercial_service
 *     -> commercial_service
 *
 * timeline.retirement_date
 *     -> retirement
 *
 * There are two semantic exceptions:
 *
 * 1. HISTORICAL COMMERCIAL SERVICE
 *
 * A commercial-service date before the beginning of the planning
 * period is historical asset metadata. It remains in the entity's
 * timeline, but is NOT automatically converted into a plan event.
 *
 * 2. CONTRACT RETIREMENT FIELD
 *
 * A contract is not a physical infrastructure asset. Therefore a
 * retirement_date stored on a contract must not automatically be
 * interpreted as physical retirement.
 *
 * The source extraction may separately contain the semantically
 * correct contract_expiration event. We preserve that event and
 * preserve the timeline date, but do not manufacture a retirement
 * event from it.
 *
 * Construction starts are intentionally not filtered simply
 * because they predate the planning period. Construction can begin
 * before the horizon for a project entering service inside it.
 */

function deriveTimelineEvents(data) {
  if (!Array.isArray(data.projects)) {
    return;
  }

  let derivedCount = 0;

  let skippedHistoricalCommercialService = 0;

  let skippedContractRetirement = 0;

  const planningStartYear =
    getPlanningStartYear(data);

  for (const project of data.projects) {
    const projectId =
      project?.project_id;

    const timeline =
      project?.timeline;

    if (!projectId || !timeline) {
      continue;
    }

    const sourceIds =
      collectProjectSourceIds(project);

    const candidates = [
      {
        eventType:
          'construction_start',

        date:
          timeline.construction_start
      },
      {
        eventType:
          'commercial_service',

        date:
          timeline.commercial_service
      },
      {
        eventType:
          'retirement',

        date:
          timeline.retirement_date
      }
    ];

    for (const candidate of candidates) {
      if (!hasUsableDate(candidate.date)) {
        continue;
      }

      /*
       * --------------------------------------------------------
       * HISTORICAL COMMERCIAL SERVICE
       * --------------------------------------------------------
       *
       * Keep the timeline value.
       * Do not automatically create a planning event.
       */

      if (
        candidate.eventType ===
          'commercial_service' &&
        shouldSkipHistoricalCommercialService({
          effectiveDate:
            candidate.date,

          planningStartYear
        })
      ) {
        skippedHistoricalCommercialService++;

        continue;
      }


      /*
       * --------------------------------------------------------
       * CONTRACT RETIREMENT
       * --------------------------------------------------------
       *
       * A contract's timeline.retirement_date must not be
       * interpreted automatically as physical retirement.
       *
       * The timeline value remains untouched.
       *
       * Any explicitly extracted contract_expiration event remains
       * untouched.
       */

      if (
        candidate.eventType ===
          'retirement' &&
        shouldSkipContractRetirement({
          project
        })
      ) {
        skippedContractRetirement++;

        continue;
      }


      /*
       * --------------------------------------------------------
       * EXISTING EVENT
       * --------------------------------------------------------
       *
       * If AI already created the equivalent event, do not derive
       * another copy.
       */

      if (
        findEquivalentEvent(
          data.plan_events,
          projectId,
          candidate.eventType,
          candidate.date
        )
      ) {
        continue;
      }


      /*
       * --------------------------------------------------------
       * DERIVE EVENT
       * --------------------------------------------------------
       */

      const derived =
        createDerivedTimelineEvent({
          project,
          eventType:
            candidate.eventType,
          effectiveDate:
            candidate.date,
          sourceIds
        });

      data.plan_events.push(
        derived
      );

      data.derived_plan_events.push(
        structuredClone(derived)
      );

      derivedCount++;
    }
  }


  /*
   * ----------------------------------------------------------
   * NORMALIZATION NOTES
   * ----------------------------------------------------------
   */

  if (derivedCount > 0) {
    addNormalizationNote(
      data,
      `Derived ${derivedCount} plan event(s) from normalized entity timeline fields.`
    );
  }

  if (
    skippedHistoricalCommercialService > 0
  ) {
    addNormalizationNote(
      data,
      `Skipped ${skippedHistoricalCommercialService} historical commercial-service milestone(s) that predate the document planning period.`
    );
  }

  if (
    skippedContractRetirement > 0
  ) {
    addNormalizationNote(
      data,
      `Skipped ${skippedContractRetirement} contract retirement milestone(s) because contract timeline dates must not be automatically interpreted as physical asset retirements.`
    );
  }
}


/*
 * ============================================================
 * PLANNING PERIOD HELPERS
 * ============================================================
 *
 * These helpers intentionally use document metadata rather than
 * utility-specific names, dates, schedules, or projects.
 */

function getPlanningStartYear(data) {
  const document =
    data?.document || {};

  const candidates = [
    document.planning_period,
    document.planningPeriod,
    document.plan_period,
    document.period
  ];

  for (const value of candidates) {
    const year =
      extractFirstYear(value);

    if (year !== null) {
      return year;
    }
  }

  /*
   * Without an explicit planning period, do not guess.
   */

  return null;
}


function extractFirstYear(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1800 &&
    value <= 2200
  ) {
    return value;
  }

  const text =
    String(value);

  const match =
    text.match(
      /\b(18|19|20|21)\d{2}\b/
    );

  if (!match) {
    return null;
  }

  const year =
    Number(match[0]);

  return Number.isFinite(year)
    ? year
    : null;
}


function extractYearFromDate(value) {
  return extractFirstYear(value);
}


/*
 * ============================================================
 * HISTORICAL COMMERCIAL-SERVICE CLASSIFICATION
 * ============================================================
 *
 * This intentionally does NOT inspect entity_type.
 *
 * If:
 *
 * commercial-service year < planning-period start year
 *
 * then the date remains timeline metadata but is not automatically
 * materialized as a plan event.
 */

function shouldSkipHistoricalCommercialService({
  effectiveDate,
  planningStartYear
}) {
  const eventYear =
    extractYearFromDate(
      effectiveDate
    );

  /*
   * Without both years we cannot safely classify the milestone
   * as historical relative to the planning period.
   */

  if (
    eventYear === null ||
    planningStartYear === null
  ) {
    return false;
  }

  return (
    eventYear < planningStartYear
  );
}


/*
 * ============================================================
 * CONTRACT CLASSIFICATION
 * ============================================================
 *
 * Supports the current entity_type representation and the older
 * record_type representation.
 */

function getEntityType(project) {
  return normalizeIdentifier(
    project?.entity_type ??
    project?.record_type ??
    ''
  );
}


function isContractEntity(project) {
  return (
    getEntityType(project) ===
    'contract'
  );
}


/*
 * ============================================================
 * CONTRACT RETIREMENT CLASSIFICATION
 * ============================================================
 *
 * A contract is not a physical infrastructure asset.
 *
 * timeline.retirement_date on a contract may represent expiration,
 * termination, end of service, or another contractual milestone.
 *
 * Therefore GridLock must not automatically transform it into a
 * physical retirement event.
 *
 * We do NOT:
 *
 * - delete the timeline date
 * - convert it automatically to contract_expiration
 * - invent a new event
 *
 * Explicitly extracted contract_expiration events remain the
 * authoritative event representation.
 */

function shouldSkipContractRetirement({
  project
}) {
  return isContractEntity(project);
}


/*
 * ============================================================
 * CREATE DERIVED EVENT
 * ============================================================
 */

function createDerivedTimelineEvent({
  project,
  eventType,
  effectiveDate,
  sourceIds
}) {
  const projectId =
    project.project_id;

  return {
    event_id:
      buildDerivedEventId(
        projectId,
        eventType,
        effectiveDate
      ),

    project_id:
      projectId,

    event_type:
      eventType,

    effective_date:
      effectiveDate,

    /*
     * Do NOT copy capacity blindly.
     *
     * A timeline milestone does not prove which capacity concept
     * should be attached to the event.
     */

    capacity_mw:
      null,

    capacity_type:
      null,

    description:
      buildDerivedEventDescription(
        project,
        eventType,
        effectiveDate
      ),

    source_ids:
      [...sourceIds],

    /*
     * Extra metadata is useful for auditing.
     */

    derived:
      true,

    derivation_source:
      `timeline.${timelineFieldForEventType(eventType)}`
  };
}


/*
 * ============================================================
 * DERIVED EVENT DESCRIPTION
 * ============================================================
 */

function buildDerivedEventDescription(
  project,
  eventType,
  effectiveDate
) {
  const title =
    project?.title ||
    project?.project_id ||
    'Infrastructure entity';

  switch (eventType) {
    case 'construction_start':
      return (
        `${title} has a normalized construction-start ` +
        `milestone of ${effectiveDate}.`
      );

    case 'commercial_service':
      return (
        `${title} has a normalized commercial-service ` +
        `milestone of ${effectiveDate}.`
      );

    case 'retirement':
      return (
        `${title} has a normalized retirement ` +
        `milestone of ${effectiveDate}.`
      );

    default:
      return (
        `${title} has a normalized ${eventType} ` +
        `milestone of ${effectiveDate}.`
      );
  }
}


/*
 * ============================================================
 * EVENT DEDUPLICATION
 * ============================================================
 *
 * AI-generated events take precedence over derived events when
 * both represent the same semantic occurrence.
 */

function deduplicatePlanEvents(data) {
  if (!Array.isArray(data.plan_events)) {
    return;
  }

  const groups =
    new Map();

  for (const event of data.plan_events) {
    const key =
      semanticEventKey(event);

    if (!groups.has(key)) {
      groups.set(
        key,
        []
      );
    }

    groups.get(key).push(
      event
    );
  }

  const kept = [];
  const removed = [];

  for (const events of groups.values()) {
    if (events.length === 1) {
      kept.push(
        events[0]
      );

      continue;
    }

    /*
     * Prefer AI-extracted events over derived events.
     */

    const preferred =
      events.find(
        event =>
          event?.derived !== true
      ) ||
      events[0];

    kept.push(
      preferred
    );

    for (const event of events) {
      if (event === preferred) {
        continue;
      }

      removed.push({
        ...event,

        normalization_reason:
          'Duplicate semantic plan event removed during normalization.'
      });
    }
  }

  data.plan_events =
    kept;

  if (removed.length > 0) {
    data.removed_duplicate_events.push(
      ...removed
    );

    addNormalizationNote(
      data,
      `Removed ${removed.length} duplicate plan event(s) after combining AI-extracted and timeline-derived events.`
    );
  }
}


/*
 * ============================================================
 * SEMANTIC EVENT IDENTITY
 * ============================================================
 *
 * Events are equivalent when they describe:
 *
 * same project
 * + same event type
 * + same normalized date
 *
 * Capacity is intentionally not part of the identity because a
 * timeline-derived event does not know the capacity semantics.
 */

function semanticEventKey(event) {
  return [
    normalizeIdentifier(
      event?.project_id
    ),

    normalizeIdentifier(
      event?.event_type
    ),

    normalizeDateValue(
      event?.effective_date
    )
  ].join('|');
}


function findEquivalentEvent(
  events,
  projectId,
  eventType,
  effectiveDate
) {
  if (!Array.isArray(events)) {
    return null;
  }

  const targetKey = [
    normalizeIdentifier(
      projectId
    ),

    normalizeIdentifier(
      eventType
    ),

    normalizeDateValue(
      effectiveDate
    )
  ].join('|');

  return (
    events.find(
      event =>
        semanticEventKey(event) ===
        targetKey
    ) ||
    null
  );
}


/*
 * ============================================================
 * TIMELINE -> EVENT COVERAGE AUDIT
 * ============================================================
 *
 * Every usable normalized timeline milestone that SHOULD become
 * a planning event must have a corresponding plan_event.
 *
 * Two timeline cases intentionally do NOT require derived events:
 *
 * 1. historical commercial-service milestones before the planning
 *    horizon;
 *
 * 2. retirement_date on contract entities.
 *
 * The second rule prevents the coverage audit from demanding the
 * exact semantic error that the normalizer intentionally avoids.
 */

function auditTimelineEventCoverage(data) {
  if (!Array.isArray(data.projects)) {
    return;
  }

  const warnings = [];

  const planningStartYear =
    getPlanningStartYear(data);

  for (const project of data.projects) {
    const projectId =
      project?.project_id;

    const timeline =
      project?.timeline;

    if (!projectId || !timeline) {
      continue;
    }

    const checks = [
      {
        eventType:
          'construction_start',

        date:
          timeline.construction_start
      },
      {
        eventType:
          'commercial_service',

        date:
          timeline.commercial_service
      },
      {
        eventType:
          'retirement',

        date:
          timeline.retirement_date
      }
    ];

    for (const check of checks) {
      if (!hasUsableDate(check.date)) {
        continue;
      }


      /*
       * --------------------------------------------------------
       * HISTORICAL COMMERCIAL SERVICE
       * --------------------------------------------------------
       */

      if (
        check.eventType ===
          'commercial_service' &&
        shouldSkipHistoricalCommercialService({
          effectiveDate:
            check.date,

          planningStartYear
        })
      ) {
        continue;
      }


      /*
       * --------------------------------------------------------
       * CONTRACT RETIREMENT
       * --------------------------------------------------------
       */

      if (
        check.eventType ===
          'retirement' &&
        shouldSkipContractRetirement({
          project
        })
      ) {
        continue;
      }


      /*
       * --------------------------------------------------------
       * REQUIRED EVENT
       * --------------------------------------------------------
       */

      const found =
        findEquivalentEvent(
          data.plan_events,
          projectId,
          check.eventType,
          check.date
        );

      if (!found) {
        warnings.push(
          `${projectId}: timeline.${timelineFieldForEventType(
            check.eventType
          )}=${check.date} has no corresponding ${check.eventType} plan event.`
        );
      }
    }
  }

  data.event_coverage_warnings =
    warnings;

  if (warnings.length === 0) {
    addNormalizationNote(
      data,
      'Timeline-to-plan-event coverage check passed.'
    );
  } else {
    addNormalizationNote(
      data,
      `Timeline-to-plan-event coverage check found ${warnings.length} unmatched milestone(s).`
    );
  }
}


/*
 * ============================================================
 * SOURCE INHERITANCE
 * ============================================================
 */

function collectProjectSourceIds(project) {
  const result =
    new Set();

  /*
   * Preferred representation:
   *
   * project.source_ids = [...]
   */

  if (
    Array.isArray(
      project?.source_ids
    )
  ) {
    for (
      const id
      of project.source_ids
    ) {
      if (
        typeof id === 'string' &&
        id.trim()
      ) {
        result.add(id);
      }
    }
  }

  /*
   * Compatibility with representations where project.sources
   * contains either IDs or source objects.
   */

  if (
    Array.isArray(
      project?.sources
    )
  ) {
    for (
      const source
      of project.sources
    ) {
      if (
        typeof source === 'string' &&
        source.trim()
      ) {
        result.add(source);

        continue;
      }

      if (
        source &&
        typeof source === 'object'
      ) {
        const id =
          source.source_id ||
          source.id;

        if (
          typeof id === 'string' &&
          id.trim()
        ) {
          result.add(id);
        }
      }
    }
  }

  return [...result];
}


/*
 * ============================================================
 * RELATIONSHIPS
 * ============================================================
 *
 * Relationship endpoints behave like foreign keys.
 *
 * If the target entity does not exist, the relationship cannot
 * remain in the normalized dataset.
 */

function normalizeRelationships(data) {
  if (
    !Array.isArray(data.projects) ||
    !Array.isArray(data.relationships)
  ) {
    return;
  }

  const projectIds =
    new Set(
      data.projects
        .map(
          project =>
            project?.project_id
        )
        .filter(Boolean)
    );

  const valid = [];
  const removed = [];

  for (
    const relationship
    of data.relationships
  ) {
    const fromExists =
      typeof relationship
        ?.from_project_id ===
        'string' &&
      projectIds.has(
        relationship.from_project_id
      );

    const toExists =
      typeof relationship
        ?.to_project_id ===
        'string' &&
      projectIds.has(
        relationship.to_project_id
      );

    if (
      fromExists &&
      toExists
    ) {
      valid.push(
        relationship
      );

      continue;
    }

    removed.push({
      ...relationship,

      normalization_reason:
        'Relationship endpoint does not reference an existing GridLock entity.'
    });
  }

  data.relationships =
    valid;

  if (removed.length > 0) {
    data.removed_relationships.push(
      ...removed
    );

    addNormalizationNote(
      data,
      `Removed ${removed.length} relationship(s) containing nonexistent entity references.`
    );
  }
}


/*
 * ============================================================
 * RELATED PROJECT IDS
 * ============================================================
 */

function normalizeRelatedProjectIds(data) {
  if (!Array.isArray(data.projects)) {
    return;
  }

  const projectIds =
    new Set(
      data.projects
        .map(
          project =>
            project?.project_id
        )
        .filter(Boolean)
    );

  for (const project of data.projects) {
    if (
      !Array.isArray(
        project.related_project_ids
      )
    ) {
      project.related_project_ids = [];

      continue;
    }

    const original =
      [...project.related_project_ids];

    const valid =
      original.filter(
        id =>
          typeof id === 'string' &&
          projectIds.has(id)
      );

    const removed =
      original.filter(
        id =>
          !projectIds.has(id)
      );

    project.related_project_ids =
      [...new Set(valid)];

    if (removed.length > 0) {
      addWarning(
        project,
        `Removed nonexistent related project reference(s): ${removed.join(', ')}`
      );
    }
  }
}


/*
 * ============================================================
 * DUPLICATE IDS
 * ============================================================
 *
 * Report duplicates but do not automatically merge entities.
 */

function inspectDuplicateProjectIds(data) {
  if (!Array.isArray(data.projects)) {
    return;
  }

  const seen =
    new Set();

  const duplicates =
    new Set();

  for (const project of data.projects) {
    const id =
      project?.project_id;

    if (!id) {
      continue;
    }

    if (seen.has(id)) {
      duplicates.add(id);
    }

    seen.add(id);
  }

  if (duplicates.size > 0) {
    addNormalizationNote(
      data,
      `Duplicate project IDs require review: ${[
        ...duplicates
      ].join(', ')}`
    );
  }
}


/*
 * ============================================================
 * EVENT HELPERS
 * ============================================================
 */

function hasUsableDate(value) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0
  );
}


function normalizeDateValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value)
    .trim()
    .toLowerCase();
}


function normalizeIdentifier(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value)
    .trim()
    .toLowerCase();
}


function timelineFieldForEventType(
  eventType
) {
  switch (eventType) {
    case 'construction_start':
      return 'construction_start';

    case 'commercial_service':
      return 'commercial_service';

    case 'retirement':
      return 'retirement_date';

    default:
      return eventType;
  }
}


function buildDerivedEventId(
  projectId,
  eventType,
  effectiveDate
) {
  const safeProject =
    slugify(projectId);

  const safeType =
    slugify(eventType);

  const safeDate =
    slugify(effectiveDate);

  return [
    safeProject,
    safeType,
    safeDate,
    'derived'
  ]
    .filter(Boolean)
    .join('-');
}


function slugify(value) {
  return String(
    value || ''
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    );
}


/*
 * ============================================================
 * FIELD CLASSIFICATION
 * ============================================================
 */

function normalizeFieldName(field) {
  return String(
    field || ''
  )
    .trim()
    .toLowerCase()
    .replace(
      /[_-]+/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    );
}


function mentionsNameplate(field) {
  return field.includes(
    'nameplate'
  );
}


function mentionsSummer(field) {
  return field.includes(
    'summer'
  );
}


function mentionsWinter(field) {
  return field.includes(
    'winter'
  );
}


function isGenericCapacityConflict(field) {
  return (
    field === 'capacity' ||
    field === 'seasonal capacity' ||
    field === 'capacity values'
  );
}


function mentionsStorageEnergy(field) {
  return (
    field.includes(
      'storage energy'
    ) ||
    field.includes(
      'storage mwh'
    ) ||
    field.includes(
      'energy capacity'
    )
  );
}


function mentionsInterconnectionStation(
  field
) {
  return (
    field.includes(
      'interconnection station'
    ) ||
    field.includes(
      'interconnection.station'
    ) ||
    (
      field.includes('station') &&
      field.includes(
        'interconnection'
      )
    )
  );
}


function mentionsVoltage(field) {
  return (
    field.includes(
      'voltage'
    ) ||
    field.includes(
      'kv'
    )
  );
}


function mentionsLineLength(field) {
  return (
    field.includes(
      'line length'
    ) ||
    field.includes(
      'miles'
    )
  );
}


function mentionsAcreage(field) {
  return (
    field.includes(
      'acreage'
    ) ||
    field.includes(
      'site area'
    )
  );
}


function mentionsConstructionStart(
  field
) {
  return (
    field.includes(
      'construction start'
    ) ||
    field.includes(
      'construction date'
    )
  );
}


function mentionsCommercialService(
  field
) {
  return (
    field.includes(
      'commercial service'
    ) ||
    field.includes(
      'in service'
    ) ||
    field.includes(
      'in-service'
    )
  );
}


function mentionsRetirement(field) {
  return field.includes(
    'retirement'
  );
}


/*
 * ============================================================
 * NORMALIZATION NOTE HELPER
 * ============================================================
 */

function addNormalizationNote(
  data,
  note
) {
  if (
    !Array.isArray(
      data.normalization_notes
    )
  ) {
    data.normalization_notes = [];
  }

  if (
    !data.normalization_notes.includes(
      note
    )
  ) {
    data.normalization_notes.push(
      note
    );
  }
}


/*
 * ============================================================
 * WARNING HELPER
 * ============================================================
 */

function addWarning(
  project,
  warning
) {
  if (
    !Array.isArray(
      project.warnings
    )
  ) {
    project.warnings = [];
  }

  if (
    !project.warnings.includes(
      warning
    )
  ) {
    project.warnings.push(
      warning
    );
  }
}


/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
  normalizeExtraction
};