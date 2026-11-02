/**
 * `@hridayanp/data-tile-layer`
 *
 * Tiled data fields delivered as value-encoded images, decoded and coloured in
 * the browser, with an `A − B` difference mode and exact value sampling.
 *
 * The tile contract is explicit and documented in `DataTileEncoding`, and the
 * host may supply its own loader, so the layer works with any tile server, an
 * authenticated endpoint, or tiles generated client-side.
 *
 * Requires a `<MapContainer>` ancestor from `@hridayanp/map-container`.
 */

export { DataTileLayer } from './DataTileLayer';
export type {
  DataTileLayerHandle,
  DataTileLayerProps,
  DataTileSample,
} from './DataTileLayer';

export {
  DEFAULT_ENCODING,
  decodeTilePixels,
  encodeTileValues,
} from './encoding';
export type { DataTileEncoding, DataTileValues } from './encoding';

export {
  TileValueCache,
  lngLatToTile,
  loadTileValues,
  tileBounds,
  toTileValues,
} from './tiles';
export type {
  DataTileLoader,
  DataTileResult,
  DataTileSourceInput,
} from './tiles';
