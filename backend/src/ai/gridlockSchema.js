const { z } = require('zod');


/*
 * ============================================================
 * SOURCE
 * ============================================================
 */

const SourceSchema = z.object({
  source_id: z.string(),

  document: z.string(),

  section: z.string().nullable(),
  schedule: z.string().nullable(),
  table: z.string().nullable(),
  figure: z.string().nullable(),

  pdf_page: z.number().int().nullable(),
  printed_page: z.string().nullable(),

  evidence: z.string().nullable()
});


/*
 * ============================================================
 * LOCATION
 * ============================================================
 */

const LocationSchema = z.object({
  county: z.string().nullable(),
  state: z.string().nullable(),
  address: z.string().nullable(),

  latitude: z.number().nullable(),
  longitude: z.number().nullable(),

  location_source: z.enum([
    'explicit_coordinates',
    'explicit_address',
    'map_interpretation',
    'county_only',
    'unknown'
  ])
});


/*
 * ============================================================
 * CAPACITY
 * ============================================================
 */

const CapacitySchema = z.object({
  nameplate_mw: z.number().nullable(),
  summer_mw: z.number().nullable(),
  winter_mw: z.number().nullable(),
  storage_mwh: z.number().nullable()
});


/*
 * ============================================================
 * TIMELINE
 * ============================================================
 */

const TimelineSchema = z.object({
  construction_start: z.string().nullable(),
  commercial_service: z.string().nullable(),
  retirement_date: z.string().nullable()
});


/*
 * ============================================================
 * INTERCONNECTION
 * ============================================================
 */

const InterconnectionSchema = z.object({
  voltage_kv: z.number().nullable(),
  station: z.string().nullable(),
  connection: z.string().nullable(),
  line_length_miles: z.number().nullable()
});


/*
 * ============================================================
 * CLAIM
 * ============================================================
 *
 * Claims are the audit trail.
 *
 * IMPORTANT:
 * Different capacity concepts should normally be separate claims.
 *
 * Example:
 *
 * summer = 22 MW
 * winter = 14 MW
 *
 * should be represented as TWO claims.
 */

const ClaimSchema = z.object({
  field: z.string(),

  value_text: z.string().nullable(),
  value_number: z.number().nullable(),
  unit: z.string().nullable(),

  capacity_type: z.enum([
    'nameplate',
    'summer',
    'winter',
    'storage_energy',
    'capacity_increase',
    'other'
  ]).nullable(),

  scope: z.enum([
    'project',
    'unit',
    'aggregate',
    'planning',
    'facility_specification',
    'transmission',
    'program',
    'portfolio',
    'other',
    'unknown'
  ]),

  /*
   * Identifies the exact population represented by an
   * aggregate/program value.
   *
   * Example:
   *
   * battery-program-six-2023-sites
   *
   * versus:
   *
   * battery-program-seven-sites-including-2025-addition
   */
  scope_key: z.string().nullable(),

  source_ids: z.array(z.string()),

  confidence: z.enum([
    'high',
    'medium',
    'low'
  ])
});


/*
 * ============================================================
 * CONFLICT
 * ============================================================
 */

const ConflictSchema = z.object({
  field: z.string(),

  description: z.string(),

  claim_source_ids: z.array(z.string()),

  severity: z.enum([
    'info',
    'warning',
    'critical'
  ]),

  resolution_status: z.enum([
    'unresolved',
    'scope_difference',
    'resolved_by_document'
  ])
});


/*
 * ============================================================
 * PROJECT / ENTITY
 * ============================================================
 */

const ProjectSchema = z.object({
  project_id: z.string(),

  canonical_name: z.string(),

  aliases: z.array(z.string()),

  entity_type: z.enum([
    'project',
    'facility',
    'program',
    'planning_group',
    'contract',
    'existing_asset',
    'other'
  ]),

  infrastructure_type: z.enum([
    'generation',
    'storage',
    'transmission',
    'generation_and_storage',
    'generation_and_transmission',
    'other',
    'none'
  ]),

  category: z.string(),

  subtype: z.string().nullable(),
  technology: z.string().nullable(),
  status: z.string().nullable(),

  capacity: CapacitySchema,

  location: LocationSchema,

  timeline: TimelineSchema,

  interconnection: InterconnectionSchema,

  primary_fuel: z.string().nullable(),
  alternate_fuel: z.string().nullable(),

  /*
   * Only project-specific acreage.
   *
   * Generic planning assumptions must remain claims/notes.
   */
  acreage: z.number().nullable(),

  description: z.string().nullable(),

  permits: z.array(z.string()),
  environmental_notes: z.array(z.string()),

  is_tbd: z.boolean(),

  parent_project_id: z.string().nullable(),

  related_project_ids: z.array(z.string()),

  source_ids: z.array(z.string()),

  claims: z.array(ClaimSchema),

  conflicts: z.array(ConflictSchema),

  confidence: z.enum([
    'high',
    'medium',
    'low'
  ]),

  warnings: z.array(z.string())
});


/*
 * ============================================================
 * EVENT CAPACITY
 * ============================================================
 *
 * Replaces ambiguous:
 *
 * capacity_mw: 456
 *
 * with:
 *
 * {
 *   value: 456,
 *   unit: "MW",
 *   capacity_type: "nameplate"
 * }
 */

const EventCapacitySchema = z.object({
  value: z.number().nullable(),

  unit: z.enum([
    'MW',
    'MWh'
  ]).nullable(),

  capacity_type: z.enum([
    'nameplate',
    'summer',
    'winter',
    'storage_energy',
    'capacity_increase',
    'other'
  ]).nullable()
});


/*
 * ============================================================
 * PLAN EVENT
 * ============================================================
 */

const PlanEventSchema = z.object({
  event_id: z.string(),

  project_id: z.string().nullable(),

  asset_name: z.string(),

  event_type: z.enum([
    'addition',
    'construction_start',
    'commercial_service',
    'upgrade',
    'capacity_increase',
    'capacity_decrease',
    'retirement',
    'contract_expiration',
    'degradation',
    'conversion',
    'other'
  ]),

  applies_to: z.enum([
    'generation',
    'storage',
    'transmission',
    'program',
    'contract',
    'planning_group',
    'existing_asset',
    'other'
  ]),

  capacity: EventCapacitySchema,

  effective_date: z.string().nullable(),

  description: z.string().nullable(),

  source_ids: z.array(z.string()),

  confidence: z.enum([
    'high',
    'medium',
    'low'
  ])
});


/*
 * ============================================================
 * RELATIONSHIP
 * ============================================================
 */

const RelationshipSchema = z.object({
  from_project_id: z.string(),

  to_project_id: z.string(),

  relationship_type: z.enum([
    'parent_of',
    'child_of',
    'associated_transmission',
    'interconnects_with',
    'located_at',
    'replaces',
    'retires',
    'upgrades',
    'part_of_program',
    'related_to'
  ]),

  description: z.string().nullable(),

  source_ids: z.array(z.string())
});


/*
 * ============================================================
 * DOCUMENT
 * ============================================================
 */

const DocumentSchema = z.object({
  utility: z.string().nullable(),

  title: z.string(),

  planning_period: z.string().nullable(),

  publication_date: z.string().nullable()
});


/*
 * ============================================================
 * FINAL EXTRACTION
 * ============================================================
 */

const GridLockExtractionSchema = z.object({
  document: DocumentSchema,

  sources: z.array(SourceSchema),

  projects: z.array(ProjectSchema),

  plan_events: z.array(PlanEventSchema),

  relationships: z.array(RelationshipSchema),

  document_conflicts: z.array(ConflictSchema),

  extraction_notes: z.array(z.string()),

  unresolved_items: z.array(z.string())
});


module.exports = {
  GridLockExtractionSchema
};