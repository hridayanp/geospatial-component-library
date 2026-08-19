import { boundsFromPoints } from './bounds';
import type {
  Bounds,
  GeoJson,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GeoJsonGeometry,
  GeoJsonPosition,
  GeometryType,
  LngLat,
} from './types';

/** Geometry types that render as points. */
export const POINT_TYPES: GeometryType[] = ['Point', 'MultiPoint'];
/** Geometry types that render as lines. */
export const LINE_TYPES: GeometryType[] = ['LineString', 'MultiLineString'];
/** Geometry types that render as filled areas. */
export const POLYGON_TYPES: GeometryType[] = ['Polygon', 'MultiPolygon'];

/** `true` when the value looks like a GeoJSON FeatureCollection. */
export function isFeatureCollection(
  value: unknown,
): value is GeoJsonFeatureCollection {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { type?: string }).type === 'FeatureCollection' &&
    Array.isArray((value as { features?: unknown }).features)
  );
}

/** `true` when the value looks like a GeoJSON Feature. */
export function isFeature(value: unknown): value is GeoJsonFeature {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { type?: string }).type === 'Feature'
  );
}

/**
 * Coerce anything feature-shaped into a FeatureCollection.
 *
 * Accepts a FeatureCollection, a bare Feature, a bare geometry or an array of
 * features, so a component can take `data` from a host application without
 * insisting on one exact shape.
 */
export function toFeatureCollection(
  input: GeoJson | GeoJsonFeature[] | null | undefined,
): GeoJsonFeatureCollection {
  const empty: GeoJsonFeatureCollection = {
    type: 'FeatureCollection',
    features: [],
  };
  if (!input) return empty;
  if (Array.isArray(input)) {
    return { type: 'FeatureCollection', features: input.filter(isFeature) };
  }
  if (isFeatureCollection(input)) return input;
  if (isFeature(input)) return { type: 'FeatureCollection', features: [input] };
  if (typeof input === 'object' && 'type' in input) {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: input as GeoJsonGeometry,
          properties: {},
        },
      ],
    };
  }
  return empty;
}

/** Every feature in the input, regardless of which shape it arrived in. */
export function getFeatures(
  input: GeoJson | GeoJsonFeature[] | null | undefined,
): GeoJsonFeature[] {
  return toFeatureCollection(input).features;
}

function isPosition(value: unknown): value is GeoJsonPosition {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  );
}

/**
 * Walk every coordinate in a geometry, feature or collection.
 *
 * Iterating rather than materialising an array keeps this usable on large
 * collections without allocating a second copy of the data.
 */
export function* iterateCoordinates(
  input: GeoJson | GeoJsonFeature[] | null | undefined,
): Generator<LngLat> {
  const visit = function* (coords: unknown): Generator<LngLat> {
    if (isPosition(coords)) {
      yield [coords[0] as number, coords[1] as number];
      return;
    }
    if (Array.isArray(coords)) {
      for (const child of coords) yield* visit(child);
    }
  };

  const visitGeometry = function* (
    geometry: GeoJsonGeometry | null | undefined,
  ): Generator<LngLat> {
    if (!geometry) return;
    if (geometry.type === 'GeometryCollection') {
      for (const child of geometry.geometries ?? []) yield* visitGeometry(child);
      return;
    }
    yield* visit(geometry.coordinates);
  };

  if (!input) return;
  if (Array.isArray(input)) {
    for (const feature of input) yield* visitGeometry(feature.geometry);
    return;
  }
  if (isFeatureCollection(input)) {
    for (const feature of input.features) yield* visitGeometry(feature.geometry);
    return;
  }
  if (isFeature(input)) {
    yield* visitGeometry(input.geometry);
    return;
  }
  yield* visitGeometry(input as GeoJsonGeometry);
}

/**
 * Bounding box of any GeoJSON input.
 *
 * Honours a precomputed `bbox` member when present, otherwise walks the
 * coordinates. Returns `null` for empty input.
 */
export function geoJsonBounds(
  input: GeoJson | GeoJsonFeature[] | null | undefined,
): Bounds | null {
  if (
    input &&
    !Array.isArray(input) &&
    Array.isArray((input as { bbox?: number[] }).bbox)
  ) {
    const bbox = (input as { bbox: number[] }).bbox;
    if (bbox.length >= 4) {
      return [
        bbox[0] as number,
        bbox[1] as number,
        bbox[bbox.length - 2] as number,
        bbox[bbox.length - 1] as number,
      ];
    }
  }
  return boundsFromPoints(iterateCoordinates(input));
}

/**
 * Representative point for a geometry: the coordinate itself for points, the
 * average of the outer ring for polygons, the midpoint for lines.
 *
 * Cheaper and more forgiving of malformed rings than a true centroid, and good
 * enough for labelling, hover anchoring and camera centring.
 */
export function geometryAnchor(
  geometry: GeoJsonGeometry | null | undefined,
): LngLat | null {
  if (!geometry) return null;
  if (geometry.type === 'Point' && isPosition(geometry.coordinates)) {
    const c = geometry.coordinates;
    return [c[0] as number, c[1] as number];
  }
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  for (const [lng, lat] of iterateCoordinates(geometry)) {
    sumLng += lng;
    sumLat += lat;
    count++;
  }
  return count > 0 ? [sumLng / count, sumLat / count] : null;
}

/**
 * Copy a collection with a value written onto each feature's properties.
 *
 * Used to bake a computed style value (a colour, a normalised magnitude) into
 * the data so a renderer can drive paint properties from it without a
 * callback per frame. The input is never mutated.
 */
export function withFeatureProperty<T>(
  input: GeoJson | GeoJsonFeature[] | null | undefined,
  key: string,
  compute: (feature: GeoJsonFeature, index: number) => T,
): GeoJsonFeatureCollection {
  const collection = toFeatureCollection(input);
  return {
    ...collection,
    features: collection.features.map((feature, index) => ({
      ...feature,
      properties: {
        ...(feature.properties ?? {}),
        [key]: compute(feature, index),
      },
    })),
  };
}

/**
 * Read the first property present from a list of candidate keys.
 *
 * Real feeds spell the same quantity a dozen different ways; this keeps that
 * mess in one place instead of scattered through render code.
 */
export function pickProperty(
  properties: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): unknown {
  if (!properties) return undefined;
  for (const key of keys) {
    const value = properties[key];
    if (value != null && value !== '') return value;
  }
  return undefined;
}

/** Parse a value that may be a number or a numeric string. `null` if neither. */
export function toFiniteNumber(value: unknown): number | null {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  return typeof num === 'number' && Number.isFinite(num) ? num : null;
}
