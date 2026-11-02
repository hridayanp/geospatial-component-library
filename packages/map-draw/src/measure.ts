import {
  EARTH_RADIUS_KM,
  geometryAnchor,
  haversineDistanceKm,
  type GeoJsonFeature,
  type GeoJsonGeometry,
  type LngLat,
} from '@hridayanp/geo-utils';

/** Geodesic measurements of one drawn feature. Absent keys do not apply. */
export interface FeatureMeasurement {
  /** Enclosed area in km² (polygons, rectangles, circles). */
  areaKm2?: number;
  /** Boundary length in km (polygons, rectangles, circles). */
  perimeterKm?: number;
  /** Path length in km (lines). */
  lengthKm?: number;
  /** Radius in km (circles drawn with the circle tool). */
  radiusKm?: number;
  /** Centre or representative point. */
  center?: LngLat;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Area of a ring on the sphere, in km².
 *
 * Uses the line-integral form of spherical excess — the same approach as
 * `@turf/area` — which stays accurate for continental shapes where a planar
 * shoelace formula on degrees would be off by the cosine of the latitude.
 */
export function ringAreaKm2(ring: readonly LngLat[]): number {
  if (ring.length < 3) return 0;
  return Math.abs(sphericalRingArea(ring));
}

/** Signed spherical area; the sign encodes winding order. */
function sphericalRingArea(ring: readonly LngLat[]): number {
  const n = ring.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const lower = ring[i]!;
    const middle = ring[(i + 1) % n]!;
    const upper = ring[(i + 2) % n]!;
    sum += (toRad(upper[0]) - toRad(lower[0])) * Math.sin(toRad(middle[1]));
  }
  return (sum * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2;
}

/** Length of a path along great circles, in km. */
export function pathLengthKm(path: readonly LngLat[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversineDistanceKm(path[i - 1]!, path[i]!);
  }
  return total;
}

const asPath = (value: unknown): LngLat[] =>
  Array.isArray(value)
    ? value
        .filter((p): p is number[] => Array.isArray(p) && p.length >= 2)
        .map((p) => [p[0]!, p[1]!] as LngLat)
    : [];

function polygonArea(rings: unknown): { area: number; perimeter: number } {
  if (!Array.isArray(rings) || rings.length === 0) return { area: 0, perimeter: 0 };
  const [outer, ...holes] = rings.map(asPath);
  let area = ringAreaKm2(outer!);
  for (const hole of holes) area -= ringAreaKm2(hole);
  return { area: Math.max(0, area), perimeter: pathLengthKm(outer!) };
}

/**
 * Measure a GeoJSON geometry geodesically: area and perimeter for polygons,
 * length for lines.
 */
export function measureGeometry(geometry: GeoJsonGeometry | null): FeatureMeasurement {
  if (!geometry) return {};
  const anchor = geometryAnchor(geometry);
  const center = anchor ? { center: anchor } : {};
  switch (geometry.type) {
    case 'Polygon': {
      const { area, perimeter } = polygonArea(geometry.coordinates);
      return { areaKm2: area, perimeterKm: perimeter, ...center };
    }
    case 'MultiPolygon': {
      let areaKm2 = 0;
      let perimeterKm = 0;
      for (const polygon of (geometry.coordinates as unknown[]) ?? []) {
        const { area, perimeter } = polygonArea(polygon);
        areaKm2 += area;
        perimeterKm += perimeter;
      }
      return { areaKm2, perimeterKm, ...center };
    }
    case 'LineString':
      return { lengthKm: pathLengthKm(asPath(geometry.coordinates)), ...center };
    case 'MultiLineString':
      return {
        lengthKm: ((geometry.coordinates as unknown[]) ?? []).reduce<number>(
          (sum, line) => sum + pathLengthKm(asPath(line)),
          0,
        ),
        ...center,
      };
    default:
      return center;
  }
}

/**
 * Measure a drawn feature. Circles drawn with the circle tool also report their
 * radius, which a polygon approximation alone would not reveal.
 */
export function measureFeature(feature: GeoJsonFeature): FeatureMeasurement {
  const measurement = measureGeometry(feature.geometry);
  const radius = feature.properties?.['radiusKilometers'];
  if (typeof radius === 'number' && Number.isFinite(radius)) {
    measurement.radiusKm = radius;
  }
  return measurement;
}

/** Human-readable area, switching to m² or ha for small shapes. */
export function formatArea(km2: number): string {
  if (km2 < 0.01) return `${Math.round(km2 * 1e6).toLocaleString()} m²`;
  if (km2 < 1) return `${(km2 * 100).toFixed(1)} ha`;
  return `${km2 < 100 ? km2.toFixed(2) : Math.round(km2).toLocaleString()} km²`;
}

/** Human-readable distance, switching to metres below one kilometre. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000).toLocaleString()} m`;
  return `${km < 100 ? km.toFixed(2) : Math.round(km).toLocaleString()} km`;
}
