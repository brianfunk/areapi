/**
 * areapi: what area is this point in? FCC market areas, cellular licenses, counties, states, CBSAs.
 *
 *   import { find } from '@brianfunk/areapi';
 *   const r = await find({ lat: 38.9907, lon: -77.0261 });
 *   r.areas -> [{ type: 'cma', id: '8', name: 'Washington, DC-MD-VA', ... }, ...]
 */

import { inFeature } from './pip.js';
import { load, loadManifest, setDataUrl } from './load.js';

export { setDataUrl };

/** Area types in display order. Keep in sync with data/manifest.json. */
export const TYPES = ['cma', 'bta', 'mta', 'ea', 'mea', 'reag', 'pea', 'rpc', 'eag', 'vpc', 'cbsa', 'county', 'state', 'cgsa'];

export const TYPE_NAMES = {
  cma: 'Cellular Market Area',
  bta: 'Basic Trading Area',
  mta: 'Major Trading Area',
  ea: 'Economic Area',
  mea: 'Major Economic Area',
  reag: 'Regional Economic Area Grouping',
  pea: 'Partial Economic Area',
  rpc: 'Regional PCS Area',
  eag: 'Economic Area Grouping',
  vpc: 'VHF Public Coast Station Area',
  cbsa: 'Core Based Statistical Area',
  county: 'County',
  state: 'State',
  cgsa: 'Cellular Geographic Service Area',
};

export class AreapiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'AreapiError';
    this.status = status;
  }
}

export function normalizeTypes(types) {
  if (types == null || types === '' || types === 'all') return [...TYPES];
  const list = Array.isArray(types) ? types : String(types).split(',');
  const out = [];
  for (const raw of list) {
    const t = String(raw).trim().toLowerCase();
    if (!t) continue;
    if (!TYPES.includes(t)) {
      throw new AreapiError(`Unknown area type "${raw}". Valid types: ${TYPES.join(', ')}`);
    }
    if (!out.includes(t)) out.push(t);
  }
  if (out.length === 0) return [...TYPES];
  return out;
}

export function normalizePoint({ lat, lon }) {
  const la = Number(lat);
  const lo = Number(lon);
  if (lat == null || lat === '' || Number.isNaN(la) || la < -90 || la > 90) {
    throw new AreapiError(`Invalid latitude "${lat}". Must be a number from -90 to 90.`);
  }
  if (lon == null || lon === '' || Number.isNaN(lo) || lo < -180 || lo > 180) {
    throw new AreapiError(`Invalid longitude "${lon}". Must be a number from -180 to 180.`);
  }
  return { lat: la, lon: lo };
}

/** All features of one type that contain the point (normally 0 or 1). */
export async function findType(type, { lat, lon }) {
  const data = await load(type);
  const hits = [];
  for (const f of data.features) {
    if (inFeature(lon, lat, f)) {
      hits.push({
        type,
        id: String(f.properties.id),
        name: f.properties.name,
        defined: data.defined ?? null,
        asOf: data.asOf ?? null,
        /** @deprecated 1.0 name for `defined`; kept through 1.x */
        vintage: data.defined ?? null,
      });
    }
  }
  return hits;
}

/**
 * @param {{lat: number|string, lon: number|string}} point
 * @param {{types?: string|string[]}} [opts]
 */
export async function find(point, opts = {}) {
  const start = now();
  const p = normalizePoint(point);
  const types = normalizeTypes(opts.types);
  const perType = await Promise.all(types.map((t) => findType(t, p)));
  const areas = perType.flat();
  return {
    status: areas.length ? 'OK' : 'NONE',
    point: p,
    types,
    areas,
    executionTime: round(now() - start),
  };
}

/** Geometry for one area, for drawing. */
export async function feature(type, id) {
  const [t] = normalizeTypes(type);
  const data = await load(t);
  return data.features.find((f) => String(f.properties.id) === String(id)) ?? null;
}

/** Manifest: counts, as-of dates, sources. */
export function types() {
  return loadManifest();
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function round(ms) {
  return Math.round(ms * 1000) / 1000;
}
