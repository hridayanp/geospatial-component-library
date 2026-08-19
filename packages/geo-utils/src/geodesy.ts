import type { LngLat } from './types';

/** Mean Earth radius in kilometres (IUGG). */
export const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** The 16 compass points, clockwise from north. */
export const COMPASS_16 = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

export type CompassPoint = (typeof COMPASS_16)[number];

/**
 * Compass name → bearing in degrees clockwise from north.
 *
 * Accepts the short codes (`"SSW"`), the spelled-out names
 * (`"South-Southwest"`) and the unhyphenated variants (`"SOUTHSOUTHWEST"`),
 * because real-world feeds use all three.
 */
export const COMPASS_TO_DEGREES: Readonly<Record<string, number>> = (() => {
  const table: Record<string, number> = {};
  const long: Record<CompassPoint, string> = {
    N: 'NORTH',
    NNE: 'NORTH-NORTHEAST',
    NE: 'NORTHEAST',
    ENE: 'EAST-NORTHEAST',
    E: 'EAST',
    ESE: 'EAST-SOUTHEAST',
    SE: 'SOUTHEAST',
    SSE: 'SOUTH-SOUTHEAST',
    S: 'SOUTH',
    SSW: 'SOUTH-SOUTHWEST',
    SW: 'SOUTHWEST',
    WSW: 'WEST-SOUTHWEST',
    W: 'WEST',
    WNW: 'WEST-NORTHWEST',
    NW: 'NORTHWEST',
    NNW: 'NORTH-NORTHWEST',
  };
  COMPASS_16.forEach((code, i) => {
    const deg = i * 22.5;
    table[code] = deg;
    table[long[code]] = deg;
    table[long[code].replace(/-/g, '')] = deg;
  });
  // A misspelling seen in the wild for East-Northeast.
  table['EEN'] = 67.5;
  return Object.freeze(table);
})();

/** Normalise any angle into `[0, 360)`. */
export function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Parse a direction that may be a number, a compass code or a spelled-out
 * compass name into degrees clockwise from north.
 *
 * @returns The bearing in `[0, 360)`, or `null` when the input is unusable.
 */
export function parseDirection(
  value: string | number | null | undefined,
): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? normalizeDegrees(value) : null;
  }
  const key = String(value).trim().toUpperCase();
  if (key === '' || key === '—') return null;
  const direct = COMPASS_TO_DEGREES[key];
  if (direct != null) return direct;
  const compact = COMPASS_TO_DEGREES[key.replace(/[-_\s]/g, '')];
  if (compact != null) return compact;
  const parsed = Number.parseFloat(key.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? normalizeDegrees(parsed) : null;
}

/** Nearest 16-point compass label for a bearing in degrees. */
export function degreesToCompass(deg: number): CompassPoint {
  if (!Number.isFinite(deg)) return 'N';
  const index = Math.round(normalizeDegrees(deg) / 22.5) % 16;
  return COMPASS_16[index] as CompassPoint;
}

/**
 * Format a bearing the way aviation and meteorology do: three digits, zero
 * padded (`9` → `"009"`, `46` → `"046"`).
 */
export function formatDegrees(
  deg: number | string | null | undefined,
  placeholder = '—',
): string {
  if (deg == null || deg === '' || deg === placeholder) return placeholder;
  const num = typeof deg === 'number' ? deg : Number.parseFloat(String(deg));
  if (!Number.isFinite(num)) return String(deg);
  return String(normalizeDegrees(Math.round(num))).padStart(3, '0');
}

/**
 * Flip a bearing by 180°. Meteorological wind directions describe where the
 * wind comes *from*; rendering usually needs where it is going *to*.
 */
export function reverseBearing(deg: number): number {
  return normalizeDegrees(deg + 180);
}

/**
 * Split a speed and a bearing into eastward (`u`) and northward (`v`)
 * components.
 *
 * @param convention - `'towards'` treats the bearing as the direction of
 * travel; `'from'` (the meteorological default) treats it as the direction the
 * flow originates from, and negates the vector accordingly.
 */
export function speedDirectionToUV(
  speed: number,
  directionDeg: number,
  convention: 'from' | 'towards' = 'from',
): { u: number; v: number } {
  const rad = toRad(normalizeDegrees(directionDeg));
  const sign = convention === 'towards' ? 1 : -1;
  return { u: sign * speed * Math.sin(rad), v: sign * speed * Math.cos(rad) };
}

/** Inverse of {@link speedDirectionToUV}. */
export function uvToSpeedDirection(
  u: number,
  v: number,
  convention: 'from' | 'towards' = 'from',
): { speed: number; direction: number } {
  const speed = Math.hypot(u, v);
  const travel = normalizeDegrees(90 - toDeg(Math.atan2(v, u)));
  return {
    speed,
    direction: convention === 'towards' ? travel : reverseBearing(travel),
  };
}

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineDistanceKm(from: LngLat, to: LngLat): number {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial great-circle bearing from one coordinate to another, in degrees. */
export function bearingBetween(from: LngLat, to: LngLat): number {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return normalizeDegrees(toDeg(Math.atan2(y, x)));
}

/**
 * Project a point a given distance along a great-circle bearing.
 *
 * @returns `[lng, lat]`, ready for MapLibre / deck.gl consumption.
 */
export function destinationPoint(
  origin: LngLat,
  bearingDeg: number,
  distanceKm: number,
): LngLat {
  const [lng, lat] = origin;
  const φ1 = toRad(lat);
  const λ1 = toRad(lng);
  const θ = toRad(bearingDeg);
  const δ = distanceKm / EARTH_RADIUS_KM;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  return [toDeg(λ2), toDeg(φ2)];
}

/**
 * A circle of `steps` points around a centre, as a closed ring of positions —
 * handy for range rings, radius overlays and buffer approximations without
 * pulling in a full geometry library.
 */
export function circlePositions(
  center: LngLat,
  radiusKm: number,
  steps = 64,
): LngLat[] {
  const ring: LngLat[] = [];
  for (let i = 0; i < steps; i++) {
    ring.push(destinationPoint(center, (i / steps) * 360, radiusKm));
  }
  const first = ring[0];
  if (first) ring.push(first);
  return ring;
}
