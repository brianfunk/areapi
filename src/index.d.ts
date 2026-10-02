export type AreaType = 'cma' | 'bta' | 'mta' | 'ea' | 'mea' | 'reag' | 'pea';

export const TYPES: readonly AreaType[];
export const TYPE_NAMES: Readonly<Record<AreaType, string>>;

export interface Point {
  lat: number;
  lon: number;
}

export interface PointInput {
  lat: number | string;
  lon: number | string;
}

export interface Area {
  type: AreaType;
  /** Market number as a string, e.g. "8" */
  id: string;
  name: string;
  vintage: string | null;
}

export interface FindOptions {
  /** Subset of area types, as an array or comma-separated string. Default: all. */
  types?: AreaType | string | readonly (AreaType | string)[];
}

export interface FindResult {
  status: 'OK' | 'NONE';
  point: Point;
  types: AreaType[];
  areas: Area[];
  /** Milliseconds */
  executionTime: number;
}

export interface AreaFeature {
  type: 'Feature';
  id: number;
  bbox: [number, number, number, number];
  properties: { id: string; name: string };
  geometry: { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

export interface Manifest {
  generated: string;
  simplify: string;
  precision: string;
  geometrySources: string[];
  crosswalk: string;
  names: string;
  types: Record<AreaType, {
    name: string;
    vintage: string;
    note: string;
    count: number;
    defined: number;
    missing: { id: string; name: string }[];
    bytes: number;
  }>;
}

export class AreapiError extends Error {
  name: 'AreapiError';
  /** HTTP-style status, 400 for bad input, 404 for unknown routes. */
  status: number;
  constructor(message: string, status?: number);
}

/** Find every requested area type that contains the point. */
export function find(point: PointInput, opts?: FindOptions): Promise<FindResult>;

/** All features of one type containing the point (normally 0 or 1). */
export function findType(type: AreaType, point: Point): Promise<Area[]>;

/** GeoJSON Feature for one area, or null if the id is unknown. */
export function feature(type: AreaType | string, id: string | number): Promise<AreaFeature | null>;

/** The data manifest: counts, vintages, sources, missing ids. */
export function types(): Promise<Manifest>;

export function normalizeTypes(types?: FindOptions['types'] | null): AreaType[];
export function normalizePoint(point: PointInput): Point;

/** Browser only: base URL where <type>.json files are served from (default "data/"). */
export function setDataUrl(url: string): void;
