/**
 * `@hridayanp/wind-barb-layer`
 *
 * Wind barbs and direction arrows, rendered natively by MapLibre.
 *
 * Takes the same field and point shapes as `@hridayanp/wind-particle-layer`,
 * so the two compose over one dataset — but needs neither deck.gl nor
 * WeatherLayers. Icons are signed-distance-field images generated in the
 * browser on demand, so any colour and halo works from one image per speed.
 *
 * Requires a `<MapContainer>` ancestor from `@hridayanp/map-container`.
 */

export { WindBarbLayer } from './WindBarbLayer';
export type { WindBarbLayerProps } from './WindBarbLayer';

export { barbComponents, extractWindBarbs, toKnots } from './samples';
export type { WindBarbSampleOptions } from './samples';

export { createArrowImage, createBarbImage } from './icons';
export type { SdfImage } from './icons';

export type {
  WindBarbData,
  WindBarbField,
  WindBarbPoints,
  WindBarbSample,
  WindSpeedUnit,
} from './types';
