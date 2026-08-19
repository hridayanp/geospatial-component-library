import type { Bounds, ImageCorners, LngLat } from './types';

/** Clamp a latitude into the range MapLibre's Web Mercator projection supports. */
export const MERCATOR_MAX_LATITUDE = 85.051129;

/** `true` when the value is a well-formed `[west, south, east, north]` tuple. */
export function isBounds(value: unknown): value is Bounds {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

/** Normalise a longitude into `(-180, 180]`. */
export function wrapLongitude(lng: number): number {
  if (lng > -180 && lng <= 180) return lng;
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

/** Clamp a latitude to the Web Mercator limits. */
export function clampLatitude(
  lat: number,
  limit: number = MERCATOR_MAX_LATITUDE,
): number {
  return Math.min(limit, Math.max(-limit, lat));
}

/** Width of a bounding box in degrees of longitude. */
export function boundsWidth(bounds: Bounds): number {
  return bounds[2] - bounds[0];
}

/** Height of a bounding box in degrees of latitude. */
export function boundsHeight(bounds: Bounds): number {
  return bounds[3] - bounds[1];
}

/** Geometric centre of a bounding box as `[lng, lat]`. */
export function boundsCenter(bounds: Bounds): LngLat {
  return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
}

/** `true` when the point falls inside (or on the edge of) the bounds. */
export function boundsContain(bounds: Bounds, point: LngLat): boolean {
  const [lng, lat] = point;
  return (
    lng >= bounds[0] && lng <= bounds[2] && lat >= bounds[1] && lat <= bounds[3]
  );
}

/** Smallest box containing both inputs. */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ];
}

/** Overlapping region of two boxes, or `null` when they are disjoint. */
export function intersectBounds(a: Bounds, b: Bounds): Bounds | null {
  const west = Math.max(a[0], b[0]);
  const south = Math.max(a[1], b[1]);
  const east = Math.min(a[2], b[2]);
  const north = Math.min(a[3], b[3]);
  if (west > east || south > north) return null;
  return [west, south, east, north];
}

/**
 * Grow (or, with a negative value, shrink) a box by a fraction of its own size.
 * `padBounds(b, 0.1)` adds a 10% margin on every side.
 */
export function padBounds(bounds: Bounds, fraction: number): Bounds {
  const dx = boundsWidth(bounds) * fraction;
  const dy = boundsHeight(bounds) * fraction;
  return [bounds[0] - dx, bounds[1] - dy, bounds[2] + dx, bounds[3] + dy];
}

/** Build a box centred on a point, sized in degrees. */
export function boundsFromCenter(
  center: LngLat,
  widthDeg: number,
  heightDeg: number = widthDeg,
): Bounds {
  const [lng, lat] = center;
  return [
    lng - widthDeg / 2,
    lat - heightDeg / 2,
    lng + widthDeg / 2,
    lat + heightDeg / 2,
  ];
}

/** Tightest box containing every supplied coordinate. */
export function boundsFromPoints(points: Iterable<LngLat>): Bounds | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  let seen = false;
  for (const [lng, lat] of points) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    seen = true;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return seen ? [west, south, east, north] : null;
}

/**
 * Convert `[west, south, east, north]` into the four corner coordinates a
 * MapLibre `image` source expects (top-left → top-right → bottom-right →
 * bottom-left).
 */
export function boundsToImageCorners(bounds: Bounds): ImageCorners {
  const [west, south, east, north] = bounds;
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

/** Inverse of {@link boundsToImageCorners}. */
export function imageCornersToBounds(corners: ImageCorners): Bounds {
  const lngs = corners.map((c) => c[0]);
  const lats = corners.map((c) => c[1]);
  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
}

/**
 * The zoom level at which `bounds` exactly fills a viewport of the given pixel
 * size. Useful for `fitBounds`-style behaviour without a map instance.
 *
 * @param tileSize - Basemap tile size in pixels. 512 for most vector styles.
 */
export function boundsToZoom(
  bounds: Bounds,
  viewportWidth: number,
  viewportHeight: number,
  tileSize = 512,
): number {
  const worldWidth = Math.max(1e-9, boundsWidth(bounds) / 360);
  const latFraction =
    (mercatorY(clampLatitude(bounds[1])) - mercatorY(clampLatitude(bounds[3]))) /
    Math.PI /
    2;
  const lngZoom = Math.log2(viewportWidth / tileSize / worldWidth);
  const latZoom = Math.log2(viewportHeight / tileSize / Math.max(1e-9, latFraction));
  return Math.min(lngZoom, latZoom);
}

function mercatorY(lat: number): number {
  const s = Math.sin((lat * Math.PI) / 180);
  return Math.log((1 + s) / (1 - s)) / 2;
}
