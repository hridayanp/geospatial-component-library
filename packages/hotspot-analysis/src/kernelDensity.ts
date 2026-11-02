import {
  boundsFromPoints,
  haversineDistanceKm,
  padBounds,
  type Bounds,
  type LngLat,
} from '@hridayanp/geo-utils';
import type { RasterData } from '@hridayanp/raster-utils';

/** Kernel applied to the distance between a cell and an observation. */
export type DensityKernel =
  /** `(1 − (d/h)²)²`, the Silverman convention. Smooth, finite support. */
  | 'quartic'
  /** `1 − (d/h)²`. Slightly heavier tails than quartic. */
  | 'epanechnikov'
  /** `exp(−½(d/h)²)`, truncated at `3h`. */
  | 'gaussian'
  /** Uniform inside the bandwidth. Produces visible discs; use for counts. */
  | 'uniform';

export interface KernelDensityOptions {
  /**
   * Search radius in kilometres.
   *
   * This is the dominant parameter: a small bandwidth resolves individual
   * observations, a large one produces a single smooth mound. The surface is a
   * statement about the bandwidth as much as about the data, so report it.
   */
  bandwidthKm: number;
  /** Kernel shape. Default `'quartic'`. */
  kernel?: DensityKernel;
  /** Output grid width in cells. Default `256`. */
  width?: number;
  /**
   * Output grid height in cells. Defaults to whatever preserves the extent's
   * aspect ratio at the given width.
   */
  height?: number;
  /**
   * Extent to compute over. Defaults to the observations' own extent padded by
   * one bandwidth, so density is not truncated at the outermost point.
   */
  bounds?: Bounds;
  /**
   * Per-observation weights — an intensity, a magnitude, a count. Defaults to
   * `1` per observation, giving a plain point density.
   */
  weights?: readonly number[];
  /**
   * Normalise the surface to density per square kilometre rather than a
   * weighted count. Default `true`.
   *
   * An unnormalised surface cannot be compared between two analyses at
   * different bandwidths, because doubling the bandwidth roughly quadruples the
   * area each observation contributes to.
   */
  normalize?: boolean;
}

/**
 * Kernel density estimation over geographic observations.
 *
 * Produces a continuous intensity surface as a `RasterData`, which the existing
 * `RasterLayer` renders directly:
 *
 * ```tsx
 * const surface = kernelDensity(positions, { bandwidthKm: 25 });
 * <RasterLayer data={surface} colorScale={heat} smoothFactor={4} />
 * ```
 *
 * Distances are great-circle, so the bandwidth means the same thing at every
 * latitude. Cells beyond the bandwidth of every observation are written as
 * NoData rather than zero — an area with no observations is unobserved, not
 * measured at zero, and rendering the two identically overstates coverage.
 */
export function kernelDensity(
  positions: readonly LngLat[],
  options: KernelDensityOptions,
): RasterData {
  const {
    bandwidthKm,
    kernel = 'quartic',
    width = 256,
    weights,
    normalize = true,
  } = options;

  if (!(bandwidthKm > 0)) {
    throw new Error('[gcl] kernelDensity requires a positive bandwidthKm.');
  }
  if (weights && weights.length !== positions.length) {
    throw new Error(
      `[gcl] kernelDensity: ${positions.length} positions but ${weights.length} weights.`,
    );
  }

  const bounds = options.bounds ?? defaultBounds(positions, bandwidthKm);
  const [west, south, east, north] = bounds;
  const spanLng = east - west;
  const spanLat = north - south;

  const height =
    options.height ??
    Math.max(
      1,
      Math.round((width * Math.max(spanLat, 1e-9)) / Math.max(spanLng, 1e-9)),
    );

  const noData = -1;
  const values = new Float32Array(width * height).fill(noData);

  // Gaussian has infinite support; truncating at 3σ captures 99.7% of its mass
  // and keeps the computation bounded.
  const reach = kernel === 'gaussian' ? bandwidthKm * 3 : bandwidthKm;
  // Per-unit-area normalisation, so surfaces at different bandwidths compare.
  const areaScale = normalize ? 1 / (Math.PI * bandwidthKm * bandwidthKm) : 1;

  for (let row = 0; row < height; row++) {
    // Sample at cell centres; `bounds` describes the grid's outer edges.
    const lat = north - ((row + 0.5) / height) * spanLat;
    for (let column = 0; column < width; column++) {
      const lng = west + ((column + 0.5) / width) * spanLng;
      const cell: LngLat = [lng, lat];

      let total = 0;
      let covered = false;

      for (let i = 0; i < positions.length; i++) {
        const distance = haversineDistanceKm(cell, positions[i]!);
        if (distance > reach) continue;
        covered = true;
        total += kernelWeight(kernel, distance, bandwidthKm) * (weights?.[i] ?? 1);
      }

      if (covered) values[row * width + column] = total * areaScale;
    }
  }

  return {
    data: values,
    width,
    height,
    bounds,
    noData,
    unit: normalize ? 'per km²' : undefined,
  };
}

function kernelWeight(
  kernel: DensityKernel,
  distance: number,
  bandwidth: number,
): number {
  const u = distance / bandwidth;
  switch (kernel) {
    case 'epanechnikov':
      return u >= 1 ? 0 : 1 - u * u;
    case 'gaussian':
      return Math.exp(-0.5 * u * u);
    case 'uniform':
      return u >= 1 ? 0 : 1;
    default: {
      if (u >= 1) return 0;
      const t = 1 - u * u;
      return t * t;
    }
  }
}

function defaultBounds(positions: readonly LngLat[], bandwidthKm: number): Bounds {
  const extent = boundsFromPoints(positions);
  if (!extent) {
    throw new Error(
      '[gcl] kernelDensity needs at least one position, or an explicit bounds option.',
    );
  }
  // Roughly one bandwidth of margin, expressed as a fraction of the extent so
  // the surface is not clipped at the outermost observation.
  const spanKm = Math.max(
    haversineDistanceKm([extent[0], extent[1]], [extent[2], extent[1]]),
    1e-6,
  );
  return padBounds(extent, Math.min(1, bandwidthKm / spanKm));
}

/**
 * Density of a classified change mask — where change concentrates.
 *
 * Convenience over {@link kernelDensity} for the common case of locating
 * clusters of change rather than clusters of observations: cells flagged as
 * changed become weighted observations at their own centres.
 *
 * The mask is expected in the shape `changeMask` from
 * `@hridayanp/classified-raster` produces — `1` where the class changed, `0`
 * where it persisted, NoData elsewhere.
 */
export function changeDensity(
  mask: RasterData,
  options: Omit<KernelDensityOptions, 'weights' | 'bounds'> & {
    bounds?: Bounds;
  },
): RasterData {
  const { data, width, height, bounds, noData } = mask;
  const [west, south, east, north] = bounds;

  const positions: LngLat[] = [];
  for (let row = 0; row < height; row++) {
    const lat = north - ((row + 0.5) / height) * (north - south);
    for (let column = 0; column < width; column++) {
      const value = Number(data[row * width + column]);
      if (!Number.isFinite(value) || (noData != null && value === noData)) {
        continue;
      }
      if (value <= 0) continue;
      positions.push([west + ((column + 0.5) / width) * (east - west), lat]);
    }
  }

  return kernelDensity(positions, { bounds, ...options });
}
