import { createContext, useContext } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';

/** What every layer package needs in order to attach itself to a map. */
export interface MapContextValue {
  /** The live MapLibre instance, or `null` before the map has been created. */
  map: MapLibreMap | null;
  /** `true` once the style has loaded and sources may be added. */
  ready: boolean;
  /**
   * Increments every time the style is swapped.
   *
   * MapLibre discards all sources and layers when the style changes, so
   * anything that added its own must re-add it. Depending on this value in an
   * effect is how layer packages survive a basemap switch.
   */
  styleVersion: number;
}

export const MapContext = createContext<MapContextValue | null>(null);

/**
 * Access the enclosing map.
 *
 * Throws when used outside a `<MapContainer>`, because a layer that silently
 * renders nothing is far harder to debug than one that says why.
 */
export function useMap(): MapContextValue {
  const value = useContext(MapContext);
  if (!value) {
    throw new Error(
      '[gcl] useMap() must be called inside a <MapContainer>. If this component is optional, use useMapOptional() instead.',
    );
  }
  return value;
}

/** Like {@link useMap}, but returns `null` instead of throwing. */
export function useMapOptional(): MapContextValue | null {
  return useContext(MapContext);
}

/**
 * The map instance, but only once the style is loaded.
 *
 * Almost every layer effect wants exactly this: adding a source before the
 * style is ready throws inside MapLibre.
 */
export function useReadyMap(): MapLibreMap | null {
  const { map, ready } = useMap();
  return ready ? map : null;
}
