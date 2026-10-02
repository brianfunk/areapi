/**
 * Build data/<type>.json + data/manifest.json from the raw sources in data/raw/.
 *
 * Every FCC market area is a union of county-equivalents (FIPS 6-4), so we
 * dissolve county polygons by market number using the FCC's county crosswalk.
 * PEAs (defined 2014) come straight from the FCC's own PEA shapefile.
 *
 * Raw inputs (see README "Rebuilding the data" for the download commands):
 *   data/raw/co99_d00_shp.zip            Census 2000 generalized county boundaries (US + PR)
 *   data/raw/cb_2020_us_county_500k.zip  Census 2020 cartographic counties (used only for AS, GU, MP, VI)
 *   data/raw/FCCCNTY2K.txt               FCC county -> market crosswalk (CMA, BTA, MTA, EA, MEA, REA)
 *   data/raw/FCC_PEAs_Website.zip        FCC Partial Economic Areas shapefile
 *   data/raw/eez_iho_gulf.json           Marine Regions EEZ/IHO intersection, Gulf of Mexico (MRGID 25281 = U.S. part)
 *   scripts/names.json                   market number -> name (from ULS, see scripts/extract-names.js)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs';
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
  cma: { column: 'CMA', name: 'Cellular Market Area', vintage: '1990', note: '306 MSAs (incl. Gulf of Mexico) + 428 RSAs; FCC Public Notice CL-92-40' },
  bta: { column: 'BTA', name: 'Basic Trading Area', vintage: '1992', note: 'Rand McNally 1992 Commercial Atlas & Marketing Guide, 123rd ed., as modified by the FCC' },
  mta: { column: 'MTA', name: 'Major Trading Area', vintage: '1992', note: 'Rand McNally 1992 Commercial Atlas & Marketing Guide, 123rd ed., as modified by the FCC' },
  ea: { column: 'EA', name: 'Economic Area', vintage: '1995', note: 'BEA 1995 Economic Areas (1-172) + FCC 173-176 (Guam/NMI, PR/USVI, American Samoa, Gulf of Mexico)' },
  mea: { column: 'MEA', name: 'Major Economic Area', vintage: '1995', note: '52 MEAs composed of EAs; 47 CFR 27.6' },
  reag: { column: 'REA', name: 'Regional Economic Area Grouping', vintage: '1995', note: '12 REAGs composed of MEAs; 47 CFR 27.6' },
  pea: { column: null, name: 'Partial Economic Area', vintage: '2014', note: '416 PEAs; FCC Public Notice DA 14-759 (GN Docket 12-268), Census 2010 counties' },
};

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

// 1b. County-based types: one mapshaper run, six dissolves on shared (simplified) arcs.
const countyTypes = Object.entries(TYPES).filter(([, t]) => t.column);
mapshaper([
  '-i', 'data/raw/co99_d00_shp.zip', `${TMP}/terr.json`, 'combine-files',
  '-each', 'FIPS=STATE+COUNTY', 'target=co99_d00',
  '-merge-layers', 'target=co99_d00,terr', 'force', 'name=counties',
  '-filter-fields', 'FIPS',
  '-join', 'data/raw/FCCCNTY2K.txt', 'keys=FIPS,FIPS', 'string-fields=FIPS', `fields=${countyTypes.map(([, t]) => t.column).join(',')}`,
  '-simplify', SIMPLIFY, 'keep-shapes',
  ...countyTypes.flatMap(([type, t]) => ['-dissolve', t.column, 'target=counties', '+', `name=${type}`, '-filter', `${t.column}>0`, `target=${type}`]),
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
    'Marine Regions (VLIZ), Marine and land zones: the union of world country boundaries and EEZs / IHO sea areas, "United States part of the Gulf of Mexico" (MRGID 25281), used for CMA 306, EA 176, MEA 52, REAG 12',
  ],
  crosswalk: 'FCC OET county/market cross reference FCCCNTY2K.txt',
  names: names.source,
  types: {},
};

for (const [type, t] of Object.entries(TYPES)) {
  const raw = JSON.parse(readFileSync(`${TMP}/${type}.json`, 'utf8'));
  const key = t.column || 'PEA';
  const byId = new Map();
  for (const f of raw.features) {
    const id = String(f.properties[key]);
    if (byId.has(id)) throw new Error(`${type}: duplicate id ${id}`);
    byId.set(id, f.geometry);
  }
  if (GULF[type] && !byId.has(GULF[type])) byId.set(GULF[type], gulfGeometry);
  const ids = [...byId.keys()].sort((a, b) => Number(a) - Number(b));
  const features = ids.map((id) => {
    const geometry = byId.get(id);
    const name = names.names[type][id];
    if (!name) throw new Error(`${type}: no name for id ${id}`);
    return { type: 'Feature', id: Number(id), bbox: bboxOf(geometry).map(r4), properties: { id, name }, geometry };
  });
  const allIds = Object.keys(names.names[type]);
  const missing = allIds.filter((id) => !byId.has(id)).sort((a, b) => Number(a) - Number(b));
  const fc = {
    type: 'FeatureCollection',
    areaType: type,
    areaName: t.name,
    vintage: t.vintage,
    count: features.length,
    features,
  };
  const out = `data/${type}.json`;
  writeFileSync(out, JSON.stringify(fc));
  manifest.types[type] = {
    name: t.name,
    vintage: t.vintage,
    note: t.note,
    count: features.length,
    defined: allIds.length,
    missing: missing.map((id) => ({ id, name: names.names[type][id] })),
    bytes: statSync(out).size,
  };
  console.log(`${type}: ${features.length}/${allIds.length} features, ${(statSync(out).size / 1024).toFixed(0)} KB, missing [${missing.join(', ')}]`);
}

writeFileSync('data/manifest.json', JSON.stringify(manifest, null, 1) + '\n');
rmSync(TMP, { recursive: true, force: true });
console.log('total', (Object.values(manifest.types).reduce((s, t) => s + t.bytes, 0) / 1024 / 1024).toFixed(2), 'MB');

function r4(n) {
  return Math.round(n * 10000) / 10000;
}
