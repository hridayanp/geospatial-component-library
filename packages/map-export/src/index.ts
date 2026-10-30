/**
 * `@hridayanp/map-export`
 *
 * Export what a MapLibre map shows: PNG, JPEG or WebP stills with an optional
 * title, attribution and custom decorations, and animated GIFs recorded frame
 * by frame through a timeline.
 *
 * No runtime dependencies — the GIF encoder is built in — and no need to
 * create the map with `preserveDrawingBuffer`.
 *
 * `MapExportControl` requires a `<MapContainer>` ancestor; the functions take
 * a MapLibre instance and work anywhere.
 */

export { MapExportControl } from './MapExportControl';
export type { MapExportControlProps } from './MapExportControl';

export {
  captureMap,
  downloadBlob,
  readMapCanvas,
  recordMapAnimation,
  waitForMapIdle,
} from './capture';
export type {
  CaptureOptions,
  ImageFormat,
  RecordAnimationOptions,
} from './capture';

export { encodeGif } from './gif';
export type { EncodeGifOptions, GifFrame } from './gif';
