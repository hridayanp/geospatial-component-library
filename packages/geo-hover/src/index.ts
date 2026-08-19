/**
 * `@hridayanp/geo-hover`
 *
 * Hover and picking for maps: vector feature inspection, raster value probing,
 * and a portalled readout card that never gets clipped.
 *
 * All data comes from the host — the package reads what is already on the map
 * and in memory, and never fetches anything of its own.
 *
 * Remember to import the stylesheet once: `import '@hridayanp/ui/styles.css'`.
 */

export { GeoHover } from './GeoHover';
export type { GeoHoverProps } from './GeoHover';

export { GeoHoverCard } from './GeoHoverCard';
export type { GeoHoverCardProps } from './GeoHoverCard';

export { useMapHover, useRasterProbe } from './hooks';
export type { UseMapHoverOptions } from './hooks';

export type {
  HoverPosition,
  HoverRow,
  HoverSection,
  HoverState,
} from './types';
