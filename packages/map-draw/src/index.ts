/**
 * `@hridayanp/map-draw`
 *
 * Drawing, editing and measuring on a MapLibre map — point, line, polygon,
 * rectangle, circle and freehand — built on terra-draw.
 *
 * Shapes leave through `onChange` as plain GeoJSON, and every measurement is
 * geodesic, so an area drawn over a continent is reported correctly rather
 * than in squared degrees.
 *
 * Requires a `<MapContainer>` ancestor from `@hridayanp/map-container`.
 * Remember to import the stylesheet once: `import '@hridayanp/ui/styles.css'`.
 */

export { DrawControl } from './DrawControl';
export type { DrawControlProps } from './DrawControl';

export { ALL_DRAW_MODES, useMapDraw } from './useMapDraw';
export type { DrawMode, MapDrawApi, UseMapDrawOptions } from './useMapDraw';

export {
  formatArea,
  formatDistance,
  measureFeature,
  measureGeometry,
  pathLengthKm,
  ringAreaKm2,
} from './measure';
export type { FeatureMeasurement } from './measure';
