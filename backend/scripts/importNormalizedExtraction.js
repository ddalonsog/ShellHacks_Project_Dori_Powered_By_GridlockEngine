const fs = require('fs');

const path = require('path');

const { Pool } = require('pg');

require('dotenv').config({

  path: path.join(__dirname, '../.env')

});





/*

 * ============================================================

 * GRIDLOCK NORMALIZED EXTRACTION IMPORTER

 * ============================================================

 *

 * Imports:

 *

 *   data/ai-projects-normalized.json

 *

 * into PostgreSQL.

 *

 * The importer is designed to be:

 *

 * - transactional

 * - idempotent

 * - utility-agnostic

 * - compatible with the existing GridLock projects table

 *

 * It does NOT:

 *

 * - call OpenAI

 * - modify the JSON input

 * - invent missing values

 * - invent date precision

 * - infer coordinates

 */





function printUsage() {
  console.log('');
  console.log('Usage:');
  console.log('');
  console.log('  node scripts/importNormalizedExtraction.js <normalized-json-path>');
  console.log('');
  console.log('Example:');
  console.log('');
  console.log('  node scripts/importNormalizedExtraction.js data/extractions/duke-2026-tysp/normalized.json');
  console.log('');
}

function resolveInputPath(inputPath) {
  if (!inputPath) return null;
  if (path.isAbsolute(inputPath)) return path.normalize(inputPath);
  return path.resolve(__dirname, '..', inputPath);
}





/*

 * ============================================================

 * DATABASE

 * ============================================================

 *

 * Supports either:

 *

 * DATABASE_URL

 *

 * or the standard PostgreSQL variables:

 *

 * DB_HOST

 * DB_PORT

 * DB_NAME

 * DB_USER

 * DB_PASSWORD

 */



function createPool() {

  if (process.env.DATABASE_URL) {

    return new Pool({

      connectionString:

        process.env.DATABASE_URL

    });

  }



  return new Pool({

    host:

      process.env.DB_HOST ||

      'localhost',



    port:

      Number(

        process.env.DB_PORT ||

        5432

      ),



    database:

      process.env.DB_NAME,



    user:

      process.env.DB_USER,



    password:

      process.env.DB_PASSWORD

  });

}





/*

 * ============================================================

 * HELPERS

 * ============================================================

 */



function normalizeString(value) {

  if (

    value === null ||

    value === undefined

  ) {

    return null;

  }



  const text =

    String(value).trim();



  return text.length > 0

    ? text

    : null;

}





function normalizeNumber(value) {

  if (

    value === null ||

    value === undefined ||

    value === ''

  ) {

    return null;

  }



  const number =

    Number(value);



  return Number.isFinite(number)

    ? number

    : null;

}





function normalizeBoolean(value) {

  return value === true;

}





function firstNonNull(...values) {

  for (const value of values) {

    if (

      value !== null &&

      value !== undefined

    ) {

      return value;

    }

  }



  return null;

}





function extractYear(value) {

  if (

    value === null ||

    value === undefined

  ) {

    return null;

  }



  const match =

    String(value).match(

      /\b(18|19|20|21)\d{2}\b/

    );



  if (!match) {

    return null;

  }



  const year =

    Number(match[0]);



  return Number.isInteger(year)

    ? year

    : null;

}





/*

 * Convert to a PostgreSQL DATE only when the source contains

 * full YYYY-MM-DD precision.

 *

 * We deliberately do NOT transform:

 *

 * 2026

 * 2026-05

 *

 * into invented dates.

 */



function exactDateOrNull(value) {

  const text =

    normalizeString(value);



  if (!text) {

    return null;

  }



  if (

    /^\d{4}-\d{2}-\d{2}$/.test(text)

  ) {

    return text;

  }



  return null;

}





function getEntityType(project) {

  return (

    normalizeString(

      project?.entity_type

    ) ||

    normalizeString(

      project?.record_type

    ) ||

    'project'

  );

}





function getInfrastructureType(project) {

  return (

    normalizeString(

      project?.infrastructure_type

    ) ||

    null

  );

}





function getCapacity(project) {

  const capacity =

    project?.capacity || {};



  const nameplate =

    normalizeNumber(

      capacity.nameplate_mw

    );



  const summer =

    normalizeNumber(

      capacity.summer_mw

    );



  const winter =

    normalizeNumber(

      capacity.winter_mw

    );



  const storage =

    normalizeNumber(

      capacity.storage_mwh

    );



  /*

   * Backward-compatible simplified capacity.

   *

   * This does NOT replace the detailed fields.

   *

   * Existing UI code can continue using capacity_mw.

   */



  const simplified =

    firstNonNull(

      nameplate,

      summer,

      winter

    );



  return {

    simplified,

    nameplate,

    summer,

    winter,

    storage

  };

}





function getTimeline(project) {

  const timeline =

    project?.timeline || {};



  return {

    constructionStart:

      normalizeString(

        timeline.construction_start

      ),



    commercialService:

      normalizeString(

        timeline.commercial_service

      ),



    retirementDate:

      normalizeString(

        timeline.retirement_date

      )

  };

}





function getInterconnection(project) {

  const interconnection =

    project?.interconnection || {};



  return {

    voltageKv:

      normalizeNumber(

        interconnection.voltage_kv

      ),



    station:

      normalizeString(

        interconnection.station

      ),



    connection:

      normalizeString(

        interconnection.connection

      ),



    lineLengthMiles:

      normalizeNumber(

        interconnection.line_length_miles

      )

  };

}





function getLocation(project) {

  const location =

    project?.location || {};



  return {

    county:

      normalizeString(

        location.county

      ),



    state:

      normalizeString(

        location.state

      ),



    address:

      normalizeString(

        location.address

      ),



    latitude:

      normalizeNumber(

        location.latitude

      ),



    longitude:

      normalizeNumber(

        location.longitude

      ),



    locationSource:

      normalizeString(

        location.location_source

      )

  };

}





function getSourceIds(item) {

  const result =

    new Set();



  if (

    Array.isArray(

      item?.source_ids

    )

  ) {

    for (

      const id

      of item.source_ids

    ) {

      const normalized =

        normalizeString(id);



      if (normalized) {

        result.add(normalized);

      }

    }

  }



  /*

   * Compatibility in case sources are embedded rather than

   * represented only as source_ids.

   */



  if (

    Array.isArray(

      item?.sources

    )

  ) {

    for (

      const source

      of item.sources

    ) {

      if (

        typeof source === 'string'

      ) {

        const normalized =

          normalizeString(source);



        if (normalized) {

          result.add(normalized);

        }



        continue;

      }



      if (

        source &&

        typeof source === 'object'

      ) {

        const id =

          normalizeString(

            source.source_id ||

            source.id

          );



        if (id) {

          result.add(id);

        }

      }

    }

  }



  return [...result];

}





/*

 * ============================================================

 * DOCUMENT METADATA

 * ============================================================

 */



function getUtilityName(data) {

  return (

    normalizeString(

      data?.document?.utility

    ) ||

    normalizeString(

      data?.utility

    )

  );

}





function getUtilityState(data) {

  /*

   * Prefer explicit document metadata if present.

   */



  const explicit =

    normalizeString(

      data?.document?.state

    );



  if (explicit) {

    return explicit

      .toUpperCase()

      .slice(0, 2);

  }



  /*

   * Otherwise inspect project locations.

   *

   * We only accept the state automatically if all explicitly

   * supplied states agree.

   */



  const states =

    new Set();



  for (

    const project

    of data.projects || []

  ) {

    const state =

      normalizeString(

        project?.location?.state

      );



    if (state) {

      states.add(

        state.toUpperCase()

      );

    }

  }



  if (states.size === 1) {

    return [...states][0]

      .slice(0, 2);

  }



  return null;

}





function getDocumentTitle(data) {

  return (

    normalizeString(

      data?.document?.title

    ) ||

    null

  );

}





/*

 * ============================================================

 * UPSERT UTILITY

 * ============================================================

 */



async function upsertUtility(

  client,

  data

) {

  const name =

    getUtilityName(data);



  const state =

    getUtilityState(data);



  if (!name) {

    throw new Error(

      'Extraction does not contain a utility name.'

    );

  }



  if (!state) {

    throw new Error(

      'Could not determine utility state from normalized extraction.'

    );

  }



  const result =

    await client.query(

      `

      INSERT INTO utilities (

        name,

        state

      )

      VALUES ($1, $2)



      ON CONFLICT (name)

      DO UPDATE SET

        state = EXCLUDED.state



      RETURNING id, name, state

      `,

      [

        name,

        state

      ]

    );



  return result.rows[0];

}





/*

 * ============================================================

 * UPSERT SOURCES

 * ============================================================

 */



async function upsertSources(

  client,

  data,

  utilityId

) {

  const sourceMap =

    new Map();



  for (

    const source

    of data.sources || []

  ) {

    const externalId =

      normalizeString(

        source?.source_id ||

        source?.external_id ||

        source?.id

      );



    if (!externalId) {

      continue;

    }



    const result =

      await client.query(

        `

        INSERT INTO sources (

          utility_id,

          external_id,

          document,

          section,

          schedule,

          figure,

          pdf_page,

          printed_page,

          evidence,

          updated_at

        )

        VALUES (

          $1, $2, $3, $4, $5,

          $6, $7, $8, $9,

          CURRENT_TIMESTAMP

        )



        ON CONFLICT (

          utility_id,

          external_id

        )

        DO UPDATE SET

          document =

            EXCLUDED.document,



          section =

            EXCLUDED.section,



          schedule =

            EXCLUDED.schedule,



          figure =

            EXCLUDED.figure,



          pdf_page =

            EXCLUDED.pdf_page,



          printed_page =

            EXCLUDED.printed_page,



          evidence =

            EXCLUDED.evidence,



          updated_at =

            CURRENT_TIMESTAMP



        RETURNING id

        `,

        [

          utilityId,



          externalId,



          normalizeString(

            source.document

          ),



          normalizeString(

            source.section

          ),



          normalizeString(

            source.schedule

          ),



          normalizeString(

            source.figure

          ),



          Number.isInteger(

            source.pdf_page

          )

            ? source.pdf_page

            : null,



          normalizeString(

            source.printed_page

          ),



          normalizeString(

            source.evidence

          )

        ]

      );



    sourceMap.set(

      externalId,

      result.rows[0].id

    );

  }



  return sourceMap;

}





/*

 * ============================================================

 * UPSERT PROJECTS / ENTITIES

 * ============================================================

 */



async function upsertProjects(

  client,

  data,

  utilityId

) {

  const projectMap =

    new Map();



  const documentTitle =

    getDocumentTitle(data);



  for (

    const project

    of data.projects || []

  ) {

    const externalId =

      normalizeString(

        project?.project_id ||

        project?.external_id

      );



    if (!externalId) {

      throw new Error(

        `Project/entity has no project_id: ${project?.title || '(untitled)'}`

      );

    }



    const capacity =

      getCapacity(project);



    const timeline =

      getTimeline(project);



    const interconnection =

      getInterconnection(project);



    const location =

      getLocation(project);



    /*

     * Compatibility dates.

     *

     * start_year:

     * construction start first,

     * otherwise commercial service.

     *

     * end_year:

     * retirement date.

     */



    const startYear =

      firstNonNull(

        extractYear(

          timeline.constructionStart

        ),



        extractYear(

          timeline.commercialService

        )

      );



    const endYear =

      extractYear(

        timeline.retirementDate

      );



    /*

     * DATE columns receive a value ONLY if the source gave

     * complete day precision.

     */



    const startDate =

      firstNonNull(

        exactDateOrNull(

          timeline.constructionStart

        ),



        exactDateOrNull(

          timeline.commercialService

        )

      );



    const endDate =

      exactDateOrNull(

        timeline.retirementDate

      );



    /*

     * Coordinates are used only when both are explicitly

     * available.

     *

     * PostGIS expects longitude first:

     *

     * ST_MakePoint(longitude, latitude)

     */



    const hasCoordinates =

      location.latitude !== null &&

      location.longitude !== null;



    const result =

      await client.query(

        `

        INSERT INTO projects (

          utility_id,

          external_id,



          title,

          category,

          subtype,



          entity_type,

          infrastructure_type,

          technology,



          voltage_kv,

          capacity_mw,



          nameplate_mw,

          summer_mw,

          winter_mw,

          storage_mwh,



          county,

          state,

          address,

          location_source,



          start_year,

          end_year,

          start_date,

          end_date,



          construction_start_text,

          commercial_service_text,

          retirement_date_text,



          status,



          station,

          connection,

          line_length_miles,



          primary_fuel,

          alternate_fuel,

          acreage,

          is_tbd,



          description,



          geom,



          source_type,

          source_document,



          updated_at

        )

        VALUES (

          $1, $2,

          $3, $4, $5,

          $6, $7, $8,

          $9, $10,

          $11, $12, $13, $14,

          $15, $16, $17, $18,

          $19, $20, $21, $22,

          $23, $24, $25,

          $26,

          $27, $28, $29,

          $30, $31, $32, $33,

          $34,



          CASE

            WHEN $35::boolean

            THEN ST_SetSRID(

              ST_MakePoint(

                $36::double precision,

                $37::double precision

              ),

              4326

            )

            ELSE NULL

          END,



          $38,

          $39,



          CURRENT_TIMESTAMP

        )



        ON CONFLICT (

          utility_id,

          external_id

        )

        DO UPDATE SET

          title =

            EXCLUDED.title,



          category =

            EXCLUDED.category,



          subtype =

            EXCLUDED.subtype,



          entity_type =

            EXCLUDED.entity_type,



          infrastructure_type =

            EXCLUDED.infrastructure_type,



          technology =

            EXCLUDED.technology,



          voltage_kv =

            EXCLUDED.voltage_kv,



          capacity_mw =

            EXCLUDED.capacity_mw,



          nameplate_mw =

            EXCLUDED.nameplate_mw,



          summer_mw =

            EXCLUDED.summer_mw,



          winter_mw =

            EXCLUDED.winter_mw,



          storage_mwh =

            EXCLUDED.storage_mwh,



          county =

            EXCLUDED.county,



          state =

            EXCLUDED.state,



          address =

            EXCLUDED.address,



          location_source =

            EXCLUDED.location_source,



          start_year =

            EXCLUDED.start_year,



          end_year =

            EXCLUDED.end_year,



          start_date =

            EXCLUDED.start_date,



          end_date =

            EXCLUDED.end_date,



          construction_start_text =

            EXCLUDED.construction_start_text,



          commercial_service_text =

            EXCLUDED.commercial_service_text,



          retirement_date_text =

            EXCLUDED.retirement_date_text,



          status =

            EXCLUDED.status,



          station =

            EXCLUDED.station,



          connection =

            EXCLUDED.connection,



          line_length_miles =

            EXCLUDED.line_length_miles,



          primary_fuel =

            EXCLUDED.primary_fuel,



          alternate_fuel =

            EXCLUDED.alternate_fuel,



          acreage =

            EXCLUDED.acreage,



          is_tbd =

            EXCLUDED.is_tbd,



          description =

            EXCLUDED.description,



          geom =

            EXCLUDED.geom,



          source_type =

            EXCLUDED.source_type,



          source_document =

            EXCLUDED.source_document,



          updated_at =

            CURRENT_TIMESTAMP



        RETURNING id

        `,

        [

          utilityId,

          externalId,



          normalizeString(

            project.title

          ) ||

            externalId,



          normalizeString(

            project.category

          ) ||

            'other',



          normalizeString(

            project.subtype

          ),



          getEntityType(

            project

          ),



          getInfrastructureType(

            project

          ),



          normalizeString(

            project.technology

          ),



          interconnection.voltageKv,



          capacity.simplified,



          capacity.nameplate,

          capacity.summer,

          capacity.winter,

          capacity.storage,



          location.county,

          location.state,

          location.address,

          location.locationSource,



          startYear,

          endYear,

          startDate,

          endDate,



          timeline.constructionStart,

          timeline.commercialService,

          timeline.retirementDate,



          normalizeString(

            project.status

          ) ||

            'Planned',



          interconnection.station,

          interconnection.connection,

          interconnection.lineLengthMiles,



          normalizeString(

            project.primary_fuel

          ),



          normalizeString(

            project.alternate_fuel

          ),



          normalizeNumber(

            project.acreage

          ),



          normalizeBoolean(

            project.is_tbd

          ),



          normalizeString(

            project.description

          ),



          hasCoordinates,



          location.longitude,

          location.latitude,



          'official_tysp',



          documentTitle

        ]

      );



    projectMap.set(

      externalId,

      result.rows[0].id

    );

  }



  return projectMap;

}





/*

 * ============================================================

 * UPSERT PLAN EVENTS

 * ============================================================

 */



async function upsertPlanEvents(

  client,

  data,

  utilityId,

  projectMap

) {

  const eventMap =

    new Map();



  for (

    const event

    of data.plan_events || []

  ) {

    const externalId =

      normalizeString(

        event?.event_id ||

        event?.external_id

      );



    if (!externalId) {

      throw new Error(

        'Plan event found without event_id.'

      );

    }



    const externalProjectId =

      normalizeString(

        event.project_id

      );



    let databaseProjectId =

      null;



    if (externalProjectId) {

      databaseProjectId =

        projectMap.get(

          externalProjectId

        );



      if (!databaseProjectId) {

        throw new Error(

          `Plan event ${externalId} references unknown project ${externalProjectId}.`

        );

      }

    }



    const result =

      await client.query(

        `

        INSERT INTO plan_events (

          utility_id,

          external_id,

          project_id,



          event_type,

          effective_date,



          capacity_mw,

          capacity_type,



          description,



          is_derived,

          derivation_source,



          updated_at

        )

        VALUES (

          $1, $2, $3,

          $4, $5,

          $6, $7,

          $8,

          $9, $10,

          CURRENT_TIMESTAMP

        )



        ON CONFLICT (

          utility_id,

          external_id

        )

        DO UPDATE SET

          project_id =

            EXCLUDED.project_id,



          event_type =

            EXCLUDED.event_type,



          effective_date =

            EXCLUDED.effective_date,



          capacity_mw =

            EXCLUDED.capacity_mw,



          capacity_type =

            EXCLUDED.capacity_type,



          description =

            EXCLUDED.description,



          is_derived =

            EXCLUDED.is_derived,



          derivation_source =

            EXCLUDED.derivation_source,



          updated_at =

            CURRENT_TIMESTAMP



        RETURNING id

        `,

        [

          utilityId,

          externalId,

          databaseProjectId,



          normalizeString(

            event.event_type

          ) ||

            'other',



          normalizeString(

            event.effective_date

          ),



          normalizeNumber(

            event.capacity_mw

          ),



          normalizeString(

            event.capacity_type

          ),



          normalizeString(

            event.description

          ),



          event.derived === true,



          normalizeString(

            event.derivation_source

          )

        ]

      );



    eventMap.set(

      externalId,

      result.rows[0].id

    );

  }



  return eventMap;

}





/*

 * ============================================================

 * PROJECT RELATIONSHIPS

 * ============================================================

 */



async function upsertRelationships(

  client,

  data,

  projectMap

) {

  let count = 0;



  for (

    const relationship

    of data.relationships || []

  ) {

    const fromExternal =

      normalizeString(

        relationship.from_project_id

      );



    const toExternal =

      normalizeString(

        relationship.to_project_id

      );



    const fromId =

      projectMap.get(

        fromExternal

      );



    const toId =

      projectMap.get(

        toExternal

      );



    if (!fromId) {

      throw new Error(

        `Relationship references unknown source project ${fromExternal}.`

      );

    }



    if (!toId) {

      throw new Error(

        `Relationship references unknown target project ${toExternal}.`

      );

    }



    const relationshipType =

      normalizeString(

        relationship.relationship_type ||

        relationship.type

      ) ||

      'related_to';



    await client.query(

      `

      INSERT INTO project_relationships (

        from_project_id,

        to_project_id,

        relationship_type,

        description

      )

      VALUES (

        $1, $2, $3, $4

      )



      ON CONFLICT (

        from_project_id,

        to_project_id,

        relationship_type

      )

      DO UPDATE SET

        description =

          EXCLUDED.description

      `,

      [

        fromId,

        toId,

        relationshipType,



        normalizeString(

          relationship.description

        )

      ]

    );



    count++;

  }



  return count;

}





/*

 * ============================================================

 * PROJECT <-> SOURCE LINKS

 * ============================================================

 */



async function linkProjectSources(

  client,

  data,

  projectMap,

  sourceMap

) {

  let count = 0;



  for (

    const project

    of data.projects || []

  ) {

    const externalProjectId =

      normalizeString(

        project.project_id ||

        project.external_id

      );



    const databaseProjectId =

      projectMap.get(

        externalProjectId

      );



    if (!databaseProjectId) {

      continue;

    }



    for (

      const externalSourceId

      of getSourceIds(project)

    ) {

      const databaseSourceId =

        sourceMap.get(

          externalSourceId

        );



      /*

       * Do not invent source records.

       *

       * If the normalized extraction references a source that

       * does not exist in the top-level sources collection,

       * skip the link and report it later.

       */



      if (!databaseSourceId) {

        continue;

      }



      await client.query(

        `

        INSERT INTO project_sources (

          project_id,

          source_id

        )

        VALUES ($1, $2)



        ON CONFLICT DO NOTHING

        `,

        [

          databaseProjectId,

          databaseSourceId

        ]

      );



      count++;

    }

  }



  return count;

}





/*

 * ============================================================

 * EVENT <-> SOURCE LINKS

 * ============================================================

 */



async function linkEventSources(

  client,

  data,

  eventMap,

  sourceMap

) {

  let count = 0;



  for (

    const event

    of data.plan_events || []

  ) {

    const externalEventId =

      normalizeString(

        event.event_id ||

        event.external_id

      );



    const databaseEventId =

      eventMap.get(

        externalEventId

      );



    if (!databaseEventId) {

      continue;

    }



    for (

      const externalSourceId

      of getSourceIds(event)

    ) {

      const databaseSourceId =

        sourceMap.get(

          externalSourceId

        );



      if (!databaseSourceId) {

        continue;

      }



      await client.query(

        `

        INSERT INTO event_sources (

          event_id,

          source_id

        )

        VALUES ($1, $2)



        ON CONFLICT DO NOTHING

        `,

        [

          databaseEventId,

          databaseSourceId

        ]

      );



      count++;

    }

  }



  return count;

}





/*

 * ============================================================

 * SOURCE REFERENCE AUDIT

 * ============================================================

 */



function auditSourceReferences(

  data,

  sourceMap

) {

  const missing =

    new Set();



  const inspect =

    item => {

      for (

        const sourceId

        of getSourceIds(item)

      ) {

        if (

          !sourceMap.has(sourceId)

        ) {

          missing.add(sourceId);

        }

      }

    };



  for (

    const project

    of data.projects || []

  ) {

    inspect(project);

  }



  for (

    const event

    of data.plan_events || []

  ) {

    inspect(event);

  }



  return [...missing];

}





/*

 * ============================================================

 * DATABASE VERIFICATION

 * ============================================================

 */



async function verifyImport(

  client,

  utilityId

) {

  const projectResult =

    await client.query(

      `

      SELECT COUNT(*)::int AS count

      FROM projects

      WHERE utility_id = $1

      `,

      [utilityId]

    );



  const eventResult =

    await client.query(

      `

      SELECT COUNT(*)::int AS count

      FROM plan_events

      WHERE utility_id = $1

      `,

      [utilityId]

    );



  const sourceResult =

    await client.query(

      `

      SELECT COUNT(*)::int AS count

      FROM sources

      WHERE utility_id = $1

      `,

      [utilityId]

    );



  const relationshipResult =

    await client.query(

      `

      SELECT COUNT(*)::int AS count

      FROM project_relationships pr

      JOIN projects p

        ON p.id = pr.from_project_id

      WHERE p.utility_id = $1

      `,

      [utilityId]

    );



  const portfolioEventResult =

    await client.query(

      `

      SELECT COUNT(*)::int AS count

      FROM plan_events

      WHERE utility_id = $1

        AND project_id IS NULL

      `,

      [utilityId]

    );



  return {

    projects:

      projectResult.rows[0].count,



    events:

      eventResult.rows[0].count,



    sources:

      sourceResult.rows[0].count,



    relationships:

      relationshipResult.rows[0].count,



    portfolioEvents:

      portfolioEventResult.rows[0].count

  };

}





/*

 * ============================================================

 * MAIN

 * ============================================================

 */



async function main() {
  const inputArgument = process.argv[2];

  if (!inputArgument) {
    console.error('');
    console.error('GRIDLOCK NORMALIZED EXTRACTION IMPORT FAILED');
    console.error('='.repeat(60));
    console.error('No normalized extraction JSON path was provided.');
    printUsage();
    process.exit(1);
  }

  const INPUT_FILE = resolveInputPath(inputArgument);

  if (path.extname(INPUT_FILE).toLowerCase() !== '.json') {
    throw new Error(`Input file must be JSON:
${INPUT_FILE}`);
  }

  console.log('');



  console.log(

    'GRIDLOCK NORMALIZED EXTRACTION IMPORT'

  );



  console.log(

    '='.repeat(60)

  );





  /*

   * ----------------------------------------------------------

   * LOAD FILE

   * ----------------------------------------------------------

   */



  if (!fs.existsSync(INPUT_FILE)) {

    throw new Error(

      `Normalized extraction not found:\n${INPUT_FILE}`

    );

  }



  const raw =

    fs.readFileSync(

      INPUT_FILE,

      'utf8'

    );



  const data =

    JSON.parse(raw);





  /*

   * ----------------------------------------------------------

   * INPUT SUMMARY

   * ----------------------------------------------------------

   */



  console.log('');

  console.log('INPUT');

  console.log('-'.repeat(60));



  console.log(

    `File:          ${INPUT_FILE}`

  );



  console.log(

    `Projects:      ${data.projects?.length || 0}`

  );



  console.log(

    `Plan events:   ${data.plan_events?.length || 0}`

  );



  console.log(

    `Relationships: ${data.relationships?.length || 0}`

  );



  console.log(

    `Sources:       ${data.sources?.length || 0}`

  );





  /*

   * ----------------------------------------------------------

   * CONNECT

   * ----------------------------------------------------------

   */



  const pool =

    createPool();



  const client =

    await pool.connect();



  try {

    console.log('');

    console.log(

      'Connecting to PostgreSQL...'

    );



    await client.query(

      'SELECT 1'

    );



    console.log(

      '✓ PostgreSQL connection established.'

    );





    /*

     * --------------------------------------------------------

     * TRANSACTION

     * --------------------------------------------------------

     */



    await client.query(

      'BEGIN'

    );



    console.log('');

    console.log(

      'IMPORT'

    );



    console.log(

      '-'.repeat(60)

    );





    /*

     * UTILITY

     */



    const utility =

      await upsertUtility(

        client,

        data

      );



    console.log(

      `✓ Utility: ${utility.name} (${utility.state})`

    );





    /*

     * SOURCES

     */



    const sourceMap =

      await upsertSources(

        client,

        data,

        utility.id

      );



    console.log(

      `✓ Sources upserted: ${sourceMap.size}`

    );





    /*

     * PROJECTS

     */



    const projectMap =

      await upsertProjects(

        client,

        data,

        utility.id

      );



    console.log(

      `✓ Projects/entities upserted: ${projectMap.size}`

    );





    /*

     * EVENTS

     */



    const eventMap =

      await upsertPlanEvents(

        client,

        data,

        utility.id,

        projectMap

      );



    console.log(

      `✓ Plan events upserted: ${eventMap.size}`

    );





    /*

     * RELATIONSHIPS

     */



    const relationshipCount =

      await upsertRelationships(

        client,

        data,

        projectMap

      );



    console.log(

      `✓ Relationships upserted: ${relationshipCount}`

    );





    /*

     * SOURCE LINKS

     */



    const projectSourceLinks =

      await linkProjectSources(

        client,

        data,

        projectMap,

        sourceMap

      );



    console.log(

      `✓ Project-source links processed: ${projectSourceLinks}`

    );





    const eventSourceLinks =

      await linkEventSources(

        client,

        data,

        eventMap,

        sourceMap

      );



    console.log(

      `✓ Event-source links processed: ${eventSourceLinks}`

    );





    /*

     * SOURCE AUDIT

     */



    const missingSourceIds =

      auditSourceReferences(

        data,

        sourceMap

      );



    if (

      missingSourceIds.length > 0

    ) {

      console.log('');



      console.log(

        'SOURCE REFERENCE WARNINGS'

      );



      console.log(

        '-'.repeat(60)

      );



      for (

        const sourceId

        of missingSourceIds

      ) {

        console.log(

          `⚠ Referenced source not found in top-level sources: ${sourceId}`

        );

      }

    }





    /*

     * --------------------------------------------------------

     * VERIFY BEFORE COMMIT

     * --------------------------------------------------------

     */



    const verification =

      await verifyImport(

        client,

        utility.id

      );



    console.log('');

    console.log(

      'DATABASE VERIFICATION'

    );



    console.log(

      '-'.repeat(60)

    );



    console.log(

      `Projects/entities:       ${verification.projects}`

    );



    console.log(

      `Plan events:             ${verification.events}`

    );



    console.log(

      `Portfolio-level events:  ${verification.portfolioEvents}`

    );



    console.log(

      `Relationships:           ${verification.relationships}`

    );



    console.log(

      `Sources:                 ${verification.sources}`

    );





    /*

     * --------------------------------------------------------

     * COMMIT

     * --------------------------------------------------------

     */



    await client.query(

      'COMMIT'

    );



    console.log('');

    console.log(

      '✓ TRANSACTION COMMITTED'

    );



    console.log(

      '='.repeat(60)

    );



    console.log(

      'Normalized GridLock extraction successfully imported.'

    );



    console.log(

      'No OpenAI API request was made.'

    );



    console.log('');

  } catch (error) {

    /*

     * --------------------------------------------------------

     * ROLLBACK

     * --------------------------------------------------------

     */



    try {

      await client.query(

        'ROLLBACK'

      );

    } catch {

      /*

       * Ignore rollback failure so the original error remains

       * visible.

       */

    }



    console.error('');

    console.error(

      'IMPORT FAILED'

    );



    console.error(

      '='.repeat(60)

    );



    console.error(

      'Transaction rolled back.'

    );



    throw error;

  } finally {

    client.release();



    await pool.end();

  }

}





/*

 * ============================================================

 * EXECUTION

 * ============================================================

 */



main().catch(

  error => {

    console.error('');



    console.error(

      error.stack ||

      error.message

    );



    process.exit(1);

  }

);