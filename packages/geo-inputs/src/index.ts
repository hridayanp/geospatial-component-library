/**
 * `@hridayanp/geo-inputs`
 *
 * Form controls for geographic values — a latitude/longitude field that reads
 * every common notation, and a bounding-box editor — plus the formatting and
 * parsing functions behind them.
 *
 * No map dependency: these work in any form, with or without a map on screen.
 * Remember to import the stylesheet once: `import '@hridayanp/ui/styles.css'`.
 */

export { LatLonInput } from './LatLonInput';
export type { LatLonInputProps } from './LatLonInput';

export { BboxEditor, boundsAreaKm2, validateBounds } from './BboxEditor';
export type { BboxEditorProps } from './BboxEditor';

export {
  formatLatLon,
  formatLatitude,
  formatLongitude,
  parseCoordinate,
  parseLatLon,
} from './coordinates';
export type {
  CoordinateFormat,
  FormatCoordinateOptions,
  ParseLatLonOptions,
} from './coordinates';
