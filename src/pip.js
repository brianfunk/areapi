/**
 * Point-in-polygon for GeoJSON geometries. Ray casting, no dependencies.
 *
 * Coordinates are [lon, lat] as in GeoJSON. A point on an edge is treated as
 * inside, which is what you want for "which market am I in" (never "none"
 * just because you stood exactly on a county line).
 */

/** @param {number[]} bbox [minX, minY, maxX, maxY] */
export function inBbox(x, y, bbox) {
  return x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3];
}

/** Is (x, y) inside a single linear ring? Even-odd rule. */
export function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    // Edge touch: treat as inside.
    if (onSegment(x, y, xi, yi, xj, yj)) return true;
    const crosses = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function onSegment(px, py, ax, ay, bx, by) {
  const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  if (Math.abs(cross) > 1e-12) return false;
  return (
    px >= Math.min(ax, bx) - 1e-12 &&
    px <= Math.max(ax, bx) + 1e-12 &&
    py >= Math.min(ay, by) - 1e-12 &&
    py <= Math.max(ay, by) + 1e-12
  );
}

/** Polygon = [outerRing, ...holes]. Inside outer and not inside any hole. */
export function inPolygon(x, y, rings) {
  if (!inRing(x, y, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (inRing(x, y, rings[i])) return false;
  }
  return true;
}

/** Any GeoJSON Polygon or MultiPolygon geometry. */
export function inGeometry(x, y, geometry) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return inPolygon(x, y, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((rings) => inPolygon(x, y, rings));
  }
  return false;
}

/** Feature with optional precomputed bbox. */
export function inFeature(x, y, feature) {
  if (feature.bbox && !inBbox(x, y, feature.bbox)) return false;
  return inGeometry(x, y, feature.geometry);
}

/** Compute a [minX, minY, maxX, maxY] bbox for a Polygon/MultiPolygon. */
export function bboxOf(geometry) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const rings of polys) {
    for (const [x, y] of rings[0]) {
      if (x < b[0]) b[0] = x;
      if (y < b[1]) b[1] = y;
      if (x > b[2]) b[2] = x;
      if (y > b[3]) b[3] = y;
    }
  }
  return b;
}
