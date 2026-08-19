/**
 * `@hridayanp/geo-legend`
 *
 * Map legends for arbitrary geospatial data — continuous ramps, classed
 * swatches, any unit, any title. Works with or without a map.
 *
 * Remember to import the stylesheet once: `import '@hridayanp/ui/styles.css'`.
 */

export { GeoLegend, colorScaleStopCount } from './GeoLegend';
export type { GeoLegendProps, LegendClass } from './GeoLegend';

export { GeoLegendStack } from './GeoLegendStack';
export type { GeoLegendStackProps } from './GeoLegendStack';

export {
  buildTicks,
  defaultFormat,
  normalizeStops,
  scaleToGradient,
} from './colorScale';
export type { LegendColorScale, LegendColorStop } from './colorScale';
