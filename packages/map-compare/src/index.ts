/**
 * `@hridayanp/map-compare`
 *
 * Side-by-side and swipe comparison of synchronised MapLibre views, and grids of
 * small multiples over one extent.
 *
 * Each pane is an ordinary `MapContainer`, so the layer components inside a
 * comparison are the same components used anywhere else and have no knowledge
 * that they are being compared.
 *
 * Remember to import the stylesheet once: `import '@hridayanp/ui/styles.css'`.
 */

export { CompareMaps } from './CompareMaps';
export type { CompareMapsProps, CompareMode } from './CompareMaps';

export { MapGrid } from './MapGrid';
export type { MapGridPane, MapGridProps } from './MapGrid';

export { useMapSync } from './useMapSync';
export type { MapSyncOptions } from './useMapSync';

export { useSwipeDivider } from './useSwipeDivider';
export type { SwipeDividerOptions, SwipeDividerState } from './useSwipeDivider';
