/**
 * Netlify Function: the areapi HTTP API.
 *
 *   GET /api/find?lat=38.99&lon=-77.03[&types=cma,bta][&format=json|xml|jsonp][&callback=fn]
 *   GET /api/:type/find?latitude=..&longitude=..          (single type)
 *   GET /api/:type/:year/find?latitude=..&longitude=..    (2017 legacy URL; year ignored)
 *   GET /api/types                                        (manifest)
 *
 * netlify.toml rewrites all of those to this function with the path preserved.
 */
import { find, types, AreapiError, TYPES } from '../../src/index.js';
import { format } from '../../src/format.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(request.url);
  const q = url.searchParams;
  const fmt = q.get('format') || 'json';
  const callback = q.get('callback') || 'callback';

  try {
    const route = parseRoute(url.pathname);
    if (route.kind === 'types') return json(await types(), 200, 86400);

    const lat = q.get('lat') ?? q.get('latitude');
    const lon = q.get('lon') ?? q.get('lng') ?? q.get('longitude');
    const typeList = route.type ?? q.get('types') ?? q.get('type');
    const result = await find({ lat, lon }, { types: typeList });
    const { body, contentType } = format(result, fmt, callback);
    return new Response(body, { status: 200, headers: { ...CORS, 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' } });
  } catch (err) {
    const status = err instanceof AreapiError ? err.status : 500;
    const payload = { status: 'ERROR', error: status === 500 ? 'Internal error' : err.message };
    if (status === 500) console.error(err);
    const { body, contentType } = format(payload, fmt, callback);
    return new Response(body, { status, headers: { ...CORS, 'Content-Type': contentType } });
  }
}

export function parseRoute(pathname) {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  // parts[0] === 'api'
  if (parts[1] === 'types' && parts.length === 2) return { kind: 'types' };
  if (parts[1] === 'find' && parts.length === 2) return { kind: 'find', type: null };
  if (parts.length === 3 && parts[2] === 'find') return { kind: 'find', type: parts[1] };
  if (parts.length === 4 && parts[3] === 'find') return { kind: 'find', type: parts[1] }; // legacy /api/:type/:year/find
  throw new AreapiError(`Unknown route ${pathname}. Try /api/find?lat=..&lon=.. or /api/types (types: ${TYPES.join(', ')})`, 404);
}

function json(obj, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${maxAge}` },
  });
}

export const config = { path: ['/api', '/api/*'] };
