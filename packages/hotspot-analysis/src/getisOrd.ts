import type { SpatialWeights } from './weights';

/**
 * Cluster classification for a Gi\* result.
 *
 * The bands are the conventional two-tailed significance levels used for
 * hotspot reporting, and are what "99% confidence hot spot" means in a published
 * map legend.
 */
export type HotspotClass =
  | 'hot-99'
  | 'hot-95'
  | 'hot-90'
  | 'not-significant'
  | 'cold-90'
  | 'cold-95'
  | 'cold-99';

/** Getis-Ord Gi\* output for one observation. */
export interface GiStarResult {
  /** Index into the input array. */
  index: number;
  /** The observation's own value. */
  value: number;
  /** Standardised Gi\* statistic. Positive is a high-value cluster. */
  zScore: number;
  /** Two-tailed p-value under the normal approximation. */
  pValue: number;
  /** Neighbours contributing to the statistic, including self when enabled. */
  neighbourCount: number;
  /** Significance band. */
  cluster: HotspotClass;
}

export interface GiStarOptions {
  /**
   * Correct p-values for multiple comparisons using the False Discovery Rate
   * procedure. Default `false`.
   *
   * A local statistic is computed once per observation, so at the conventional
   * 5% level roughly one observation in twenty is flagged by chance alone —
   * a thousand observations yield about fifty spurious "hot spots". The FDR
   * correction adjusts the thresholds to control the expected share of false
   * positives among those reported, and is the standard remedy when the result
   * will be interpreted as a map of real clusters.
   */
  falseDiscoveryRate?: boolean;
}

/**
 * Getis-Ord Gi\* — local clustering of high and low values.
 *
 * Gi\* asks, for each observation, whether the values in its neighbourhood sum
 * to more than would be expected if the same values were distributed at random
 * across the study area. A large positive z-score means an observation is
 * surrounded by high values — a *hot spot*. A large negative z-score means the
 * opposite — a *cold spot*.
 *
 * The distinction that matters: a high value is not a hot spot. An isolated
 * maximum surrounded by low values is an outlier, and Gi\* will not flag it.
 * A hot spot is a **cluster**, and it is possible for an observation of
 * unremarkable magnitude to sit at the centre of one.
 *
 * ```text
 *          Σⱼ wᵢⱼ xⱼ − X̄ Σⱼ wᵢⱼ
 * Gi*ᵢ = ─────────────────────────────────────────
 *        S √[ (n Σⱼ wᵢⱼ² − (Σⱼ wᵢⱼ)²) / (n − 1) ]
 * ```
 *
 * where `X̄` and `S` are the global mean and population standard deviation of
 * the values, and `wᵢⱼ` is the spatial weight from {@link spatialWeights}.
 *
 * Interpretation depends entirely on the distance band those weights were built
 * with: the same data yields different clusters at different scales, and neither
 * is wrong. Report the bandwidth alongside the map.
 *
 * @throws when `values` and the weights matrix disagree in length.
 */
export function getisOrdGiStar(
  values: readonly number[],
  weights: SpatialWeights,
  options: GiStarOptions = {},
): GiStarResult[] {
  const { falseDiscoveryRate = false } = options;
  const n = values.length;

  if (n !== weights.neighbours.length) {
    throw new Error(
      `[gcl] getisOrdGiStar: ${n} values but weights for ${weights.neighbours.length} observations.`,
    );
  }
  if (n < 3) {
    throw new Error(
      '[gcl] getisOrdGiStar requires at least three observations for the normal approximation to mean anything.',
    );
  }

  let sum = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) {
      throw new Error(
        '[gcl] getisOrdGiStar requires finite values. Filter or impute absent observations before analysis.',
      );
    }
    sum += value;
  }
  const mean = sum / n;

  let squaredDeviation = 0;
  for (const value of values) squaredDeviation += (value - mean) ** 2;
  // Population standard deviation: the Gi* denominator is defined over the
  // study area as the whole population, not a sample drawn from it.
  const deviation = Math.sqrt(squaredDeviation / n);

  const results: GiStarResult[] = [];

  for (let i = 0; i < n; i++) {
    const neighbours = weights.neighbours[i]!;
    const rowWeights = weights.weights[i]!;

    let weightedSum = 0;
    let weightTotal = 0;
    let weightSquaredTotal = 0;
    for (let k = 0; k < neighbours.length; k++) {
      const weight = rowWeights[k]!;
      weightedSum += weight * values[neighbours[k]!]!;
      weightTotal += weight;
      weightSquaredTotal += weight * weight;
    }

    let zScore = 0;
    if (deviation > 0 && neighbours.length > 0) {
      const numerator = weightedSum - mean * weightTotal;
      const variance =
        (n * weightSquaredTotal - weightTotal * weightTotal) / (n - 1);
      const denominator = deviation * Math.sqrt(Math.max(0, variance));
      zScore = denominator > 0 ? numerator / denominator : 0;
    }

    results.push({
      index: i,
      value: values[i]!,
      zScore,
      pValue: twoTailedP(zScore),
      neighbourCount: neighbours.length,
      cluster: 'not-significant',
    });
  }

  const thresholds = falseDiscoveryRate
    ? falseDiscoveryThresholds(results.map((result) => result.pValue))
    : { p99: 0.01, p95: 0.05, p90: 0.1 };

  for (const result of results) {
    result.cluster = classify(result.zScore, result.pValue, thresholds);
  }

  return results;
}

interface Thresholds {
  p99: number;
  p95: number;
  p90: number;
}

function classify(
  zScore: number,
  pValue: number,
  thresholds: Thresholds,
): HotspotClass {
  const hot = zScore > 0;
  if (pValue <= thresholds.p99) return hot ? 'hot-99' : 'cold-99';
  if (pValue <= thresholds.p95) return hot ? 'hot-95' : 'cold-95';
  if (pValue <= thresholds.p90) return hot ? 'hot-90' : 'cold-90';
  return 'not-significant';
}

/**
 * Benjamini-Hochberg critical values for each conventional level.
 *
 * For *m* tests sorted ascending by p-value, the largest *k* satisfying
 * `p₍k₎ ≤ k·α/m` sets the effective threshold; when no *k* satisfies it, nothing
 * at that level survives correction and the threshold is zero.
 */
function falseDiscoveryThresholds(pValues: readonly number[]): Thresholds {
  const sorted = [...pValues].sort((a, b) => a - b);
  const m = sorted.length;

  const critical = (alpha: number): number => {
    let threshold = 0;
    for (let k = 0; k < m; k++) {
      if (sorted[k]! <= ((k + 1) * alpha) / m) threshold = sorted[k]!;
    }
    return threshold;
  };

  return { p99: critical(0.01), p95: critical(0.05), p90: critical(0.1) };
}

/** Two-tailed p-value of a z-score under the standard normal distribution. */
export function twoTailedP(zScore: number): number {
  return 2 * (1 - standardNormalCdf(Math.abs(zScore)));
}

/**
 * Standard normal CDF, via the Abramowitz & Stegun 7.1.26 error-function
 * approximation. Maximum absolute error 1.5 × 10⁻⁷ — far below the resolution
 * at which a significance band is read.
 */
function standardNormalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;

  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-z * z);

  return 0.5 * (1 + sign * y);
}

/**
 * Counts of each significance band, for a summary readout beside the map.
 *
 * The share that is *not* significant is the number worth leading with: a
 * result in which almost everything clusters usually means the bandwidth is too
 * large, and one in which almost nothing does usually means it is too small.
 */
export function summarizeClusters(
  results: readonly GiStarResult[],
): Record<HotspotClass, number> {
  const counts: Record<HotspotClass, number> = {
    'hot-99': 0,
    'hot-95': 0,
    'hot-90': 0,
    'not-significant': 0,
    'cold-90': 0,
    'cold-95': 0,
    'cold-99': 0,
  };
  for (const result of results) counts[result.cluster] += 1;
  return counts;
}
