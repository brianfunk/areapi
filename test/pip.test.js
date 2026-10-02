import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRing, inPolygon, inGeometry, inFeature, inBbox, bboxOf } from '../src/pip.js';

const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
const hole = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];
// U shape: concave
const uShape = [[0, 0], [10, 0], [10, 10], [7, 10], [7, 3], [3, 3], [3, 10], [0, 10], [0, 0]];

test('inRing: simple square', () => {
  assert.equal(inRing(5, 5, square), true);
  assert.equal(inRing(11, 5, square), false);
  assert.equal(inRing(-1, -1, square), false);
});

test('inRing: edge and vertex count as inside', () => {
  assert.equal(inRing(0, 5, square), true);
  assert.equal(inRing(10, 10, square), true);
  assert.equal(inRing(5, 0, square), true);
});

test('inRing: concave shape', () => {
  assert.equal(inRing(5, 1, uShape), true); // bottom bar
  assert.equal(inRing(5, 7, uShape), false); // notch
  assert.equal(inRing(1, 7, uShape), true); // left arm
  assert.equal(inRing(9, 7, uShape), true); // right arm
});

test('inPolygon: hole excludes', () => {
  const rings = [square, hole];
  assert.equal(inPolygon(2, 2, rings), true);
  assert.equal(inPolygon(5, 5, rings), false);
  assert.equal(inPolygon(12, 5, rings), false);
});

test('inGeometry: MultiPolygon any part', () => {
  const geom = {
    type: 'MultiPolygon',
    coordinates: [[square], [[[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]]],
  };
  assert.equal(inGeometry(5, 5, geom), true);
  assert.equal(inGeometry(25, 25, geom), true);
  assert.equal(inGeometry(15, 15, geom), false);
  assert.equal(inGeometry(5, 5, { type: 'Point', coordinates: [5, 5] }), false);
  assert.equal(inGeometry(5, 5, null), false);
});

test('inFeature: bbox prefilter short-circuits', () => {
  const feature = { bbox: [0, 0, 10, 10], geometry: { type: 'Polygon', coordinates: [square] } };
  assert.equal(inFeature(5, 5, feature), true);
  assert.equal(inFeature(50, 50, feature), false);
  // Wrong bbox proves the prefilter is consulted.
  const lying = { bbox: [100, 100, 110, 110], geometry: { type: 'Polygon', coordinates: [square] } };
  assert.equal(inFeature(5, 5, lying), false);
});

test('inBbox and bboxOf', () => {
  assert.equal(inBbox(5, 5, [0, 0, 10, 10]), true);
  assert.equal(inBbox(10, 10, [0, 0, 10, 10]), true);
  assert.equal(inBbox(10.1, 5, [0, 0, 10, 10]), false);
  assert.deepEqual(bboxOf({ type: 'Polygon', coordinates: [uShape] }), [0, 0, 10, 10]);
  assert.deepEqual(
    bboxOf({ type: 'MultiPolygon', coordinates: [[square], [[[20, 20], [30, 25], [20, 20]]]] }),
    [0, 0, 30, 25],
  );
});
