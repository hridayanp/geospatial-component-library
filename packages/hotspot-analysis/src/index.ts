/**
 * `@hridayanp/hotspot-analysis`
 *
 * Spatial cluster detection: Getis-Ord Gi\* over discrete observations, and
 * kernel density estimation onto a continuous surface.
 *
 * Every export is a pure function over plain data — no React, no map dependency.
 * Results are returned in the shapes the rendering packages already accept: a
 * GeoJSON FeatureCollection carrying computed properties for `VectorLayer`, and
 * a `RasterData` surface for `RasterLayer`. The analysis and its rendering stay
 * separable, so the same computation can run in a worker or on a server.
 */

export { spatialWeights, suggestBandwidthKm } from './weights';
export type {
  SpatialWeights,
  SpatialWeightsOptions,
  WeightScheme,
} from './weights';

export { getisOrdGiStar, summarizeClusters, twoTailedP } from './getisOrd';
export type { GiStarOptions, GiStarResult, HotspotClass } from './getisOrd';

export { changeDensity, kernelDensity } from './kernelDensity';
export type { DensityKernel, KernelDensityOptions } from './kernelDensity';

export {
  HOTSPOT_COLORS,
  HOTSPOT_LABELS,
  extractObservations,
  hotspotLegendClasses,
  toHotspotFeatures,
} from './features';
export type { ExtractedObservations, HotspotProperties } from './features';

export type { Bounds, LngLat } from '@hridayanp/geo-utils';
export type { RasterData } from '@hridayanp/raster-utils';
