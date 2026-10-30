import {
  destinationPoint,
  bearingBetween,
  haversineDistanceKm,
  type LngLat,
} from '@hridayanp/geo-utils';
import { sampleRaster, type RasterData } from '@hridayanp/raster-utils';

/** A forecast–observation pair. */
export interface VerificationPair {
  /** Observed (reference) value. */
  observed: number;
  /** Forecast (or model) value. */
  forecast: number;
}

/** Continuous verification scores. */
export interface VerificationStats {
  /** Pairs used (non-finite pairs are skipped). */
  n: number;
  /** Mean error, forecast − observed. Positive means over-forecast. */
  bias: number;
  /** Mean absolute error. */
  mae: number;
  /** Root-mean-square error. */
  rmse: number;
  /** Pearson correlation coefficient, or `NaN` with no variance. */
  r: number;
  /** Least-squares fit of forecast on observed: `forecast ≈ slope · observed + intercept`. */
  slope: number;
  intercept: number;
}

/** Bias, MAE, RMSE, correlation and regression for paired values. */
export function verificationStats(pairs: readonly VerificationPair[]): VerificationStats {
  const valid = pairs.filter((p) => Number.isFinite(p.observed) && Number.isFinite(p.forecast));
  const n = valid.length;
  if (n === 0) {
    return { n: 0, bias: Number.NaN, mae: Number.NaN, rmse: Number.NaN, r: Number.NaN, slope: Number.NaN, intercept: Number.NaN };
  }
  let sumO = 0;
  let sumF = 0;
  let sumErr = 0;
  let sumAbs = 0;
  let sumSq = 0;
  for (const { observed, forecast } of valid) {
    const error = forecast - observed;
    sumO += observed;
    sumF += forecast;
    sumErr += error;
    sumAbs += Math.abs(error);
    sumSq += error * error;
  }
  const meanO = sumO / n;
  const meanF = sumF / n;
  let covariance = 0;
  let varianceO = 0;
  let varianceF = 0;
  for (const { observed, forecast } of valid) {
    covariance += (observed - meanO) * (forecast - meanF);
    varianceO += (observed - meanO) ** 2;
    varianceF += (forecast - meanF) ** 2;
  }
  const slope = varianceO > 0 ? covariance / varianceO : Number.NaN;
  return {
    n,
    bias: sumErr / n,
    mae: sumAbs / n,
    rmse: Math.sqrt(sumSq / n),
    r: varianceO > 0 && varianceF > 0 ? covariance / Math.sqrt(varianceO * varianceF) : Number.NaN,
    slope,
    intercept: meanF - slope * meanO,
  };
}

/** One sample along a path. */
export interface ProfileSample {
  /** Distance from the start of the path, km. */
  distanceKm: number;
  lngLat: LngLat;
  /** Value at the position, `null` over NoData or outside the raster. */
  value: number | null;
}

/**
 * Sample a raster at evenly spaced points along a path — the data behind a
 * cross-section line drawn on the map.
 *
 * Points are spaced along great circles, not in degrees, so distance on the
 * chart is real distance. Vertices of the path are always included, so a
 * reader can line a bend on the map up with the chart.
 */
export function profileAlongPath(
  raster: RasterData,
  path: readonly LngLat[],
  { samples = 200, method = 'bilinear' }: { samples?: number; method?: 'nearest' | 'bilinear' } = {},
): ProfileSample[] {
  if (path.length < 2) return [];
  const legs = path.slice(1).map((to, i) => haversineDistanceKm(path[i]!, to));
  const total = legs.reduce((sum, leg) => sum + leg, 0);
  if (!(total > 0)) return [];
  const step = total / Math.max(1, samples - 1);

  const out: ProfileSample[] = [];
  let travelled = 0;
  for (let leg = 0; leg < legs.length; leg++) {
    const from = path[leg]!;
    const to = path[leg + 1]!;
    const length = legs[leg]!;
    const bearing = bearingBetween(from, to);
    const count = Math.max(1, Math.round(length / step));
    for (let i = 0; i < count; i++) {
      const along = (i / count) * length;
      const position = i === 0 ? from : destinationPoint(from, bearing, along);
      out.push({
        distanceKm: travelled + along,
        lngLat: position,
        value: sampleRaster(raster, position, method).value,
      });
    }
    travelled += length;
  }
  const last = path[path.length - 1]!;
  out.push({ distanceKm: total, lngLat: last, value: sampleRaster(raster, last, method).value });
  return out;
}
