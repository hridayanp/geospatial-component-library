import type { LngLat } from '@hridayanp/geo-utils';

/** Notation for a formatted coordinate. */
export type CoordinateFormat =
  /** `9.80°N 75.90°E` */
  | 'decimal'
  /** `9°48′00″N 75°54′00″E` — degrees, minutes, seconds */
  | 'dms'
  /** `9°48.00′N 75°54.00′E` — degrees and decimal minutes */
  | 'ddm'
  /** `9.8000, 75.9000` — signed decimal, latitude first */
  | 'signed';

export interface FormatCoordinateOptions {
  format?: CoordinateFormat;
  /**
   * Decimal places on the last component: degrees for `'decimal'` and
   * `'signed'`, minutes for `'ddm'`, seconds for `'dms'`. Default `2`, `4`,
   * `2` and `0` respectively.
   */
  precision?: number;
}

const DEFAULT_PRECISION: Record<CoordinateFormat, number> = {
  decimal: 2,
  signed: 4,
  ddm: 2,
  dms: 0,
};

function formatAxis(
  value: number,
  positive: string,
  negative: string,
  { format = 'decimal', precision }: FormatCoordinateOptions,
): string {
  const places = precision ?? DEFAULT_PRECISION[format];
  if (format === 'signed') return value.toFixed(places);

  const hemisphere = value < 0 ? negative : positive;
  const absolute = Math.abs(value);

  if (format === 'decimal') return `${absolute.toFixed(places)}°${hemisphere}`;

  let degrees = Math.floor(absolute);
  let minutes = (absolute - degrees) * 60;

  if (format === 'ddm') {
    // Rounding 59.999′ to two places gives 60.00′; carry it into the degrees.
    if (Number.parseFloat(minutes.toFixed(places)) >= 60) {
      degrees += 1;
      minutes = 0;
    }
    return `${degrees}°${minutes.toFixed(places).padStart(places > 0 ? places + 3 : 2, '0')}′${hemisphere}`;
  }

  let wholeMinutes = Math.floor(minutes);
  let seconds = (minutes - wholeMinutes) * 60;
  if (Number.parseFloat(seconds.toFixed(places)) >= 60) {
    seconds = 0;
    wholeMinutes += 1;
  }
  if (wholeMinutes >= 60) {
    wholeMinutes = 0;
    degrees += 1;
  }
  const secondsText = seconds.toFixed(places).padStart(places > 0 ? places + 3 : 2, '0');
  return `${degrees}°${String(wholeMinutes).padStart(2, '0')}′${secondsText}″${hemisphere}`;
}

/** Format a latitude alone: `9.80°N`. */
export function formatLatitude(lat: number, options: FormatCoordinateOptions = {}): string {
  return formatAxis(lat, 'N', 'S', options);
}

/** Format a longitude alone: `75.90°E`. */
export function formatLongitude(lng: number, options: FormatCoordinateOptions = {}): string {
  return formatAxis(lng, 'E', 'W', options);
}

/**
 * Format a position for display, **latitude first** — the order people read
 * and say coordinates in, and the opposite of GeoJSON's `[lng, lat]`.
 *
 * ```ts
 * formatLatLon([75.9, 9.8]);                       // "9.80°N 75.90°E"
 * formatLatLon([75.9, 9.8], { format: 'dms' });    // "9°48′00″N 75°54′00″E"
 * ```
 */
export function formatLatLon(
  [lng, lat]: LngLat,
  options: FormatCoordinateOptions = {},
): string {
  const separator = options.format === 'signed' ? ', ' : ' ';
  return `${formatLatitude(lat, options)}${separator}${formatLongitude(lng, options)}`;
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

/** One parsed axis value and the hemisphere letter it carried, if any. */
interface AxisToken {
  value: number;
  hemisphere: 'N' | 'S' | 'E' | 'W' | null;
}

const NUMBER = /[+-]?\d+(?:\.\d+)?/g;
const DEGREE_MARK = /^\s*[°º˚]/;

/** Degrees, minutes and seconds from the numbers in one axis chunk. */
function axisValue(numbers: number[]): number | null {
  if (numbers.length === 0 || numbers.length > 3) return null;
  const [degrees, minutes = 0, seconds = 0] = numbers as [number, number?, number?];
  if (minutes < 0 || seconds < 0 || minutes >= 60 || seconds >= 60) return null;
  if (numbers.length > 1 && !Number.isInteger(degrees)) return null;
  const sign = degrees < 0 || Object.is(degrees, -0) ? -1 : 1;
  return sign * (Math.abs(degrees) + minutes / 60 + seconds / 3600);
}

const numbersIn = (text: string): number[] =>
  [...text.matchAll(NUMBER)].map((match) => Number.parseFloat(match[0]));

/**
 * Split typed text into axis values.
 *
 * Hemisphere letters, when present, delimit the axes (`N 9 48.5 E 75 54.25`,
 * `9°48'N 75°54'E`). Without letters, a degree mark starts each axis
 * (`9°48' 75°54'`); with neither, the text must be exactly two numbers.
 */
function tokenize(text: string): AxisToken[] {
  const cleaned = text.trim().toUpperCase().replace(/[,;/]+/g, ' ');
  if (!cleaned) return [];

  if (/[NSEW]/.test(cleaned)) {
    const prefixStyle = /^[NSEW]/.test(cleaned);
    const pattern = prefixStyle ? /([NSEW])([^NSEW]*)/g : /([^NSEW]*)([NSEW])/g;
    const tokens: AxisToken[] = [];
    let consumed = 0;
    for (const match of cleaned.matchAll(pattern)) {
      const letter = (prefixStyle ? match[1] : match[2]) as AxisToken['hemisphere'];
      const body = (prefixStyle ? match[2] : match[1]) ?? '';
      const value = axisValue(numbersIn(body));
      if (value == null) return [];
      tokens.push({ value, hemisphere: letter });
      consumed += match[0].length;
    }
    // Trailing numbers after the last letter mean the input was malformed.
    if (numbersIn(cleaned.slice(consumed)).length > 0) return [];
    return tokens;
  }

  // No letters: a degree mark after a number starts a new axis.
  if (/[°º˚]/.test(cleaned)) {
    const groups: number[][] = [];
    for (const match of cleaned.matchAll(NUMBER)) {
      const after = cleaned.slice((match.index ?? 0) + match[0].length);
      const value = Number.parseFloat(match[0]);
      if (DEGREE_MARK.test(after) || groups.length === 0) groups.push([value]);
      else groups[groups.length - 1]!.push(value);
    }
    const tokens: AxisToken[] = [];
    for (const group of groups) {
      const value = axisValue(group);
      if (value == null) return [];
      tokens.push({ value, hemisphere: null });
    }
    return tokens;
  }

  return numbersIn(cleaned).map((value) => ({ value, hemisphere: null }));
}

const applyHemisphere = (token: AxisToken): number =>
  token.hemisphere === 'S' || token.hemisphere === 'W'
    ? -Math.abs(token.value)
    : token.value;

export interface ParseLatLonOptions {
  /**
   * Axis order for a bare numeric pair such as `"9.8, 75.9"`. Default
   * `'latlon'`, the order people write. Hemisphere letters always win.
   */
  order?: 'latlon' | 'lonlat';
}

/**
 * Parse a typed position into `[longitude, latitude]`, or `null`.
 *
 * Accepts the notations people paste in practice:
 *
 * - `9.8, 75.9` and `-33.86 151.21` (signed decimal, latitude first)
 * - `9.80°N 75.90°E`, `75.90E 9.80N` (hemisphere letters fix the axis)
 * - `9°48'N 75°54'E`, `9°48′30″N 75°54′15″E` (DMS)
 * - `N 9 48.5 E 75 54.25` (degrees and decimal minutes)
 *
 * Out-of-range results (|lat| > 90, |lng| > 180) are rejected rather than
 * clamped: a silently clamped coordinate is a wrong coordinate.
 */
export function parseLatLon(
  text: string,
  { order = 'latlon' }: ParseLatLonOptions = {},
): LngLat | null {
  const tokens = tokenize(text);
  if (tokens.length !== 2) return null;
  const [first, second] = tokens as [AxisToken, AxisToken];

  const isLat = (t: AxisToken) => t.hemisphere === 'N' || t.hemisphere === 'S';
  const isLng = (t: AxisToken) => t.hemisphere === 'E' || t.hemisphere === 'W';

  let latToken: AxisToken;
  let lngToken: AxisToken;
  if (isLat(first) || isLng(second)) {
    latToken = first;
    lngToken = second;
  } else if (isLng(first) || isLat(second)) {
    latToken = second;
    lngToken = first;
  } else if (order === 'lonlat') {
    latToken = second;
    lngToken = first;
  } else {
    latToken = first;
    lngToken = second;
  }
  if (isLat(latToken) && isLat(lngToken)) return null;
  if (isLng(latToken) && isLng(lngToken)) return null;

  const lat = applyHemisphere(latToken);
  const lng = applyHemisphere(lngToken);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lng, lat];
}

/**
 * Parse a single typed axis value — one field of a split latitude/longitude
 * form. Returns degrees, or `null`.
 */
export function parseCoordinate(text: string, axis: 'lat' | 'lng'): number | null {
  const tokens = tokenize(text);
  if (tokens.length !== 1) return null;
  const token = tokens[0]!;
  if (axis === 'lat' && (token.hemisphere === 'E' || token.hemisphere === 'W')) return null;
  if (axis === 'lng' && (token.hemisphere === 'N' || token.hemisphere === 'S')) return null;
  const value = applyHemisphere(token);
  const limit = axis === 'lat' ? 90 : 180;
  return Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
}
