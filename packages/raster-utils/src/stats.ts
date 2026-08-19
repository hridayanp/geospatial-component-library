import type { RasterArray, RasterData, RasterStats } from './types';

/**
 * `true` when a cell holds a real measurement.
 *
 * Both the declared NoData sentinel and `NaN` count as absent; GDAL writes the
 * former, floating-point pipelines tend to produce the latter.
 */
export function isValidValue(
  value: number,
  noData: number | null | undefined,
): boolean {
  return value !== noData && !Number.isNaN(value);
}

/**
 * Min, max, mean and valid-cell count over a band, skipping NoData.
 *
 * When every cell is NoData the range falls back to `0..1` rather than
 * `Infinity..-Infinity`, so downstream normalisation stays finite instead of
 * producing `NaN` colours.
 */
export function computeRasterStats(
  data: RasterArray,
  noData?: number | null,
): RasterStats {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let validCount = 0;

  for (let i = 0; i < data.length; i++) {
    const value = data[i] as number;
    if (!isValidValue(value, noData)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
    validCount++;
  }

  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max)) max = 1;

  return {
    min,
    max,
    validCount,
    totalCount: data.length,
    mean: validCount > 0 ? sum / validCount : null,
  };
}

/**
 * The value range a raster should be coloured across.
 *
 * Explicit `min`/`max` win; anything missing falls back to the raster's own
 * statistics. A degenerate range (min === max) is widened by one unit so
 * normalisation never divides by zero.
 */
export function resolveDomain(
  raster: RasterData,
  min?: number,
  max?: number,
): [number, number] {
  if (min != null && max != null) {
    return min === max ? [min, min + 1] : [min, max];
  }
  const stats = computeRasterStats(raster.data, raster.noData);
  const lo = min ?? stats.min;
  const hi = max ?? stats.max;
  return lo === hi ? [lo, lo + 1] : [lo, hi];
}

/** Map a value into `0..1` across the domain, clamped at both ends. */
export function normalizeValue(
  value: number,
  domain: [number, number],
): number {
  const span = domain[1] - domain[0];
  if (span === 0) return 0;
  return Math.min(1, Math.max(0, (value - domain[0]) / span));
}

/**
 * Rescale a whole band into a `Float32Array` of `0..1` values.
 *
 * NoData cells become `NaN` so they stay distinguishable from a genuine zero
 * after normalisation.
 */
export function normalizeRaster(
  raster: RasterData,
  min?: number,
  max?: number,
): Float32Array {
  const domain = resolveDomain(raster, min, max);
  const out = new Float32Array(raster.data.length);
  for (let i = 0; i < raster.data.length; i++) {
    const value = raster.data[i] as number;
    out[i] = isValidValue(value, raster.noData)
      ? normalizeValue(value, domain)
      : Number.NaN;
  }
  return out;
}

/** Smooth Hermite interpolation between two edges — the GLSL `smoothstep`. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
