/**
 * `@hridayanp/contour-layer`
 *
 * Isolines traced from a raster — isobars from pressure, isotherms from
 * temperature, isohyets from rainfall — and a MapLibre layer that draws and
 * labels them.
 *
 * The tracing is a pure function over `RasterData` returning GeoJSON, so it
 * runs in a worker and its output renders through any GeoJSON-capable layer.
 *
 * Requires a `<MapContainer>` ancestor from `@hridayanp/map-container` for the
 * layer component; `computeContours` needs nothing.
 */

export { ContourLayer } from './ContourLayer';
export type { ContourLayerProps } from './ContourLayer';

export { computeContours, contourLevels } from './contours';
export type {
  ComputeContoursOptions,
  ContourLevelOptions,
  ContourProperties,
} from './contours';

export type { RasterData } from '@hridayanp/raster-utils';
