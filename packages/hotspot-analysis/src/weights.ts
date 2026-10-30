import { haversineDistanceKm, type LngLat } from '@hridayanp/geo-utils';

/** How spatial proximity is converted into a weight between two observations. */
export type WeightScheme =
  /** `1` inside the band, `0` outside. The Getis-Ord convention. */
  | 'binary'
  /** `1 − d/bandwidth` inside the band, `0` outside. */
  | 'linear'
  /** `exp(−(d/bandwidth)²)`, truncated at the band for tractability. */
  | 'gaussian';

export interface SpatialWeightsOptions {
  /**
   * Distance band in kilometres. Observations further apart than this are
   * unweighted neighbours of one another.
   *
   * There is no universally correct value: too small and most observations have
   * no neighbours, so every statistic is undefined; too large and the local
   * statistic converges on the global mean and every cluster disappears. Derive
   * it from the process being studied, or from
   * {@link suggestBandwidthKm} when no theory is available.
   */
  bandwidthKm: number;
  /** Distance decay applied inside the band. Default `'binary'`. */
  scheme?: WeightScheme;
  /**
   * Include each observation in its own neighbourhood. Default `true`.
   *
   * Self-inclusion is what distinguishes Getis-Ord **Gi\*** from Gi, and is
   * required for the statistic to detect a cluster centred on an observation
   * rather than only a ring around it.
   */
  includeSelf?: boolean;
}

/**
 * A sparse row-wise spatial weights matrix.
 *
 * Stored as neighbour indices and weights per observation rather than as a dense
 * *n* × *n* matrix: a distance band over ten thousand observations is almost
 * entirely zeros, and the dense form would need eight hundred megabytes to hold
 * them.
 */
export interface SpatialWeights {
  /** `neighbours[i]` — indices weighted against observation *i*. */
  neighbours: number[][];
  /** `weights[i][k]` — weight of `neighbours[i][k]`. */
  weights: number[][];
  bandwidthKm: number;
  scheme: WeightScheme;
  includeSelf: boolean;
}

/**
 * Build a distance-band spatial weights matrix over geographic positions.
 *
 * Distances are great-circle (haversine) in kilometres, so a band means the same
 * thing at every latitude — a planar distance computed on Web Mercator
 * coordinates would shrink the effective band toward the equator and inflate it
 * toward the poles, systematically biasing where clusters are detected.
 *
 * Cost is O(n²) in the number of observations. For the point counts a browser
 * realistically analyses (up to a few thousand) that is well under a second; a
 * larger study is better served by a spatially indexed implementation on the
 * server.
 */
export function spatialWeights(
  positions: readonly LngLat[],
  options: SpatialWeightsOptions,
): SpatialWeights {
  const { bandwidthKm, scheme = 'binary', includeSelf = true } = options;

  if (!(bandwidthKm > 0)) {
    throw new Error('[gcl] spatialWeights requires a positive bandwidthKm.');
  }

  const n = positions.length;
  const neighbours: number[][] = Array.from({ length: n }, () => []);
  const weights: number[][] = Array.from({ length: n }, () => []);

  const decay = (distance: number): number => {
    switch (scheme) {
      case 'linear':
        return 1 - distance / bandwidthKm;
      case 'gaussian':
        return Math.exp(-((distance / bandwidthKm) ** 2));
      default:
        return 1;
    }
  };

  for (let i = 0; i < n; i++) {
    if (includeSelf) {
      neighbours[i]!.push(i);
      weights[i]!.push(1);
    }
    // The matrix is symmetric, so each pair is evaluated once and recorded on
    // both rows — halving the distance computations, which dominate the cost.
    for (let j = i + 1; j < n; j++) {
      const distance = haversineDistanceKm(positions[i]!, positions[j]!);
      if (distance > bandwidthKm) continue;
      const weight = decay(distance);
      if (weight <= 0) continue;
      neighbours[i]!.push(j);
      weights[i]!.push(weight);
      neighbours[j]!.push(i);
      weights[j]!.push(weight);
    }
  }

  return { neighbours, weights, bandwidthKm, scheme, includeSelf };
}

/**
 * A distance band at which every observation has at least one neighbour.
 *
 * Returns the maximum nearest-neighbour distance across the dataset — the
 * smallest band that leaves no observation isolated, and the conventional
 * starting point when no theoretical distance is available.
 *
 * This is a floor, not a recommendation. A band chosen this way is driven by the
 * single most isolated observation, so a sparse periphery can inflate it well
 * beyond the scale of the process; inspect the returned percentiles before
 * adopting it.
 */
export function suggestBandwidthKm(positions: readonly LngLat[]): {
  /** Largest nearest-neighbour distance: no observation is isolated at this band. */
  maxNearestKm: number;
  /** Median nearest-neighbour distance — the typical observation spacing. */
  medianNearestKm: number;
  /** 90th percentile, a common compromise between the two. */
  p90NearestKm: number;
} {
  const n = positions.length;
  if (n < 2) {
    return { maxNearestKm: 0, medianNearestKm: 0, p90NearestKm: 0 };
  }

  const nearest = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const distance = haversineDistanceKm(positions[i]!, positions[j]!);
      if (distance < nearest[i]!) nearest[i] = distance;
      if (distance < nearest[j]!) nearest[j] = distance;
    }
  }

  const sorted = Array.from(nearest).sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))] ?? 0;

  return {
    maxNearestKm: sorted[sorted.length - 1] ?? 0,
    medianNearestKm: at(0.5),
    p90NearestKm: at(0.9),
  };
}
