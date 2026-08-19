/**
 * `@hridayanp/map-controls`
 *
 * The genuinely reusable map controls — zoom, reset view, fullscreen, opacity,
 * basemap — and a bar to group them in.
 *
 * Requires a `<MapContainer>` ancestor from `@hridayanp/map-container`.
 * Remember to import the stylesheet once: `import '@hridayanp/ui/styles.css'`.
 */

export {
  BasemapSwitcher,
  FullscreenControl,
  MapControlBar,
  OpacityControl,
  ResetViewControl,
  ZoomControl,
} from './MapControls';

export type {
  BasemapOption,
  BasemapSwitcherProps,
  FullscreenControlProps,
  MapControlBarProps,
  OpacityControlProps,
  ResetViewControlProps,
  ZoomControlProps,
} from './MapControls';
