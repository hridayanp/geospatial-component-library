/** One observation in a time series. */
export interface SeriesPoint {
  /** Independent variable — conventionally a year, or any ordered numeric key. */
  x: number;
  /** Dependent variable. */
  y: number;
}

/** An ordinary-least-squares fit through a series. */
export interface LinearTrend {
  /** Change in `y` per unit of `x`. */
  slope: number;
  /** Fitted value at `x = 0`. */
  intercept: number;
  /** Coefficient of determination, `0..1`. */
  r2: number;
  /** Residual standard error — the typical distance of an observation from the fit. */
  residualStandardError: number;
  /** Observations the fit was computed over. */
  n: number;
  /** Mean of `x`, the point about which prediction uncertainty is narrowest. */
  meanX: number;
  /** Σ(x − x̄)² — the spread of `x`, which governs how fast uncertainty widens. */
  sumSquaresX: number;
  /** Fitted value at any `x`. */
  predict: (x: number) => number;
  /**
   * Standard error of a **predicted observation** at `x`.
   *
   * ```text
   * se(x) = s · √[ 1 + 1/n + (x − x̄)² / Σ(x − x̄)² ]
   * ```
   *
   * The leading `1` is what distinguishes a prediction interval from a
   * confidence interval: it accounts for the scatter of an individual
   * observation about the line, not only for uncertainty in the line's position.
   * A projection is a statement about a future observation, so this is the
   * appropriate one.
   */
  standardErrorAt: (x: number) => number;
}

/**
 * Fit a least-squares line through a series.
 *
 * A linear trend is the least assuming model that still says something: it
 * commits only to a constant rate of change. That is frequently wrong for
 * environmental series — land-cover conversion accelerates, saturates, or
 * reverses — so `r2` and the residual standard error are returned alongside the
 * coefficients rather than left implicit. A low `r2` does not mean the series is
 * flat; it means a straight line is the wrong description of it.
 *
 * @throws with fewer than two observations, or when `x` does not vary.
 */
export function linearTrend(points: readonly SeriesPoint[]): LinearTrend {
  const usable = points.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  );
  const n = usable.length;

  if (n < 2) {
    throw new Error(
      `[gcl] linearTrend requires at least two finite observations (received ${n}).`,
    );
  }

  let sumX = 0;
  let sumY = 0;
  for (const point of usable) {
    sumX += point.x;
    sumY += point.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let sumSquaresX = 0;
  let crossProduct = 0;
  for (const point of usable) {
    const dx = point.x - meanX;
    sumSquaresX += dx * dx;
    crossProduct += dx * (point.y - meanY);
  }

  if (sumSquaresX === 0) {
    throw new Error(
      '[gcl] linearTrend requires x to vary; every observation shares one x value.',
    );
  }

  const slope = crossProduct / sumSquaresX;
  const intercept = meanY - slope * meanX;
  const predict = (x: number) => intercept + slope * x;

  let residualSumSquares = 0;
  let totalSumSquares = 0;
  for (const point of usable) {
    residualSumSquares += (point.y - predict(point.x)) ** 2;
    totalSumSquares += (point.y - meanY) ** 2;
  }

  // n − 2 degrees of freedom: two parameters were estimated from the data.
  const residualStandardError =
    n > 2 ? Math.sqrt(residualSumSquares / (n - 2)) : 0;

  return {
    slope,
    intercept,
    r2: totalSumSquares > 0 ? 1 - residualSumSquares / totalSumSquares : 1,
    residualStandardError,
    n,
    meanX,
    sumSquaresX,
    predict,
    standardErrorAt: (x: number) =>
      residualStandardError *
      Math.sqrt(1 + 1 / n + (x - meanX) ** 2 / sumSquaresX),
  };
}

export interface ProjectionOptions {
  /** Project forward to this `x`, inclusive. */
  to: number;
  /** Step between projected points. Defaults to the series' own median step. */
  step?: number;
  /**
   * Half-width of the prediction band, in standard errors. Default `1.96`,
   * the two-sided 95% level under the normal approximation.
   *
   * Pass `0` to omit the band. Doing so is a presentational choice with a real
   * cost: a projection drawn as a bare line invites the reader to treat an
   * extrapolation as a measurement.
   */
  intervalZ?: number;
  /**
   * Clamp projected values (and the band) to this range — for example `[0,
   * Infinity]` where the quantity is an area and cannot go negative.
   */
  clamp?: [number, number];
}

/** A projected point, with its prediction band. */
export interface ProjectedPoint extends SeriesPoint {
  /** Lower bound of the prediction band. Equal to `y` when no band was requested. */
  lower: number;
  /** Upper bound of the prediction band. */
  upper: number;
}

/** Result of {@link projectSeries}. */
export interface Projection {
  trend: LinearTrend;
  /** Projected points beyond the observed series, ordered by `x`. */
  points: ProjectedPoint[];
  /**
   * The last observed point, repeated as a projected point so a chart can join
   * the observed and projected paths without a visible gap.
   */
  anchor: ProjectedPoint | null;
}

/**
 * Extrapolate a series forward under its least-squares trend.
 *
 * The projection is an arithmetic consequence of the fit, not a forecast: it
 * assumes the observed rate of change continues unchanged, and it has no
 * knowledge of policy, saturation or any driver of the process. Its honest use
 * is to show what the recent rate implies, alongside the band that says how
 * loosely the observations constrain it.
 *
 * Uncertainty widens with distance from the mean of `x` — a projection five
 * steps out is far less constrained than one step out, and the band is what
 * makes that visible.
 */
export function projectSeries(
  points: readonly SeriesPoint[],
  options: ProjectionOptions,
): Projection {
  const { to, intervalZ = 1.96, clamp } = options;

  const ordered = points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .slice()
    .sort((a, b) => a.x - b.x);

  const trend = linearTrend(ordered);
  const last = ordered[ordered.length - 1]!;
  const step = options.step ?? medianStep(ordered);

  if (!(step > 0)) {
    throw new Error('[gcl] projectSeries requires a positive step.');
  }

  const bound = (value: number) =>
    clamp ? Math.min(clamp[1], Math.max(clamp[0], value)) : value;

  const at = (x: number): ProjectedPoint => {
    const y = trend.predict(x);
    const halfWidth = intervalZ > 0 ? intervalZ * trend.standardErrorAt(x) : 0;
    return {
      x,
      y: bound(y),
      lower: bound(y - halfWidth),
      upper: bound(y + halfWidth),
    };
  };

  const projected: ProjectedPoint[] = [];
  for (let x = last.x + step; x <= to + 1e-9; x += step) {
    projected.push(at(x));
  }

  return {
    trend,
    points: projected,
    // The anchor carries the observed value, not the fitted one, so the joined
    // path leaves the last measurement rather than jumping to the line.
    anchor: { x: last.x, y: last.y, lower: last.y, upper: last.y },
  };
}

/** Median gap between consecutive `x` values. */
function medianStep(ordered: readonly SeriesPoint[]): number {
  if (ordered.length < 2) return 1;
  const gaps: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    gaps.push(ordered[i]!.x - ordered[i - 1]!.x);
  }
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] ?? 1;
}

/**
 * Centred moving average over a series.
 *
 * Useful for reading a noisy series where the year-to-year variation is
 * measurement or classification noise rather than signal. The window shortens at
 * the ends rather than dropping points, so the smoothed series covers the same
 * span as the observations.
 *
 * @param window Number of observations averaged. Even windows are rounded up to
 * the next odd number so the average stays centred.
 */
export function movingAverage(
  points: readonly SeriesPoint[],
  window: number,
): SeriesPoint[] {
  const span = Math.max(1, Math.round(window) | 1);
  const half = Math.floor(span / 2);

  return points.map((point, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(points.length - 1, i + half);
    let total = 0;
    let count = 0;
    for (let k = start; k <= end; k++) {
      const value = points[k]!.y;
      if (!Number.isFinite(value)) continue;
      total += value;
      count += 1;
    }
    return { x: point.x, y: count > 0 ? total / count : point.y };
  });
}

/**
 * Compound annual rate of change between the first and last observation.
 *
 * Reported as a fraction — `0.023` is 2.3% per unit of `x`. Returns `null` when
 * the first value is not positive, since a compound rate is undefined from a
 * base of zero and negative bases have no real root.
 *
 * Unlike {@link linearTrend}, this uses only the endpoints: it is the constant
 * rate that connects them, and it ignores everything in between. Where the
 * series is not monotone the two will disagree, and the trend is the more honest
 * summary.
 */
export function compoundGrowthRate(
  points: readonly SeriesPoint[],
): number | null {
  const ordered = points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .slice()
    .sort((a, b) => a.x - b.x);

  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (!first || !last) return null;

  const periods = last.x - first.x;
  if (periods <= 0 || first.y <= 0 || last.y <= 0) return null;

  return (last.y / first.y) ** (1 / periods) - 1;
}
