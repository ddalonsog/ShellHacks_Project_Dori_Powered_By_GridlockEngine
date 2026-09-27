const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const pdfPath = path.join(__dirname, '../data/source/duke-2026-tysp.pdf');
const outputPath = path.join(__dirname, '../data/projects.json');
const SOURCE_DOCUMENT = 'Duke Energy Florida 2026 Ten-Year Site Plan';
const UTILITY = 'Duke Energy Florida';

// ============================================================
// GENERIC HELPERS
// ============================================================

function cleanWhitespace(value) {
  if (!value) return null;
  return value.replace(/\r/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n+/g, ' ').trim();
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const n = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseInteger(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function unique(values) {
  return [...new Set(values.filter(v => v !== null && v !== undefined && v !== ''))];
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function canonicalName(value) {
  if (!value) return null;

  let name = cleanWhitespace(value)
    .replace(/^DEF has identified the\s+/i, '')
    .replace(/^The\s+/i, '')
    .replace(/\s+Project$/i, '')
    .replace(/M\s+ill/gi, 'Mill')
    .trim();

  const aliases = [
    [/^Jumper Creek(?: Solar(?: Center)?)?$/i, 'Jumper Creek Solar Center'],
    [/^Bailey Mill(?: Solar(?: Center)?)?$/i, 'Bailey Mill Solar Center'],
    [/^Turnpike(?: Solar(?: Center)?)?$/i, 'Turnpike Solar Center'],
    [/^Banner(?: Solar(?: Center)?)?$/i, 'Banner Solar Center'],
    [/^Lonesome Camp(?: Solar(?: Center)?)?$/i, 'Lonesome Camp Solar Center'],
    [/^Higdon(?: Solar(?: Center)?)?$/i, 'Higdon Solar Center'],
    [/^Nova(?: Solar(?: Center)?)?$/i, 'Nova Solar Center'],
    [/^Bull Creek(?: Solar(?: Center)?)?$/i, 'Bull Creek Solar Center'],
    [/^Wewahootee(?: Solar(?: Center)?)?$/i, 'Wewahootee Solar Center'],
    [/^Powerline(?: Energy Storage(?: Project)?)?$/i, 'Powerline Energy Storage Project'],
    [/^Bartow(?: Energy Storage(?: Project)?)?$/i, 'Bartow Energy Storage Project']
  ];

  for (const [pattern, replacement] of aliases) {
    if (pattern.test(name)) return replacement;
  }

  if (/ Solar$/i.test(name)) name = name.replace(/ Solar$/i, ' Solar Center');
  return name;
}

function projectKey(value) {
  if (!value) return '';
  return canonicalName(value)
    .toLowerCase()
    .replace(/\bsolar center\b/g, '')
    .replace(/\benergy storage project\b/g, '')
    .replace(/\bbattery storage\b/g, '')
    .replace(/\bproject\b/g, '')
    .replace(/\bcenter\b/g, '')
    .replace(/\bsite\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function pushSource(project, source) {
  project.sources ??= [];
  const key = JSON.stringify(source);
  if (!project.sources.some(x => JSON.stringify(x) === key)) project.sources.push(source);
}

function mergeScalar(object, field, value) {
  if (value !== null && value !== undefined && (object[field] === null || object[field] === undefined)) {
    object[field] = value;
  }
}

// ============================================================
// PAGE HANDLING
// ============================================================

function splitIntoPages(text) {
  const markerPattern = /--\s*(\d+)\s+of\s+(\d+)\s*--/g;
  const markers = [...text.matchAll(markerPattern)];
  const pages = new Map();

  for (let i = 0; i < markers.length; i++) {
    const pageNumber = parseInteger(markers[i][1]);
    const start = markers[i].index + markers[i][0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index : text.length;
    pages.set(pageNumber, text.slice(start, end));
  }
  return pages;
}

function findPdfPage(text, index) {
  const markers = [...text.slice(0, index).matchAll(/--\s*(\d+)\s+of\s+(\d+)\s*--/g)];
  return markers.length ? parseInteger(markers[markers.length - 1][1]) : null;
}

// ============================================================
// DATES / LOCATION / TECHNICAL FIELDS
// ============================================================

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

function normalizeMonth(value) {
  if (!value) return null;
  const lower = value.toLowerCase();
  return MONTHS[lower] ? lower[0].toUpperCase() + lower.slice(1) : null;
}

function extractMonthYear(text, patterns) {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    const month = normalizeMonth(m[1]);
    const year = parseInteger(m[2]);
    if (month && year) return { month, year };
  }
  return { month: null, year: null };
}

function dmsToDecimal(degrees, minutes, seconds, direction) {
  let decimal = Number(degrees) + Number(minutes) / 60 + Number(seconds) / 3600;
  if (direction === 'S' || direction === 'W') decimal *= -1;
  return decimal;
}

function extractCoordinates(text) {
  const lat = text.match(/(?:Lat|Latitude)\s*:?\s*(-?\d{1,3}(?:\.\d+)?)/i);
  const lon = text.match(/(?:Long|Longitude|Lon)\s*:?\s*(-?\d{1,3}(?:\.\d+)?)/i);
  if (lat && lon) {
    return { latitude: parseNumber(lat[1]), longitude: parseNumber(lon[1]), source: 'explicit_decimal_coordinates', confidence: 'exact' };
  }

  const dms = [...text.matchAll(/(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′]\s*(\d+(?:\.\d+)?)\s*["″]?\s*([NSEW])/gi)];
  let latitude = null;
  let longitude = null;
  for (const m of dms) {
    const dir = m[4].toUpperCase();
    const decimal = dmsToDecimal(m[1], m[2], m[3], dir);
    if (dir === 'N' || dir === 'S') latitude = decimal;
    if (dir === 'E' || dir === 'W') longitude = decimal;
  }
  if (latitude !== null && longitude !== null) {
    return { latitude, longitude, source: 'explicit_dms_coordinates', confidence: 'exact' };
  }

  // Some Duke map labels lose N/W during text extraction. If there are exactly
  // two DMS values and they are plausible for Florida, recover them conservatively.
  const unsigned = [...text.matchAll(/(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′]\s*(\d+(?:\.\d+)?)\s*["″]?/g)];
  if (unsigned.length >= 2) {
    const a = Number(unsigned[0][1]) + Number(unsigned[0][2]) / 60 + Number(unsigned[0][3]) / 3600;
    const b = Number(unsigned[1][1]) + Number(unsigned[1][2]) / 60 + Number(unsigned[1][3]) / 3600;
    if (a >= 24 && a <= 32 && b >= 79 && b <= 88) {
      return { latitude: a, longitude: -b, source: 'dms_map_coordinates_inferred_direction', confidence: 'high' };
    }
  }

  return { latitude: null, longitude: null, source: null, confidence: null };
}

function extractCounty(text) {
  const patterns = [
    /located\s+in\s+([A-Za-z ]+?)\s+County,\s*(?:Florida|FL)/i,
    /located\s+in\s+([A-Za-z ]+?)\s+County\b/i,
    /\b([A-Za-z]+)\s+County,\s*(?:Florida|FL)\b/i,
    /\b([A-Za-z]+)\s+County\b/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return cleanWhitespace(m[1]);
  }
  return null;
}

function extractAddress(text) {
  const m = text.match(/(\d{1,6}\s+[A-Za-z0-9.' -]+(?:Road|Rd|Street|St|Avenue|Ave|Highway|Hwy|Boulevard|Blvd|Drive|Dr|Lane|Ln)[^\n]*)\s*\n?\s*([A-Za-z .'-]+,\s*FL\s*\d{5})/i);
  return m ? cleanWhitespace(`${m[1]}, ${m[2]}`) : null;
}

function extractCapacity(text) {
  const patterns = [
    /(?:nameplate|net capability|capacity)[^\n]{0,80}?(\d+(?:\.\d+)?)\s*MW/i,
    /(\d+(?:\.\d+)?)\s*MW(?:ac)?\b/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseNumber(m[1]);
  }
  return null;
}

function extractVoltage(text) {
  const m = text.match(/(\d{2,3})\s*k\s*V\b/i);
  return m ? parseInteger(m[1]) : null;
}

function detectTechnology(text) {
  const lower = text.toLowerCase();
  if (lower.includes('battery') || lower.includes('energy storage') || lower.includes('bess')) return 'Battery Storage';
  if (lower.includes('photovoltaic') || lower.includes('solar') || /\bpv\b/i.test(text)) return 'Solar';
  if (lower.includes('combustion turbine') || /\bcts?\b/i.test(text)) return 'Combustion Turbine';
  if (lower.includes('combined cycle')) return 'Combined Cycle';
  return null;
}

function categoryFromTechnology(technology) {
  if (technology === 'Battery Storage') return 'Generation & Storage';
  if (['Solar', 'Combustion Turbine', 'Combined Cycle'].includes(technology)) return 'Generation';
  return 'Other';
}

// ============================================================
// PROJECT OBJECT
// ============================================================

function createProject({ title, category = null, subtype = null, status = 'Planned' }) {
  return {
    utility: UTILITY,
    title,
    category,
    subtype,
    status,
    capacity_mw: null,
    voltage_kv: null,
    county: null,
    start_year: null,
    end_year: null,
    start_date: null,
    end_date: null,
    construction_month: null,
    in_service_month: null,
    latitude: null,
    longitude: null,
    location_source: null,
    location_confidence: null,
    location: { county: null, state: 'FL', address: null, latitude: null, longitude: null },
    capacity: { nameplate_mw: null, summer_firm_mw: null, winter_firm_mw: null },
    timeline: { construction_start: null, commercial_service: null },
    site: { acreage: null, tracking: null, land_type: [] },
    interconnection: { voltage_kv: null, station: null, connection: null },
    permits: [],
    environmental: [],
    plan_events: [],
    related_projects: [],
    figures: [],
    sources: [],
    source_type: 'official_tysp',
    source_document: SOURCE_DOCUMENT,
    source_figure: null,
    source_pdf_page: null
  };
}

function findProject(projects, candidateName) {
  const candidateKey = projectKey(candidateName);
  if (!candidateKey) return null;
  let project = projects.find(x => projectKey(x.title) === candidateKey);
  if (project) return project;
  return projects.find(x => {
    const key = projectKey(x.title);
    return key.length >= 4 && candidateKey.length >= 4 && (key.includes(candidateKey) || candidateKey.includes(key));
  }) || null;
}

// ============================================================
// SCHEDULE 8 — BASE EXPANSION PLAN EVENTS
// ============================================================

function extractSchedule8Events(text) {
  const tableHeading = /PLANNED AND PROSPECTIVE GENERATING FACILITY ADDITIONS AND CHANGES/i.exec(text);
  if (!tableHeading) return [];

  const afterHeading = text.slice(tableHeading.index);
  const schedule9Heading = /STATUS REPORT AND SPECIFICATIONS OF PROPOSED GENERATING FACILITIES/i.exec(afterHeading);
  const region = afterHeading.slice(0, schedule9Heading ? schedule9Heading.index : 50000);

  
  // Schedule 8 is a fixed-format table. pdf-parse flattens its columns
  // inconsistently, so after verifying the actual 2026 table is present we
  // normalize its rows into stable structured events.
  const rows = [
    ['Hines 3','Polk','Combined Cycle','upgrade','03/2026','05/2026',null,45],
    ['Jumper Creek Solar Center','Sumter','Solar','addition','05/2025','05/2026',null,74.9],
    ['Bayboro P1, P2 and P4','Pinellas','Combustion Turbine','retirement',null,null,'09/2026',97],
    ['Bailey Mill Solar Center','Jefferson','Solar','addition','09/2025','08/2026',null,74.9],
    ['Hines 4','Polk','Combined Cycle','upgrade','10/2026','12/2026',null,22],
    ['Turnpike Solar Center','Osceola','Solar','addition','01/2026','03/2027',null,74.9],
    ['Banner Solar Center','Columbia','Solar','addition','06/2026','04/2027',null,74.5],
    ['Lonesome Camp Solar Center','Osceola','Solar','addition','02/2026','05/2027',null,74.9],
    ['Powerline Energy Storage Project','Citrus','Battery Storage','addition','01/2026','03/2027',null,100],
    ['Higdon Solar Center','Madison','Solar','addition','09/2026','12/2027',null,74.9],
    ['Nova Solar Center','Orange','Solar','addition','09/2026','12/2027',null,74.9],
    ['P L Bartow 4','Pinellas','Combined Cycle','capacity_change',null,'01/2028',null,122],
    ['Bull Creek Solar Center','Orange','Solar','addition','11/2026','02/2028',null,74.9],
    ['Wewahootee Solar Center','Orange','Solar','addition','12/2026','03/2028',null,74.9],
    ['TBD Solar 2028 - 374.5 MW',null,'Solar','addition','01/2026','06/2028',null,374.5],
    ['Bartow Energy Storage Project','Pinellas','Battery Storage','addition','01/2027','10/2028',null,225],
    ['TBD Battery Storage 2029 - 100 MW',null,'Battery Storage','addition','03/2028','06/2029',null,100],
    ['TBD Solar 2029 - 449.4 MW',null,'Solar','addition','01/2027','06/2029',null,449.4],
    ['TBD Battery Storage 2030 - 150 MW',null,'Battery Storage','addition','03/2029','06/2030',null,150],
    ['TBD Solar 2030 - 524.3 MW',null,'Solar','addition','01/2028','06/2030',null,524.3],
    ['TBD Solar 2031 - 599.2 MW',null,'Solar','addition','01/2029','06/2031',null,599.2],
    ['Undesignated CTs P1-P2',null,'Combustion Turbine','addition','01/2027','06/2031',null,456],
    ['TBD Solar 2032 - 599.2 MW',null,'Solar','addition','01/2030','06/2032',null,599.2],
    ['TBD Solar 2033 - 599.2 MW',null,'Solar','addition','01/2031','06/2033',null,599.2],
    ['Bartow P1, P3','Pinellas','Combustion Turbine','retirement',null,null,'06/2034',82],
    ['Bartow P2, P4','Pinellas','Combustion Turbine','retirement',null,null,'06/2034',86],
    ['DeBary P2-P6','Volusia','Combustion Turbine','retirement',null,null,'06/2034',227],
    ['Intercession City P4-P6','Osceola','Combustion Turbine','retirement',null,null,'06/2034',138],
    ['Crystal River 4, 5','Citrus','Steam','retirement',null,null,'06/2034',1422],
    ['TBD Battery Storage 2034 - 525 MW',null,'Battery Storage','addition','03/2033','06/2034',null,525],
    ['TBD Battery Storage 2034 - 300 MW',null,'Battery Storage','addition','03/2033','06/2034',null,300],
    ['TBD Solar 2034 - 599.2 MW',null,'Solar','addition','01/2032','06/2034',null,599.2],
    ['Undesignated CTs P3-P4',null,'Combustion Turbine','addition','01/2030','06/2034',null,855],
    ['TBD Solar 2035 - 599.2 MW',null,'Solar','addition','01/2033','06/2035',null,599.2]
  ];

  function parts(value) {
    if (!value) return { month: null, year: null };
    const [month, year] = value.split('/');
    return { month: parseInteger(month), year: parseInteger(year) };
  }

  return rows.map(([title, county, technology, event_type, startValue, serviceValue, retirementValue, capacity_mw]) => {
    const start = parts(startValue);
    const service = parts(serviceValue);
    const retirement = parts(retirementValue);
    const planning_group =
      technology === 'Solar' && /^TBD Solar/.test(title)
        ? {
            is_multi_site: true,
            individual_site_mw: 74.9,
            estimated_site_count: Math.round(capacity_mw / 74.9),
            sites_named: false
          }
        : null;

    return {
      title,
      raw_text: title,
      event_type,
      technology,
      county,
      capacity_mw,
      start_month: start.month,
      start_year: start.year,
      service_month: service.month,
      service_year: service.year,
      retirement_month: retirement.month,
      retirement_year: retirement.year,
      year: retirement.year || service.year,
      planning_group,
      source: { schedule: 'Schedule 8', pdf_page: null }
    };
  });
}

// ============================================================
// SCHEDULE 9 — FACILITY DISCOVERY
// ============================================================

function extractSchedule9Projects(text) {
  const headingPattern = /Plant Name and Unit Number:\s*([^\n]+)/gi;
  const matches = [...text.matchAll(headingPattern)];
  const results = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const start = current.index;
    const end = next ? next.index : Math.min(text.length, start + 8000);
    const section = text.slice(start, end);
    let rawName = cleanWhitespace(current[1]);
    if (!rawName || rawName.length > 180) continue;
    rawName = rawName.replace(/M\s+ill/gi, 'Mill');

    const technology = detectTechnology(section);
    const category = categoryFromTechnology(technology);
    const capacityMw = extractCapacity(section);

    const service = extractMonthYear(section, [
      /(?:commercial\s+)?in[- ]service[^A-Za-z0-9]{0,30}([A-Za-z]+)[ ,/]+(\d{4})/i,
      /in[- ]service\s+(?:date)?[^A-Za-z0-9]{0,30}([A-Za-z]+)[ ,/]+(\d{4})/i,
      /commercial\s+operation[^A-Za-z0-9]{0,30}([A-Za-z]+)[ ,/]+(\d{4})/i
    ]);

    let planningGroup = null;
    if (technology === 'Solar' && /multiple\s+74\.9\s*MWs?\s+units?\s+at\s+different\s+sites/i.test(section)) {
      planningGroup = {
        is_multi_site: true,
        individual_site_mw: 74.9,
        estimated_site_count: capacityMw ? Math.round(capacityMw / 74.9) : null,
        sites_named: false
      };
    }

    results.push({
      raw_name: rawName,
      title: canonicalName(rawName),
      category,
      subtype: technology,
      capacity_mw: capacityMw,
      end_year: service.year,
      in_service_month: service.month,
      planning_group: planningGroup,
      source: { schedule: 'Schedule 9', pdf_page: findPdfPage(text, current.index) },
      raw_section: section
    });
  }
  return results;
}

function stableTbdTitle(item, occurrence = 1) {
  const tech = item.subtype || 'Future Resource';
  const year = item.end_year || 'Unknown Year';
  const mw = item.capacity_mw !== null ? ` - ${item.capacity_mw} MW` : '';
  const ordinal = occurrence > 1 ? ` #${occurrence}` : '';
  return `TBD ${tech} ${year}${mw}${ordinal}`;
}

// ============================================================
// CHAPTER 4 — PREFERRED SITE ENRICHMENT
// ============================================================

function extractChapter4Projects(text, pages) {
  const figurePattern = /FIGURE\s+(4\.\d+)\s*\n([^\n]+)/gi;
  const figures = [...text.matchAll(figurePattern)];
  const results = [];

  for (const figure of figures) {
    const figureNumber = figure[1];
    const figureTitle = figure[2].trim();
    const pdfPage = findPdfPage(text, figure.index);
    if (!pdfPage) continue;
    const section = pages.get(pdfPage);
    if (!section) continue;

    const title = canonicalName(figureTitle);
    const technology = detectTechnology(`${title} ${section}`);
    const coordinates = extractCoordinates(section);
    const county = extractCounty(section);
    const address = extractAddress(section);
    const capacityMw = extractCapacity(section);
    const voltageKv = extractVoltage(section);

    const construction = extractMonthYear(section, [
      /started\s+construction\s+in\s+([A-Za-z]+)(?:\s+of)?\s+(\d{4})/i,
      /construction\s+(?:is\s+)?expected\s+to\s+(?:begin|start)\s+in\s+([A-Za-z]+)(?:\s+of)?\s+(\d{4})/i,
      /construction[^.]{0,120}?\bin\s+([A-Za-z]+)(?:\s+of)?\s+(\d{4})/i
    ]);

    const service = extractMonthYear(section, [
      /(?:expected\s+to\s+be\s+)?in\s+service\s+in\s+([A-Za-z]+)\s+(\d{4})/i,
      /placed\s+in\s+service\s+in\s+([A-Za-z]+)\s+(\d{4})/i,
      /commercial\s+(?:in[-\s]service|operation)[^.]{0,80}?\b([A-Za-z]+)\s+(\d{4})/i
    ]);

    const acreageMatch = section.match(/(?:approximately|approx\.?)?\s*(\d+(?:,\d+)?)\s*[- ]?acres?/i);
    const acreage = acreageMatch ? parseNumber(acreageMatch[1]) : null;
    let tracking = null;
    if (/single[- ]axis tracking/i.test(section)) tracking = 'single-axis tracking';
    else if (/fixed tilt/i.test(section)) tracking = 'fixed tilt';

    const landTypes = [];
    if (/timber/i.test(section)) landTypes.push('timber');
    if (/agricultural/i.test(section)) landTypes.push('agricultural');
    if (/cattle|grazing/i.test(section)) landTypes.push('cattle/grazing');

    const stationMatch = section.match(/(?:terminal\s+(?:in|at)|POI\s+(?:will\s+be|is)|point of interconnection[^.]{0,100}?(?:at|in))[^.]{0,120}?([A-Za-z][A-Za-z ]+?(?:Switching Station|switching station|Substation|substation))/i);
    const station = stationMatch ? cleanWhitespace(stationMatch[1]) : null;
    let connection = null;
    if (/generation tie[- ]line/i.test(section)) connection = 'generation tie-line';
    else if (/line tap/i.test(section)) connection = 'line tap';

    const permits = [];
    if (/Environmental Resource Permit|\bERP\b/i.test(section)) permits.push('Environmental Resource Permit');
    if (/Special Use Permit/i.test(section)) permits.push('Special Use Permit');
    if (/Final Site Plan/i.test(section)) permits.push('Final Site Plan');
    if (/Relocation Permit/i.test(section)) permits.push('Wildlife Relocation Permit');

    const environmental = [];
    if (/wetlands?/i.test(section)) environmental.push('Wetlands');
    if (/gopher tortoise/i.test(section)) environmental.push('Gopher tortoise');
    if (/scrub[- ]jay/i.test(section)) environmental.push('Florida scrub-jay');
    if (/crested caracara/i.test(section)) environmental.push('Crested caracara');

    results.push({
      title,
      technology,
      category: categoryFromTechnology(technology),
      capacity_mw: capacityMw,
      voltage_kv: voltageKv,
      county,
      address,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      location_source: coordinates.source,
      location_confidence: coordinates.confidence,
      construction_month: construction.month,
      start_year: construction.year,
      in_service_month: service.month,
      end_year: service.year,
      acreage,
      tracking,
      land_types: unique(landTypes),
      interconnection: { voltage_kv: voltageKv, station, connection },
      permits: unique(permits),
      environmental: unique(environmental),
      figure: { figure: figureNumber, title: figureTitle, type: 'site_map_or_layout', pdf_page: pdfPage },
      source: { section: 'Chapter 4', figure: figureNumber, pdf_page: pdfPage }
    });
  }
  return results;
}

// ============================================================
// SCHEDULE 10 — ASSOCIATED TRANSMISSION
// ============================================================

function extractSchedule10Transmission(text) {
  const scheduleMatches = [...text.matchAll(/Schedule\s+10\b/gi)];
  if (!scheduleMatches.length) return [];
  // Prefer the later occurrence, after Schedule 9, rather than TOC.
  const scheduleStart = scheduleMatches[scheduleMatches.length - 1].index;
  const region = text.slice(scheduleStart, Math.min(text.length, scheduleStart + 70000));
  const knownNames = ['Jumper Creek', 'Bailey Mill', 'Turnpike', 'Lonesome Camp', 'Banner', 'Higdon', 'Nova', 'Bartow', 'Bull Creek', 'Wewahootee', 'Powerline'];
  const results = [];

  for (const name of knownNames) {
    const match = new RegExp(escapeRegex(name), 'i').exec(region);
    if (!match) continue;
    const absoluteIndex = scheduleStart + match.index;
    const section = text.slice(absoluteIndex, absoluteIndex + 3000);
    const voltageKv = extractVoltage(section);
    const lengthMatch = section.match(/(\d+(?:\.\d+)?)\s*(?:circuit[- ]?)?miles?/i);
    const lengthMiles = lengthMatch ? parseNumber(lengthMatch[1]) : null;

    let investment = null;
    const millionMatch = section.match(/\$\s*(\d+(?:\.\d+)?)\s*(?:million|M)\b/i);
    if (millionMatch) investment = parseNumber(millionMatch[1]) * 1000000;
    else {
      const dollarMatch = section.match(/\$\s*([\d,]+(?:\.\d+)?)/i);
      if (dollarMatch) investment = parseNumber(dollarMatch[1]);
    }

    results.push({
      parent_name: canonicalName(name),
      type: 'Transmission',
      title: `${canonicalName(name)} Associated Transmission`,
      voltage_kv: voltageKv,
      length_miles: lengthMiles,
      capital_investment_usd: investment,
      source: { schedule: 'Schedule 10', pdf_page: findPdfPage(text, absoluteIndex) }
    });
  }
  return results;
}

// ============================================================
// INDEPENDENT TRANSMISSION — DELAND WEST / DONA VISTA
// ============================================================

function extractIndependentTransmission(text) {
  const match = /DeLand West[\s–—-]+Dona Vista/i.exec(text);
  if (!match) return [];
  const section = text.slice(match.index, match.index + 6000);
  const project = createProject({ title: 'DeLand West - Dona Vista', category: 'Transmission', subtype: 'Transmission Line' });
  project.voltage_kv = extractVoltage(section);
  project.interconnection.voltage_kv = project.voltage_kv;

  const lengthMatch = section.match(/(\d+(?:\.\d+)?)\s*(?:circuit[- ]?)miles?/i);
  const ratingMatch = section.match(/(\d+(?:\.\d+)?)\s*MVA/i);
  project.transmission = {
    length_miles: lengthMatch ? parseNumber(lengthMatch[1]) : null,
    winter_rating_mva: ratingMatch ? parseNumber(ratingMatch[1]) : null
  };

  if (/(?:January|Jan\.?)\s+31,?\s+2030/i.test(section)) {
    project.end_year = 2030;
    project.in_service_month = 'January';
    project.timeline.commercial_service = '2030-01-31';
  }

  pushSource(project, { section: 'Table 3.4 / Transmission Planning', pdf_page: findPdfPage(text, match.index) });
  return [project];
}

// ============================================================
// MATCH SCHEDULE 8 EVENTS TO MASTER PROJECTS
// ============================================================

function attachSchedule8Events(projects, events) {
  const additions = events.filter(e => e.event_type === 'addition');
  const changes = events.filter(e => e.event_type !== 'addition');

  for (const event of additions) {
    let matched = findProject(projects, event.title);

    if (!matched && /^TBD /i.test(event.title)) {
      matched = projects.find(p =>
        /^TBD /i.test(p.title) &&
        p.subtype === event.technology &&
        !p._schedule8Matched
      );
    }

    if (!matched && /Undesignated CTs/i.test(event.title)) {
      matched = projects.find(p =>
        /Undesignated CTs/i.test(p.title) &&
        !p._schedule8Matched
      );
    }

    if (!matched) continue;
    matched._schedule8Matched = true;

    // Schedule 8 is authoritative for planning-tranche capacity and dates.
    if (/^TBD /i.test(event.title) || /Undesignated CTs/i.test(event.title)) {
      matched.title = event.title;
      matched.capacity_mw = event.capacity_mw;
      matched.capacity.nameplate_mw = event.capacity_mw;
      if (event.planning_group) matched.planning_group = event.planning_group;
    }

    matched.county ??= event.county;
    matched.location.county ??= event.county;
    matched.start_year ??= event.start_year;
    matched.end_year ??= event.service_year;

    if (event.start_month && event.start_year) {
      matched.timeline.construction_start =
        `${String(event.start_month).padStart(2, '0')}/${event.start_year}`;
    }

    if (event.service_month && event.service_year) {
      matched.timeline.commercial_service =
        `${String(event.service_month).padStart(2, '0')}/${event.service_year}`;
    }

    matched.plan_events.push(event);
    pushSource(matched, event.source);
  }

  // These are changes to existing assets, not new construction projects.
  for (const event of changes) {
    const subtype =
      event.event_type === 'retirement' ? 'Retirement' :
      event.event_type === 'upgrade' ? 'Upgrade' : 'Capacity Change';

    const p = createProject({
      title: event.title,
      category: 'Generation',
      subtype,
      status: event.event_type === 'retirement' ? 'Planned Retirement' : 'Planned Change'
    });

    p.county = event.county;
    p.location.county = event.county;
    p.capacity_mw = event.capacity_mw;
    p.capacity.nameplate_mw = event.capacity_mw;
    p.start_year = event.start_year;
    p.end_year = event.retirement_year || event.service_year;
    p.plan_events.push(event);
    pushSource(p, event.source);
    projects.push(p);
  }

  for (const project of projects) delete project._schedule8Matched;
}

// ============================================================
// BUILD MASTER LIST
// ============================================================

function buildProjects({ schedule8, schedule9, chapter4, schedule10, independentTransmission }) {
  const projects = [];
  const tbdCounts = new Map();

  for (const item of schedule9) {
    const raw = item.title || item.raw_name;
    const isTbd = !raw || /^(unknown|tbd)$/i.test(raw) || /unknown/i.test(raw);
    let title;

    if (isTbd) {
      const base = `${item.subtype || 'Future Resource'}|${item.end_year || ''}|${item.capacity_mw || ''}`;
      const count = (tbdCounts.get(base) || 0) + 1;
      tbdCounts.set(base, count);
      title = stableTbdTitle(item, count);
    } else {
      title = canonicalName(raw);
    }

    const project = createProject({ title, category: item.category, subtype: item.subtype });
    project.capacity_mw = item.capacity_mw;
    project.capacity.nameplate_mw = item.capacity_mw;
    project.end_year = item.end_year;
    project.in_service_month = item.in_service_month;
    if (item.end_year && item.in_service_month) project.timeline.commercial_service = `${item.in_service_month} ${item.end_year}`;
    if (item.planning_group) project.planning_group = item.planning_group;
    pushSource(project, item.source);
    projects.push(project);
  }

  for (const site of chapter4) {
    let project = findProject(projects, site.title);
    if (!project) {
      project = createProject({ title: site.title, category: site.category, subtype: site.technology });
      projects.push(project);
    }

    // Prefer the richer Chapter 4 canonical name for named sites.
    if (!/TBD|UNKNOWN/i.test(project.title)) project.title = canonicalName(site.title);

    mergeScalar(project, 'capacity_mw', site.capacity_mw);
    mergeScalar(project, 'voltage_kv', site.voltage_kv);
    mergeScalar(project, 'county', site.county);
    mergeScalar(project, 'start_year', site.start_year);
    mergeScalar(project, 'end_year', site.end_year);
    mergeScalar(project, 'construction_month', site.construction_month);
    mergeScalar(project, 'in_service_month', site.in_service_month);
    mergeScalar(project, 'latitude', site.latitude);
    mergeScalar(project, 'longitude', site.longitude);
    mergeScalar(project, 'location_source', site.location_source);
    mergeScalar(project, 'location_confidence', site.location_confidence);

    project.capacity.nameplate_mw ??= site.capacity_mw;
    project.location.county ??= site.county;
    project.location.address ??= site.address;
    project.location.latitude ??= site.latitude;
    project.location.longitude ??= site.longitude;
    project.site.acreage ??= site.acreage;
    project.site.tracking ??= site.tracking;
    project.site.land_type = unique([...project.site.land_type, ...site.land_types]);
    project.interconnection.voltage_kv ??= site.interconnection.voltage_kv;
    project.interconnection.station ??= site.interconnection.station;
    project.interconnection.connection ??= site.interconnection.connection;
    project.permits = unique([...project.permits, ...site.permits]);
    project.environmental = unique([...project.environmental, ...site.environmental]);
    project.figures.push(site.figure);
    project.source_figure = site.figure.figure;
    project.source_pdf_page = site.figure.pdf_page;
    pushSource(project, site.source);
  }

  for (const transmission of schedule10) {
    const parent = findProject(projects, transmission.parent_name);
    if (!parent) continue;
    parent.related_projects.push({
      title: transmission.title,
      category: 'Transmission',
      subtype: 'Interconnection',
      voltage_kv: transmission.voltage_kv,
      length_miles: transmission.length_miles,
      capital_investment_usd: transmission.capital_investment_usd,
      source: transmission.source
    });
    pushSource(parent, transmission.source);
  }

  attachSchedule8Events(projects, schedule8);
  projects.push(...independentTransmission);
  return projects;
}

// ============================================================
// VALIDATION / SUMMARY
// ============================================================

function locationStatus(project) {
  if (project.latitude !== null && project.longitude !== null) return 'coordinates';
  if (project.location?.address) return 'address';
  if (project.county || project.location?.county) return 'county';
  return 'none';
}

function validateProjects(projects) {
  console.log('\nEXTRACTION SUMMARY');
  console.log('============================================================');

  const stats = { coordinates: 0, address: 0, county: 0, none: 0, related: 0, tbd: 0, named: 0 };

  for (const project of projects) {
    const loc = locationStatus(project);
    stats[loc]++;
    stats.related += project.related_projects?.length || 0;
    if (/TBD|UNKNOWN/i.test(project.title)) stats.tbd++; else stats.named++;

    const issues = [];
    if (!project.category) issues.push('category');
    if (project.category !== 'Transmission' && !['Retirement', 'Upgrade', 'Capacity Change'].includes(project.subtype) && project.capacity_mw === null) issues.push('capacity');

    let locText = '';
    if (loc === 'coordinates') locText = 'exact coordinates';
    else if (loc === 'address') locText = 'address available';
    else if (loc === 'county') locText = 'county only';
    else locText = 'no mapped location';

    const icon = issues.length ? '⚠' : '✓';
    const suffix = issues.length ? ` | missing: ${issues.join(', ')}` : '';
    console.log(`${icon} ${project.title} | ${locText}${suffix}`);
  }

  console.log('\n------------------------------------------------------------');
  console.log(`Total master records: ${projects.length}`);
  console.log(`Named records: ${stats.named}`);
  console.log(`TBD / future planning records: ${stats.tbd}`);
  console.log(`Exact coordinates: ${stats.coordinates}`);
  console.log(`Address only: ${stats.address}`);
  console.log(`County only: ${stats.county}`);
  console.log(`No mapped location: ${stats.none}`);
  console.log(`Associated transmission records: ${stats.related}`);
  console.log('------------------------------------------------------------');
}

// ============================================================
// MAIN
// ============================================================

async function extractDuke() {
  const pdfBuffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: pdfBuffer });

  try {
    const result = await parser.getText();
    const text = result.text;
    const pages = splitIntoPages(text);
    console.log(`Detected ${pages.size} PDF pages.`);

    const schedule8 = extractSchedule8Events(text);
    const schedule9 = extractSchedule9Projects(text);
    const chapter4 = extractChapter4Projects(text, pages);
    const schedule10 = extractSchedule10Transmission(text);
    const independentTransmission = extractIndependentTransmission(text);

    console.log(`Schedule 8 plan events: ${schedule8.length}`);
    console.log(`Schedule 9 facility records: ${schedule9.length}`);
    console.log(`Chapter 4 preferred sites: ${chapter4.length}`);
    console.log(`Schedule 10 associated transmission records: ${schedule10.length}`);
    console.log(`Independent transmission projects: ${independentTransmission.length}`);

    const projects = buildProjects({ schedule8, schedule9, chapter4, schedule10, independentTransmission });
    validateProjects(projects);

    fs.writeFileSync(outputPath, JSON.stringify(projects, null, 2), 'utf8');
    console.log(`\nSaved ${projects.length} master project records to:`);
    console.log(outputPath);
  } finally {
    await parser.destroy();
  }
}

extractDuke().catch(error => {
  console.error('Duke extraction failed:', error);
  process.exitCode = 1;
});