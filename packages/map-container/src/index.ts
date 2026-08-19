/**
 * `@hridayanp/map-container`
 *
 * The composition root: a MapLibre GL map plus the React context and the
 * source/layer plumbing that every other `@hridayanp/*` layer package builds on.
 *
 * It deliberately knows nothing about weather, rasters, vectors, dashboards or
 * APIs — only about a map and the children attached to it.
 */

export { MapContainer } from './MapContainer';
export type { MapContainerHandle, MapContainerProps } from './MapContainer';

export { MapContext, useMap, useMapOptional, useReadyMap } from './context';
export type { MapContextValue } from './context';

export { useMapSourceLayers } from './useMapSourceLayers';
export type { ManagedLayer, UseMapSourceLayersOptions } from './useMapSourceLayers';

export { useMapCursor, useMapEvent, useMapLayerEvent } from './useMapEvent';

export {
  DEFAULT_MAP_STYLE,
  createBlankStyle,
  createRasterStyle,
  withPMTilesOutline,
} from './style';

export {
  registerCOGProtocol,
  registerPMTilesProtocol,
  registeredProtocols,
} from './protocols';
