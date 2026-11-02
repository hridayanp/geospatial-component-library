/**
 * `@hridayanp/geo-charts`
 *
 * Charts for the output of geospatial analysis: a time series with a
 * least-squares projection, class composition and change, and a class transition
 * matrix.
 *
 * Rendered as inline SVG with no charting dependency. The scope is deliberately
 * narrow — three forms that answer questions the rest of this library produces
 * answers to — rather than a general plotting library.
 *
 * **Colour comes from the caller.** When a chart describes something also drawn
 * on a map, it adopts the map's symbology: pass the same class colours the layer
 * was given, so the chart and the map are one encoding rather than two.
 *
 * Remember to import the stylesheet once: `import '@hridayanp/ui/styles.css'`.
 */

export { ChartFrame, DataTable } from './ChartFrame';
export type {
  ChartFrameProps,
  LegendEntry,
  TableColumn,
} from './ChartFrame';

export { TrendChart } from './TrendChart';
export type { TrendChartProps, TrendSeries } from './TrendChart';

export { ClassAreaChart } from './ClassAreaChart';
export type { ClassAreaChartProps, ClassAreaDatum } from './ClassAreaChart';

export { ChangeMatrix } from './ChangeMatrix';
export type { ChangeMatrixProps, MatrixClass } from './ChangeMatrix';

export {
  compoundGrowthRate,
  linearTrend,
  movingAverage,
  projectSeries,
} from './trend';
export type {
  LinearTrend,
  ProjectedPoint,
  Projection,
  ProjectionOptions,
  SeriesPoint,
} from './trend';

export {
  CATEGORICAL_DARK,
  CATEGORICAL_LIGHT,
  DIVERGING_DARK,
  DIVERGING_LIGHT,
  SEQUENTIAL_DARK,
  SEQUENTIAL_LIGHT,
  inkOn,
  rampAt,
  relativeLuminance,
} from './palette';
export type { ColorRole } from './palette';

export {
  estimateTextWidth,
  formatCompact,
  formatPercent,
  linearScale,
  niceDomain,
  niceTicks,
} from './scales';
export type { LinearScale } from './scales';
