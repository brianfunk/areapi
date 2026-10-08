/**
 * Build data/<type>.json + data/manifest.json from the raw sources in data/raw/.
 *
 * Every FCC market area is a union of county-equivalents (FIPS 6-4), so we
 * dissolve county polygons by market number using the FCC's county crosswalk.
 * PEAs (defined 2014) come straight from the FCC's own PEA shapefile.
 *
 * Raw inputs (see README "Rebuilding the data" for the download commands):
 *   data/raw/co99_d00_shp.zip            Census 2000 generalized county boundaries (US + PR)
 *   data/raw/cb_2020_us_county_500k.zip  Census 2020 cartographic counties (used only for AS, GU, MP, VI in the market layers)
 *   data/raw/cb_2025_us_county_500k.zip  Census 2025 cartographic counties (the county and state types)
 *   data/raw/cb_2025_us_cbsa_500k.zip    Census 2025 cartographic CBSAs
 *   data/raw/FCCCNTY2K.txt               FCC county -> market crosswalk (CMA, BTA, MTA, EA, MEA, REA)
 *   data/raw/FCC_PEAs_Website.zip        FCC Partial Economic Areas shapefile
 *   data/raw/A_block_CGSA.json, B_block_CGSA.json   FCC Cellular Geographic Service Areas (GeoJSON, fcc.gov; browser download)
 *   data/raw/eez_iho_gulf.json           Marine Regions EEZ/IHO intersection, Gulf of Mexico (MRGID 25281 = U.S. part)
 *   scripts/names.json                   market number -> name (from ULS, see scripts/extract-names.js)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, statSync, rmSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { bboxOf } from '../src/pip.js';

const require = createRequire(import.meta.url);
const mapshaperBin = require.resolve('mapshaper/bin/mapshaper');

const SIMPLIFY = process.env.SIMPLIFY || '5%';
const PRECISION = '0.0001';
const TMP = 'data/tmp';
const names = JSON.parse(readFileSync('scripts/names.json', 'utf8'));

/** type -> crosswalk column, plus descriptive metadata */
const TYPES = {
  cma: { column: 'CMA', name: 'Cellular Market Area', defined: '1990', note: '306 MSAs (incl. Gulf of Mexico) + 428 RSAs; FCC Public Notice CL-92-40' },
  bta: { column: 'BTA', name: 'Basic Trading Area', defined: '1992', note: 'Rand McNally 1992 Commercial Atlas & Marketing Guide, 123rd ed., as modified by the FCC' },
  mta: { column: 'MTA', name: 'Major Trading Area', defined: '1992', note: 'Rand McNally 1992 Commercial Atlas & Marketing Guide, 123rd ed., as modified by the FCC' },
  ea: { column: 'EA', name: 'Economic Area', defined: '1995', note: 'BEA 1995 Economic Areas (1-172) + FCC 173-176 (Guam/NMI, PR/USVI, American Samoa, Gulf of Mexico)' },
  mea: { column: 'MEA', name: 'Major Economic Area', defined: '1995', note: '52 MEAs composed of EAs; 47 CFR 27.6' },
  reag: { column: 'REA', name: 'Regional Economic Area Grouping', defined: '1995', note: '12 REAGs composed of MEAs; 47 CFR 27.6' },
  pea: { column: null, name: 'Partial Economic Area', defined: '2014', note: '416 PEAs; FCC Public Notice DA 14-759 (GN Docket 12-268), Census 2010 counties' },
  rpc: { column: 'RPC', name: 'Regional PCS Area', defined: '1994', note: '5 regions used for narrowband PCS licensing' },
  eag: { column: 'EAG_700', name: 'Economic Area Grouping', defined: '1995', note: '6 EAGs composed of EAs, used for 220 MHz and 700 MHz guard band licensing (identical on land; the Gulf is split and not attributed here)' },
  vpc: { column: 'VPC', name: 'VHF Public Coast Station Area', defined: '1998', note: '42 VPC areas: 9 maritime regions plus 33 inland waterway areas' },
  county: { column: null, name: 'County', defined: '2025', note: 'Current county-equivalents, Census 2025 cartographic boundaries (Connecticut uses planning regions since 2022)' },
  state: { column: null, name: 'State', defined: '2025', note: 'States, DC and territories, Census 2025 cartographic boundaries' },
  cbsa: { column: null, name: 'Core Based Statistical Area', defined: '2025', note: 'OMB metropolitan and micropolitan statistical areas, Census 2025 cartographic boundaries' },
  cgsa: { column: null, name: 'Cellular Geographic Service Area', defined: 'rolling', note: 'Licensed A/B block cellular service areas (one license per feature; A and B blocks overlap), FCC WTB map data', simplify: '3%' },
};

/** Types whose names come from a NAME field in the data rather than scripts/names.json. */
const FIELD_NAMED = new Set(['county', 'state', 'cbsa', 'cgsa']);

function mapshaper(args) {
  execFileSync(process.execPath, [mapshaperBin, ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

// 1a. Territories (AS, GU, MP, VI) are missing from the Census 2000 file. Pull them
//     from the 2020 1:500k file and simplify them on their own first: the 2020 file is
//     far denser, and simplifying it together with the 2000 file skews the threshold.
mapshaper([
  '-i', 'data/raw/cb_2020_us_county_500k.zip',
  '-filter', '["60","66","69","78"].includes(STATEFP)',
  '-each', 'FIPS=GEOID',
  '-filter-fields', 'FIPS',
  '-simplify', '2%', 'keep-shapes',
  '-o', 'format=geojson', `${TMP}/terr.json`,
]);

// 1b. The crosswalk is ASCII except two stray bytes in Puerto Rico names. Re-encode
//     to UTF-8 and fix a typo so county/state names can be used directly.
const crosswalk = readFileSync('data/raw/FCCCNTY2K.txt')
  .toString('latin1')
  .replace(/\u00b1/g, 'ñ')
  .replace(/\u00df/g, 'á')
  .replace(/American Samoas/g, 'American Samoa');
writeFileSync(`${TMP}/crosswalk.csv`, crosswalk);

// 1c. County-based types: one mapshaper run, one dissolve per type on shared (simplified) arcs.
const countyTypes = Object.entries(TYPES).filter(([, t]) => t.column);
const joinFields = [...new Set(countyTypes.map(([, t]) => t.column))];
mapshaper([
  '-i', 'data/raw/co99_d00_shp.zip', `${TMP}/terr.json`, 'combine-files',
  '-each', 'FIPS=STATE+COUNTY', 'target=co99_d00',
  '-merge-layers', 'target=co99_d00,terr', 'force', 'name=counties',
  '-filter-fields', 'FIPS',
  '-join', `${TMP}/crosswalk.csv`, 'keys=FIPS,FIPS', 'string-fields=FIPS', `fields=${joinFields.join(',')}`,
  '-simplify', SIMPLIFY, 'keep-shapes',
  ...countyTypes.flatMap(([type, t]) => [
    '-dissolve', t.column, 'target=counties', '+', `name=${type}`, ...(t.copy ? [`copy-fields=${t.copy}`] : []),
    ...(t.nameExpr ? ['-each', t.nameExpr, `target=${type}`] : ['-filter', `${t.column}>0`, `target=${type}`]),
  ]),
  '-o', `target=${countyTypes.map(([k]) => k).join(',')}`, 'format=geojson', `precision=${PRECISION}`, `${TMP}/`,
]);

// 2. PEAs straight from the FCC shapefile.
mapshaper([
  '-i', 'data/raw/FCC_PEAs_Website.zip', 'name=pea',
  '-simplify', SIMPLIFY, 'keep-shapes',
  '-rename-fields', 'PEA=PEA_Num',
  '-filter-fields', 'PEA',
  '-o', 'format=geojson', `precision=${PRECISION}`, `${TMP}/pea.json`,
]);

// 2a0. Current counties and states from the Census 2025 cartographic boundary file.
mapshaper([
  '-i', 'data/raw/cb_2025_us_county_500k.zip', 'name=county',
  '-simplify', SIMPLIFY, 'keep-shapes',
  '-dissolve', 'STATEFP', 'copy-fields=STATE_NAME', '+', 'name=state',
  '-each', 'COUNTY=GEOID, NAME=NAME + ", " + STATE_NAME', 'target=county',
  '-filter-fields', 'COUNTY,NAME', 'target=county',
  '-each', 'STATE=STATEFP, NAME=STATE_NAME', 'target=state',
  '-filter-fields', 'STATE,NAME', 'target=state',
  '-o', 'target=county,state', 'format=geojson', `precision=${PRECISION}`, `${TMP}/`,
]);

// 2a. CBSAs from the Census cartographic boundary file.
mapshaper([
  '-i', 'data/raw/cb_2025_us_cbsa_500k.zip', 'name=cbsa',
  '-simplify', SIMPLIFY, 'keep-shapes',
  '-filter-fields', 'GEOID,NAMELSAD',
  '-rename-fields', 'CBSA=GEOID,NAME=NAMELSAD',
  '-filter-fields', 'CBSA,NAME',
  '-o', 'format=geojson', `precision=${PRECISION}`, `${TMP}/cbsa.json`,
]);

// 2a2. CGSA license polygons: both blocks in one layer, keyed by call sign.
const cgsaFiles = ['data/raw/A_block_CGSA.json', 'data/raw/B_block_CGSA.json'];
const cgsaMissing = cgsaFiles.filter((f) => !existsSync(f));
if (cgsaMissing.length) {
  // Both blocks are required: a partial build would silently publish half the licenses.
  throw new Error(`missing CGSA source file(s): ${cgsaMissing.join(', ')}. Download both blocks from the FCC page (see README) into data/raw/.`);
}
mapshaper([
  '-i', ...cgsaFiles, 'combine-files',
  '-merge-layers', 'force', 'name=cgsa',
  '-filter', 'VERSION === "Current"',
  '-each', 'CGSA=CALL_SIGN',
  '-filter-fields', 'CGSA,BLOCK,MARKET,AsOf',
  '-simplify', TYPES.cgsa.simplify, 'keep-shapes',
  '-o', 'format=geojson', `precision=${PRECISION}`, `${TMP}/cgsa.json`,
]);

// 2b. The Gulf of Mexico is water-only. Use the U.S. part of the Gulf from the
//     Marine Regions EEZ x IHO sea areas dataset for the four Gulf market areas.
const GULF = { cma: '306', ea: '176', mea: '52', reag: '12' };
const gulfRaw = JSON.parse(readFileSync('data/raw/eez_iho_gulf.json', 'utf8'));
const gulfFeature = gulfRaw.features.find((f) => f.properties.mrgid === 25281);
if (!gulfFeature) throw new Error('Gulf of Mexico (MRGID 25281) not found in data/raw/eez_iho_gulf.json');
writeFileSync(`${TMP}/gulf_raw.json`, JSON.stringify({ type: 'FeatureCollection', features: [gulfFeature] }));
mapshaper(['-i', `${TMP}/gulf_raw.json`, '-simplify', SIMPLIFY, 'keep-shapes', '-filter-fields', 'mrgid', '-o', 'format=geojson', `precision=${PRECISION}`, `${TMP}/gulf.json`]);
const gulfGeometry = JSON.parse(readFileSync(`${TMP}/gulf.json`, 'utf8')).features[0].geometry;

// 3. Post-process: stable ids, names, bboxes, metadata.
const manifest = {
  generated: new Date().toISOString().slice(0, 10),
  simplify: SIMPLIFY,
  precision: PRECISION,
  geometrySources: [
    'U.S. Census Bureau, Census 2000 generalized county boundaries (co99_d00)',
    'U.S. Census Bureau, 2020 cartographic boundary counties 1:500k (American Samoa, Guam, Northern Mariana Islands, U.S. Virgin Islands only)',
    'FCC, Partial Economic Areas shapefile (FCC_PEAs_Website.zip)',
    'U.S. Census Bureau, 2025 cartographic boundary counties and CBSAs 1:500k (county, state and cbsa types)',
    'FCC Wireless Telecommunications Bureau, Cellular Geographic Service Area map data (A and B block GeoJSON)',
    'Marine Regions (VLIZ), Marine and land zones: the union of world country boundaries and EEZs / IHO sea areas, "United States part of the Gulf of Mexico" (MRGID 25281), used for CMA 306, EA 176, MEA 52, REAG 12',
  ],
  crosswalk: 'FCC OET county/market cross reference FCCCNTY2K.txt',
  names: names.source,
  types: {},
};

for (const [type, t] of Object.entries(TYPES)) {
  const raw = JSON.parse(readFileSync(`${TMP}/${type}.json`, 'utf8'));
  if (type === 'cgsa') mergeByKey(raw, 'CGSA');
  const key = t.column || type.toUpperCase();
  const byId = new Map();
  const fieldNames = new Map();
  let emptyGeometry = 0;
  for (const f of raw.features) {
    if (!f.geometry) {
      emptyGeometry++;
      continue;
    }
    const id = String(f.properties[key]);
    if (byId.has(id)) throw new Error(`${type}: duplicate id ${id}`);
    byId.set(id, f.geometry);
    if (type === 'cgsa') {
      const cma = names.names.cma[String(Number(f.properties.MARKET.replace(/^CMA/, '')))] || f.properties.MARKET;
      fieldNames.set(id, `${f.properties.BLOCK} block, ${cma}`);
    } else if (FIELD_NAMED.has(type)) {
      fieldNames.set(id, f.properties.NAME);
    }
  }
  if (GULF[type] && !byId.has(GULF[type])) byId.set(GULF[type], gulfGeometry);
  const lookup = FIELD_NAMED.has(type) ? Object.fromEntries(fieldNames) : names.names[type];
  // Rolling datasets carry their own as-of date (CGSA: the FCC's "AsOf" field); fixed definitions use the build date.
  const asOf = type === 'cgsa'
    ? new Date(Math.max(...raw.features.map((f) => Number(f.properties.AsOf) || 0))).toISOString().slice(0, 10)
    : manifest.generated;
  const ids = [...byId.keys()].sort((a, b) => (Number.isNaN(Number(a)) || Number.isNaN(Number(b)) ? a.localeCompare(b) : Number(a) - Number(b)));
  const features = ids.map((id) => {
    const geometry = byId.get(id);
    const name = lookup[id];
    if (!name) throw new Error(`${type}: no name for id ${id}`);
    return { type: 'Feature', id: Number.isNaN(Number(id)) ? id : Number(id), bbox: bboxOf(geometry).map(r4), properties: { id, name }, geometry };
  });
  const allIds = Object.keys(lookup);
  const missing = allIds.filter((id) => !byId.has(id)).sort((a, b) => Number(a) - Number(b));
  const fc = {
    type: 'FeatureCollection',
    areaType: type,
    areaName: t.name,
    defined: t.defined,
    asOf,
    count: features.length,
    features,
  };
  const out = `data/${type}.json`;
  writeFileSync(out, JSON.stringify(fc));
  manifest.types[type] = {
    name: t.name,
    ...(type === 'cgsa' ? { blocks: cgsaFiles.map((f) => f.match(/([AB])_block/)[1]) } : {}),
    defined: t.defined,
    /** @deprecated 1.0 name for `defined`; kept through 1.x */
    vintage: t.defined,
    asOf,
    note: t.note,
    count: features.length,
    known: allIds.length,
    missing: missing.map((id) => ({ id, name: lookup[id] })),
    bytes: statSync(out).size,
  };
  console.log(`${type}: ${features.length}/${allIds.length} features, ${(statSync(out).size / 1024).toFixed(0)} KB, missing [${missing.join(', ')}]${emptyGeometry ? `, skipped ${emptyGeometry} with empty geometry` : ''}`);
}

writeFileSync('data/manifest.json', JSON.stringify(manifest, null, 1) + '\n');
rmSync(TMP, { recursive: true, force: true });
console.log('total', (Object.values(manifest.types).reduce((s, t) => s + t.bytes, 0) / 1024 / 1024).toFixed(2), 'MB');

/**
 * Collapse several features sharing a key into one MultiPolygon by concatenating
 * their polygons. No topological union, so self-intersecting source rings (common
 * in CGSA license polygons) survive; point-in-polygon only needs "inside any part".
 */
function mergeByKey(fc, key) {
  const groups = new Map();
  for (const f of fc.features) {
    if (!f.geometry) continue;
    const k = String(f.properties[key]);
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    if (!groups.has(k)) groups.set(k, { ...f, geometry: { type: 'MultiPolygon', coordinates: [] } });
    groups.get(k).geometry.coordinates.push(...polys);
  }
  fc.features = [...groups.values()].map((f) => (f.geometry.coordinates.length === 1 ? { ...f, geometry: { type: 'Polygon', coordinates: f.geometry.coordinates[0] } } : f));
}

function r4(n) {
  return Math.round(n * 10000) / 10000;
}
