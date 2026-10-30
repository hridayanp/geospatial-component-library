/**
 * `@hridayanp/map-widgets`
 *
 * The furniture around a map: scale bar, cursor coordinates, north arrow,
 * overview inset, place search, colour-ramp picker and a loading indicator.
 *
 * Each is independent and data-free — the search box takes the host's
 * geocoder as a function, the ramp picker emits colours the host passes on.
 *
 * Map-bound widgets require a `<MapContainer>` ancestor from
 * `@hridayanp/map-container`. Remember to import the stylesheet once:
 * `import '@hridayanp/ui/styles.css'`.
 */

export { ScaleBar, roundScaleDistance } from './ScaleBar';
export type { ScaleBarProps, ScaleUnit } from './ScaleBar';

export { CoordinateReadout } from './CoordinateReadout';
export type { CoordinateReadoutProps } from './CoordinateReadout';

export { NorthArrow } from './NorthArrow';
export type { NorthArrowProps } from './NorthArrow';

export { MiniMap } from './MiniMap';
export type { MiniMapProps } from './MiniMap';

export { LocationSearch } from './LocationSearch';
export type { LocationResult, LocationSearchProps } from './LocationSearch';

export { COLOR_RAMPS, ColorRampPicker } from './ColorRampPicker';
export type { ColorRamp, ColorRampPickerProps } from './ColorRampPicker';

export { MapLoadingOverlay } from './MapLoadingOverlay';
export type { MapLoadingOverlayProps } from './MapLoadingOverlay';
