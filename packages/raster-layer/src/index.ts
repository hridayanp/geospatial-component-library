/**
 * `@hridayanp/raster-layer`
 *
 * One generic, props-driven raster layer that replaces a family of
 * per-variable map components. What used to differ between them — the data and
 * the colour ramp — are props here.
 *
 * Requires a `<MapContainer>` ancestor from `@hridayanp/map-container`.
 */

export { RasterLayer } from './RasterLayer';
export type { RasterLayerProps } from './RasterLayer';

export { preloadRasterFrame, useRasterImage } from './useRasterImage';

export { RasterFrameCache, defaultFrameCache } from './cache';
export type { CachedFrame } from './cache';

export type {
  RasterFrameInfo,
  RasterGeoTIFFInput,
  RasterImageInput,
  RasterLayerData,
  RasterRenderOptions,
} from './types';

// Re-exported for convenience so a consumer of the layer does not have to add
// `@hridayanp/raster-utils` just to describe its own data.
export type { ColorScaleInput, RasterData } from '@hridayanp/raster-utils';
