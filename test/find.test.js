import { test } from 'node:test';
import assert from 'node:assert/strict';
import { find, feature, types, normalizeTypes, normalizePoint, TYPES, AreapiError } from '../src/index.js';

const DC = { lat: 38.9907, lon: -77.0261 };

test('find: Washington DC hits every type', async () => {
  const r = await find(DC);
  assert.equal(r.status, 'OK');
  assert.deepEqual(r.types, TYPES);
  const byType = Object.fromEntries(r.areas.map((a) => [a.type, a]));
  assert.equal(byType.cma.id, '8');
  assert.match(byType.cma.name, /^Washington, DC/);
  assert.equal(byType.bta.id, '461');
  assert.equal(byType.mta.id, '10');
  assert.equal(byType.ea.id, '13');
  assert.equal(byType.mea.id, '5');
  assert.equal(byType.reag.id, '2');
  assert.equal(byType.pea.id, '5');
  assert.equal(r.areas.length, 7, 'exactly one hit per type');
  assert.equal(typeof r.executionTime, 'number');
});

test('find: subset of types, string or array', async () => {
  const a = await find(DC, { types: 'cma,bta' });
  assert.deepEqual(a.areas.map((x) => x.type), ['cma', 'bta']);
  const b = await find(DC, { types: ['BTA'] });
  assert.deepEqual(b.areas.map((x) => x.id), ['461']);
});

test('find: Denver', async () => {
  const r = await find({ lat: 39.7294, lon: -104.8319 }, { types: 'cma,bta,mta' });
  const ids = Object.fromEntries(r.areas.map((a) => [a.type, a.name]));
  assert.match(ids.cma, /Denver/);
  assert.match(ids.bta, /Denver/);
  assert.match(ids.mta, /Denver/);
});

test('find: territories are covered', async () => {
  const guam = await find({ lat: 13.45, lon: 144.75 }, { types: 'cma,bta,mta,ea' });
  assert.equal(guam.areas.find((a) => a.type === 'bta').id, '490');
  const samoa = await find({ lat: -14.27, lon: -170.7 }, { types: 'cma' });
  assert.match(samoa.areas[0].name, /American Samoa/);
  const usvi = await find({ lat: 18.35, lon: -64.93 }, { types: 'bta' });
  assert.equal(usvi.areas[0].id, '491');
});

test('find: open ocean is NONE', async () => {
  const r = await find({ lat: 30, lon: -45 });
  assert.equal(r.status, 'NONE');
  assert.deepEqual(r.areas, []);
});

test('find: string inputs are coerced', async () => {
  const r = await find({ lat: '38.9907', lon: '-77.0261' }, { types: 'cma' });
  assert.equal(r.areas[0].id, '8');
  assert.deepEqual(r.point, DC);
});

test('validation errors', async () => {
  await assert.rejects(find({ lat: 95, lon: 0 }), AreapiError);
  await assert.rejects(find({ lat: 0, lon: -181 }), AreapiError);
  await assert.rejects(find({ lat: 'x', lon: 0 }), AreapiError);
  await assert.rejects(find({}), AreapiError);
  await assert.rejects(find(DC, { types: 'zip' }), /Unknown area type/);
  assert.throws(() => normalizeTypes('cma,nope'), AreapiError);
  assert.deepEqual(normalizeTypes(' CMA , bta,cma'), ['cma', 'bta']);
  assert.deepEqual(normalizeTypes(undefined), TYPES);
  assert.deepEqual(normalizeTypes('all'), TYPES);
  assert.deepEqual(normalizePoint({ lat: '1', lon: '2' }), { lat: 1, lon: 2 });
});

test('feature: returns geometry by id', async () => {
  const f = await feature('cma', 8);
  assert.equal(f.properties.name.startsWith('Washington'), true);
  assert.ok(['Polygon', 'MultiPolygon'].includes(f.geometry.type));
  assert.equal(f.bbox.length, 4);
  assert.equal(await feature('cma', 99999), null);
});

test('types: manifest lists every type with counts', async () => {
  const m = await types();
  for (const t of TYPES) assert.ok(m.types[t].count > 0, t);
  assert.equal(m.types.bta.count, 493);
  assert.equal(m.types.pea.count, 416);
});
