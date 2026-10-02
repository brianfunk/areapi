import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler, { parseRoute } from '../netlify/functions/find.js';

const get = (path) => handler(new Request(`https://areapi.netlify.app${path}`, { method: 'GET' }));

test('function: /api/find json', async () => {
  const res = await get('/api/find?lat=38.9907&lon=-77.0261&types=cma,bta');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /json/);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  const body = await res.json();
  assert.equal(body.status, 'OK');
  assert.deepEqual(body.areas.map((a) => a.id), ['8', '461']);
});

test('function: single-type and legacy routes', async () => {
  const a = await (await get('/api/bta/find?latitude=38.9907&longitude=-77.0261')).json();
  assert.deepEqual(a.areas.map((x) => x.id), ['461']);
  const b = await (await get('/api/cma/1990/find?latitude=38.9907&longitude=-77.0261&format=json')).json();
  assert.deepEqual(b.areas.map((x) => x.id), ['8']);
});

test('function: xml and jsonp', async () => {
  const xml = await get('/api/find?lat=38.9907&lon=-77.0261&types=cma&format=xml');
  assert.match(xml.headers.get('content-type'), /xml/);
  assert.match(await xml.text(), /<id>8<\/id>/);
  const jsonp = await get('/api/find?lat=38.9907&lon=-77.0261&types=cma&format=jsonp&callback=cb');
  assert.match(jsonp.headers.get('content-type'), /javascript/);
  assert.match(await jsonp.text(), /^\/\*\*\/ typeof cb === 'function' && cb\(\{/);
});

test('function: errors', async () => {
  const bad = await get('/api/find?lat=95&lon=0');
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).status, 'ERROR');
  const unknown = await get('/api/zip/find?lat=1&lon=1');
  assert.equal(unknown.status, 400);
  const route = await get('/api/nope');
  assert.equal(route.status, 404);
  assert.throws(() => parseRoute('/api/a/b/c/d/e'));
});

test('function: /api/types', async () => {
  const res = await get('/api/types');
  assert.equal(res.status, 200);
  assert.ok((await res.json()).types.cma.count > 700);
});
