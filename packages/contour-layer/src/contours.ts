import type {
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GeoJsonPosition,
} from '@hridayanp/geo-utils';
import {
  computeRasterStats,
  isValidValue,
  type RasterData,
} from '@hridayanp/raster-utils';

/** How the contour values are chosen. */
export interface ContourLevelOptions {
  /**
   * Explicit contour values. Takes precedence over every other option — use
   * it for thresholds that carry meaning (warning levels, the freezing line).
   */
  levels?: readonly number[];
  /**
   * Spacing between contours in data units, e.g. `4` for isobars every 4 hPa.
   * Ignored when `levels` is given.
   */
  interval?: number;
  /**
   * Value a contour must pass through when `interval` is used. Default `0`.
   * Isobars are conventionally anchored on 1000 hPa; isotherms on 0 °C.
   */
  base?: number;
  /**
   * Approximate number of contours when neither `levels` nor `interval` is
   * given. The spacing is rounded to a 1–2–5 step. Default `10`.
   */
  count?: number;
  /** Lower bound of the contoured range. Defaults to the raster minimum. */
  min?: number;
  /** Upper bound of the contoured range. Defaults to the raster maximum. */
  max?: number;
}

export interface ComputeContoursOptions extends ContourLevelOptions {
  /**
   * Chaikin corner-cutting passes applied to each line. `0` keeps the raw
   * marching-squares geometry, which shows the grid's stair-steps at high
   * zoom; `2` is usually enough to read as a drawn isoline. Default `2`.
   */
  smoothing?: number;
  /**
   * Drop lines with fewer vertices than this — on noisy fields marching
   * squares produces a scatter of tiny rings that read as speckle, not
   * structure. Default `3`.
   */
  minVertices?: number;
  /**
   * Every `majorEvery`-th level (counted from `base`) is flagged
   * `major: true`, which the layer draws thicker and labels. Default `5`.
   */
  majorEvery?: number;
}

/** Properties carried by every contour feature. */
export interface ContourProperties {
  /** The contour value, in data units. */
  value: number;
  /** Position of the level in the ascending list of levels. */
  level: number;
  /** `true` on index contours (see `majorEvery`). */
  major: boolean;
  /** `true` when the line closes on itself. */
  closed: boolean;
}

/** Round a raw step to the nearest 1–2–5 multiple of a power of ten. */
function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const exponent = Math.floor(Math.log10(raw));
  const fraction = raw / 10 ** exponent;
  const nice = fraction <= 1.5 ? 1 : fraction <= 3 ? 2 : fraction <= 7 ? 5 : 10;
  return nice * 10 ** exponent;
}

/**
 * Resolve the contour values for a range.
 *
 * Values are generated from `base` outwards so they always land on round
 * numbers relative to it, regardless of where the data range happens to start.
 */
export function contourLevels(
  domain: readonly [number, number],
  options: ContourLevelOptions = {},
): number[] {
  if (options.levels && options.levels.length > 0) {
    return Array.from(new Set(options.levels.filter(Number.isFinite))).sort(
      (a, b) => a - b,
    );
  }

  const lo = options.min ?? domain[0];
  const hi = options.max ?? domain[1];
  if (!(hi > lo)) return [];

  const step =
    options.interval && options.interval > 0
      ? options.interval
      : niceStep((hi - lo) / Math.max(1, options.count ?? 10));
  const base = options.base ?? 0;

  const first = base + Math.ceil((lo - base) / step) * step;
  const levels: number[] = [];
  // A guard against a pathologically small interval over a huge range.
  for (let value = first; value <= hi + step * 1e-9 && levels.length < 1000; value += step) {
    // Round away accumulated floating-point drift so 0.30000000000000004
    // does not end up in a label.
    levels.push(Number.parseFloat(value.toPrecision(12)));
  }
  return levels;
}

/* ------------------------------------------------------------------ */
/* Marching squares                                                    */
/* ------------------------------------------------------------------ */

type Point = [number, number];

/**
 * Edges of a cell, in the order used by the case table:
 * 0 = top, 1 = right, 2 = bottom, 3 = left.
 */
const CASES: ReadonlyArray<ReadonlyArray<[number, number]>> = [
  [], // 0
  [[3, 2]], // 1  bottom-left
  [[2, 1]], // 2  bottom-right
  [[3, 1]], // 3
  [[1, 0]], // 4  top-right
  [], // 5  saddle — resolved at runtime
  [[2, 0]], // 6
  [[3, 0]], // 7
  [[0, 3]], // 8  top-left
  [[0, 2]], // 9
  [], // 10 saddle — resolved at runtime
  [[0, 1]], // 11
  [[1, 3]], // 12
  [[1, 2]], // 13
  [[2, 3]], // 14
  [], // 15
];

const key = (point: Point): string =>
  `${point[0].toFixed(6)},${point[1].toFixed(6)}`;

/**
 * Trace one level over the grid and return polylines in grid coordinates,
 * where `(x, y)` is the centre of column `x`, row `y`.
 */
function traceLevel(
  values: Float64Array,
  valid: Uint8Array,
  width: number,
  height: number,
  level: number,
): { points: Point[]; closed: boolean }[] {
  const segments: [Point, Point][] = [];

  // Interpolated crossing on a cell edge.
  const lerp = (a: number, b: number) => {
    const span = b - a;
    return span === 0 ? 0.5 : (level - a) / span;
  };

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i00 = y * width + x; // top-left
      const i10 = i00 + 1; // top-right
      const i01 = i00 + width; // bottom-left
      const i11 = i01 + 1; // bottom-right

      // A cell with any absent corner has no defined surface to contour.
      if (!valid[i00] || !valid[i10] || !valid[i01] || !valid[i11]) continue;

      const tl = values[i00]!;
      const tr = values[i10]!;
      const bl = values[i01]!;
      const br = values[i11]!;

      const code =
        (tl >= level ? 8 : 0) |
        (tr >= level ? 4 : 0) |
        (br >= level ? 2 : 0) |
        (bl >= level ? 1 : 0);
      if (code === 0 || code === 15) continue;

      const edgePoint = (edge: number): Point => {
        switch (edge) {
          case 0:
            return [x + lerp(tl, tr), y];
          case 1:
            return [x + 1, y + lerp(tr, br)];
          case 2:
            return [x + lerp(bl, br), y + 1];
          default:
            return [x, y + lerp(tl, bl)];
        }
      };

      let pairs = CASES[code]!;
      if (code === 5 || code === 10) {
        // Saddle: the cell-centre average decides which diagonal is connected.
        const centreHigh = (tl + tr + bl + br) / 4 >= level;
        if (code === 5) {
          pairs = centreHigh
            ? [
                [3, 0],
                [1, 2],
              ]
            : [
                [3, 2],
                [1, 0],
              ];
        } else {
          pairs = centreHigh
            ? [
                [0, 1],
                [2, 3],
              ]
            : [
                [0, 3],
                [2, 1],
              ];
        }
      }

      for (const [from, to] of pairs) {
        segments.push([edgePoint(from), edgePoint(to)]);
      }
    }
  }

  return joinSegments(segments);
}

/**
 * Stitch unordered two-point segments into continuous polylines.
 *
 * Each segment end is indexed by its rounded coordinate; a line is grown from
 * both ends until neither end has an unused neighbour.
 */
function joinSegments(
  segments: [Point, Point][],
): { points: Point[]; closed: boolean }[] {
  const byEnd = new Map<string, number[]>();
  const used = new Uint8Array(segments.length);

  segments.forEach(([a, b], index) => {
    for (const point of [a, b]) {
      const k = key(point);
      const list = byEnd.get(k);
      if (list) list.push(index);
      else byEnd.set(k, [index]);
    }
  });

  const takeNext = (point: Point): Point | null => {
    const list = byEnd.get(key(point));
    if (!list) return null;
    for (const index of list) {
      if (used[index]) continue;
      used[index] = 1;
      const [a, b] = segments[index]!;
      return key(a) === key(point) ? b : a;
    }
    return null;
  };

  const lines: { points: Point[]; closed: boolean }[] = [];
  for (let start = 0; start < segments.length; start++) {
    if (used[start]) continue;
    used[start] = 1;
    const [a, b] = segments[start]!;
    const line: Point[] = [a, b];

    for (let next = takeNext(b); next; next = takeNext(line[line.length - 1]!)) {
      line.push(next);
    }
    for (let previous = takeNext(a); previous; previous = takeNext(line[0]!)) {
      line.unshift(previous);
    }

    const closed =
      line.length > 3 && key(line[0]!) === key(line[line.length - 1]!);
    lines.push({ points: line, closed });
  }
  return lines;
}

/** Chaikin corner cutting; keeps the endpoints of open lines fixed. */
function chaikin(points: Point[], closed: boolean, passes: number): Point[] {
  let current = points;
  for (let pass = 0; pass < passes; pass++) {
    if (current.length < 3) return current;
    const next: Point[] = [];
    const n = current.length;
    if (!closed) next.push(current[0]!);
    const limit = closed ? n - 1 : n - 1;
    for (let i = 0; i < limit; i++) {
      const p = current[i]!;
      const q = current[i + 1]!;
      next.push(
        [0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]],
        [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]],
      );
    }
    if (closed) next.push(next[0]!);
    else next.push(current[n - 1]!);
    current = next;
  }
  return current;
}

/**
 * Trace contour lines through a raster with marching squares.
 *
 * The grid is contoured through **cell centres**, so a line never extends
 * beyond the outermost data and cells that hold NoData leave a gap rather than
 * an invented contour. Saddle cells are resolved by the centre average, the
 * standard disambiguation.
 *
 * Returns a GeoJSON FeatureCollection of `LineString` features in
 * `[longitude, latitude]`, one per connected line, each carrying
 * {@link ContourProperties}. Because the result is plain GeoJSON it renders
 * through `ContourLayer`, `VectorLayer`, or anything else that reads GeoJSON —
 * and the computation runs in a worker unchanged.
 *
 * ```ts
 * const isobars = computeContours(mslp, { interval: 4, base: 1000 });
 * ```
 */
export function computeContours(
  raster: RasterData,
  options: ComputeContoursOptions = {},
): GeoJsonFeatureCollection {
  const { data, width, height, bounds, noData } = raster;
  const empty: GeoJsonFeatureCollection = { type: 'FeatureCollection', features: [] };
  if (width < 2 || height < 2 || data.length < width * height) return empty;

  const stats = computeRasterStats(data, noData);
  if (stats.validCount === 0) return empty;

  const levels = contourLevels([stats.min, stats.max], options);
  if (levels.length === 0) return empty;

  const values = new Float64Array(width * height);
  const valid = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const value = data[i] as number;
    values[i] = value;
    valid[i] = isValidValue(value, noData) && Number.isFinite(value) ? 1 : 0;
  }

  const smoothing = Math.max(0, Math.floor(options.smoothing ?? 2));
  const minVertices = Math.max(2, options.minVertices ?? 3);
  const majorEvery = Math.max(1, Math.floor(options.majorEvery ?? 5));
  const base = options.base ?? 0;
  const step =
    levels.length > 1 ? levels[1]! - levels[0]! : (options.interval ?? 1);

  const [west, south, east, north] = bounds;
  const dx = (east - west) / width;
  const dy = (north - south) / height;
  // Grid coordinates are cell centres, hence the half-cell offset.
  const toLngLat = ([x, y]: Point): GeoJsonPosition => [
    west + (x + 0.5) * dx,
    north - (y + 0.5) * dy,
  ];

  const features: GeoJsonFeature[] = [];
  levels.forEach((level, levelIndex) => {
    // Index contours are counted from `base` when the levels are regular, so
    // "every fifth isobar" means 1000, 1020, 1040 — not whichever came first.
    const ordinal =
      options.levels || !(step > 0)
        ? levelIndex
        : Math.round((level - base) / step);
    const major = ordinal % majorEvery === 0;

    for (const line of traceLevel(values, valid, width, height, level)) {
      if (line.points.length < minVertices) continue;
      const smoothed = chaikin(line.points, line.closed, smoothing);
      const properties: ContourProperties = {
        value: level,
        level: levelIndex,
        major,
        closed: line.closed,
      };
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: smoothed.map(toLngLat) },
        properties: properties as unknown as Record<string, unknown>,
      });
    }
  });

  return { type: 'FeatureCollection', features };
}
