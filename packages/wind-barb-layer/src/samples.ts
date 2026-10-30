import {
  getFeatures,
  geometryAnchor,
  parseDirection,
  pickProperty,
  reverseBearing,
  toFiniteNumber,
  uvToSpeedDirection,
} from '@hridayanp/geo-utils';
import type {
  WindBarbData,
  WindBarbField,
  WindBarbPoints,
  WindBarbSample,
  WindSpeedUnit,
} from './types';

const SPEED_KEYS = [
  'speed',
  'wind_speed',
  'wind_speed_kt',
  'windSpeed',
  'ws',
  'wspd',
  'value',
];
const DIRECTION_KEYS = [
  'direction',
  'wind_dir_deg',
  'wind_direction',
  'windDirection',
  'dir',
  'wd',
  'wdir',
];

const TO_KNOTS: Record<WindSpeedUnit, number> = {
  kt: 1,
  'm/s': 1.943844,
  'km/h': 0.539957,
  mph: 0.868976,
};

/** Convert a speed in `unit` to knots. */
export function toKnots(speed: number, unit: WindSpeedUnit = 'kt'): number {
  return speed * TO_KNOTS[unit];
}

export interface WindBarbSampleOptions {
  /** Unit of the input speeds. Default `'kt'`. */
  unit?: WindSpeedUnit;
  /**
   * For gridded input: draw one barb every `stride` cells in each direction.
   * Default chosen so roughly `maxBarbs` barbs are drawn.
   */
  stride?: number;
  /** Upper bound on the number of barbs produced from a grid. Default `1500`. */
  maxBarbs?: number;
}

function fromField(
  field: WindBarbField,
  unit: WindSpeedUnit,
  stride: number | undefined,
  maxBarbs: number,
): WindBarbSample[] {
  const { u, v, width, height, bounds, noData } = field;
  const [west, south, east, north] = bounds;
  const dx = (east - west) / width;
  const dy = (north - south) / height;

  // Decimate evenly. A barb per cell on a dense grid is an unreadable mat of
  // ink; barbs are read individually, so spacing matters more than coverage.
  const step = Math.max(
    1,
    Math.round(stride ?? Math.sqrt((width * height) / Math.max(1, maxBarbs))),
  );
  const offset = Math.floor(step / 2);

  const out: WindBarbSample[] = [];
  for (let row = offset; row < height; row += step) {
    for (let column = offset; column < width; column += step) {
      const index = row * width + column;
      const eastward = u[index] as number;
      const northward = v[index] as number;
      if (
        !Number.isFinite(eastward) ||
        !Number.isFinite(northward) ||
        eastward === noData ||
        northward === noData
      ) {
        continue;
      }
      const { speed, direction } = uvToSpeedDirection(eastward, northward, 'from');
      out.push({
        lng: west + (column + 0.5) * dx,
        lat: north - (row + 0.5) * dy,
        speedKt: toKnots(speed, unit),
        direction,
      });
    }
  }
  return out;
}

function fromPoints(points: WindBarbPoints, unit: WindSpeedUnit): WindBarbSample[] {
  const speedKeys = points.speedProperty ? [points.speedProperty] : SPEED_KEYS;
  const directionKeys = points.directionProperty
    ? [points.directionProperty]
    : DIRECTION_KEYS;
  const towards = points.directionConvention === 'towards';

  const out: WindBarbSample[] = [];
  for (const feature of getFeatures(points.data)) {
    const anchor = geometryAnchor(feature.geometry);
    if (!anchor) continue;
    const speed = toFiniteNumber(pickProperty(feature.properties, speedKeys));
    const rawDirection = pickProperty(feature.properties, directionKeys);
    const direction = parseDirection(
      typeof rawDirection === 'number' || typeof rawDirection === 'string'
        ? rawDirection
        : null,
    );
    if (speed == null || direction == null) continue;
    out.push({
      lng: anchor[0],
      lat: anchor[1],
      speedKt: toKnots(Math.max(0, speed), unit),
      direction: towards ? reverseBearing(direction) : direction,
    });
  }
  return out;
}

/**
 * Resolve any accepted input into barbs: position, speed in knots and the
 * direction the wind blows **from**.
 *
 * Exported so a host can reuse the extraction — to build a table of the same
 * observations, for instance — without rendering anything.
 */
export function extractWindBarbs(
  data: WindBarbData,
  options: WindBarbSampleOptions = {},
): WindBarbSample[] {
  const unit = options.unit ?? 'kt';
  return data.kind === 'field'
    ? fromField(data, unit, options.stride, options.maxBarbs ?? 1500)
    : fromPoints(data, unit);
}

/**
 * The barb symbol for a speed: counts of pennants (50 kt), full barbs (10 kt)
 * and half barbs (5 kt), after rounding to the nearest 5 kt as WMO practice
 * requires.
 */
export function barbComponents(speedKt: number): {
  rounded: number;
  pennants: number;
  full: number;
  half: number;
} {
  const rounded = Math.max(0, Math.round(speedKt / 5) * 5);
  let remaining = rounded;
  const pennants = Math.floor(remaining / 50);
  remaining -= pennants * 50;
  const full = Math.floor(remaining / 10);
  remaining -= full * 10;
  const half = remaining >= 5 ? 1 : 0;
  return { rounded, pennants, full, half };
}
