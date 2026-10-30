/**
 * `@hridayanp/classified-raster`
 *
 * Rendering configuration and change accounting for classified (categorical)
 * rasters — land cover, land use, suitability classes, any band whose cells hold
 * an integer code rather than a measured quantity.
 *
 * Every export is a pure function over plain data. There is no React and no map
 * dependency, so the package runs in a web worker, is testable without a
 * browser, and composes with the existing `RasterLayer` rather than duplicating
 * it.
 */

export {
  buildClassIndex,
  classAt,
  classTableKey,
  classTableToLegendClasses,
  classifiedColorScale,
  classifiedDomain,
} from './classes';
export type { ClassDefinition, ClassIndex, ClassTable } from './classes';

export { boundsAreaKm2, rowAreasKm2 } from './area';

export {
  changeMask,
  classifiedToDataUrl,
  colorizeClassified,
} from './colorize';
export type {
  ColorizeClassifiedOptions,
  ColorizedClassified,
} from './colorize';

export {
  classAreas,
  netChange,
  persistenceRate,
  topTransitions,
  transitionMatrix,
} from './statistics';
export type {
  ClassArea,
  ClassAreaOptions,
  ClassAreaResult,
  NetChange,
  Transition,
  TransitionMatrixOptions,
  TransitionMatrixResult,
} from './statistics';

// Re-exported so a consumer describing a classified band does not have to add
// `@hridayanp/raster-utils` for the one type.
export type { RasterData } from '@hridayanp/raster-utils';
export type { Bounds } from '@hridayanp/geo-utils';
