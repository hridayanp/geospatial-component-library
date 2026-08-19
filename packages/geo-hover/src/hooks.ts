import { useCallback, useRef, useState } from 'react';
import type { MapMouseEvent } from 'maplibre-gl';
import type { GeoJsonFeature } from '@hridayanp/geo-utils';
import { useMap, useMapEvent } from '@hridayanp/map-container';
import { sampleRaster, type RasterData } from '@hridayanp/raster-utils';
import type { HoverState } from './types';

export interface UseMapHoverOptions {
  /**
   * Layers to query for features. Omit to skip feature picking entirely — a
   * raster probe does not need it, and querying every layer on every pointer
   * move is expensive.
   */
  layerIds?: string[];
  /**
   * Raster to read a value from at the pointer position. Sampling happens on
   * the raster the host already has in memory, so there is no round trip and
   * no extra decode.
   */
  raster?: RasterData | null;
  /** `'nearest'` (default) returns a real cell value; `'bilinear'` interpolates. */
  sampling?: 'nearest' | 'bilinear';
  /** Turn hovering off without unmounting. Default `true`. */
  enabled?: boolean;
  /**
   * Change the cursor while something is under the pointer. Default
   * `'pointer'`; pass `null` to leave the cursor alone.
   */
  cursor?: string | null;
}

/**
 * Track what is under the pointer on the enclosing map.
 *
 * Returns `null` when the pointer is over nothing of interest, which is
 * exactly the shape a tooltip wants — render the card when there is state and
 * nothing when there is not.
 *
 * Feature picking and raster probing are independent: use either, or both.
 *
 * @example
 * ```tsx
 * const hover = useMapHover({ layerIds: ['stations-point'], raster });
 * return hover ? (
 *   <GeoHoverCard
 *     x={hover.x}
 *     y={hover.y}
 *     sections={[{ title: 'Reading', rows: [{ label: 'Value', value: hover.value }] }]}
 *   />
 * ) : null;
 * ```
 */
export function useMapHover({
  layerIds,
  raster,
  sampling = 'nearest',
  enabled = true,
  cursor = 'pointer',
}: UseMapHoverOptions = {}): HoverState | null {
  const { map } = useMap();
  const [hover, setHover] = useState<HoverState | null>(null);
  const active = useRef(false);

  const setCursor = useCallback(
    (value: string) => {
      if (cursor == null || !map) return;
      map.getCanvas().style.cursor = value;
    },
    [map, cursor],
  );

  const handleMove = useCallback(
    (event: MapMouseEvent) => {
      if (!map || !enabled) return;

      const features =
        layerIds && layerIds.length > 0
          ? (map
              .queryRenderedFeatures(event.point, {
                // Querying a layer that does not exist throws, and layers come
                // and go as the user toggles overlays.
                layers: layerIds.filter((id) => map.getLayer(id)),
              })
              .map((feature) => feature as unknown as GeoJsonFeature) ?? [])
          : [];

      const lngLat: [number, number] = [event.lngLat.lng, event.lngLat.lat];
      const value = raster
        ? sampleRaster(raster, lngLat, sampling).value
        : undefined;

      const hasSomething = features.length > 0 || (value != null && !Number.isNaN(value));
      if (!hasSomething) {
        if (active.current) {
          active.current = false;
          setCursor('');
          setHover(null);
        }
        return;
      }

      active.current = true;
      setCursor(cursor ?? '');
      setHover({
        x: (event.originalEvent as MouseEvent).clientX,
        y: (event.originalEvent as MouseEvent).clientY,
        lngLat,
        features,
        ...(value !== undefined ? { value } : {}),
      });
    },
    [map, enabled, layerIds, raster, sampling, cursor, setCursor],
  );

  const handleLeave = useCallback(() => {
    active.current = false;
    setCursor('');
    setHover(null);
  }, [setCursor]);

  useMapEvent('mousemove', enabled ? handleMove : null);
  useMapEvent('mouseout', enabled ? handleLeave : null);

  return enabled ? hover : null;
}

/**
 * Read a raster's value under the pointer, without any feature picking.
 *
 * A thin alias over {@link useMapHover} for the common "inspect the raster"
 * case, so the call site says what it means.
 */
export function useRasterProbe(
  raster: RasterData | null | undefined,
  options: Omit<UseMapHoverOptions, 'raster' | 'layerIds'> = {},
): HoverState | null {
  return useMapHover({ ...options, raster: raster ?? null });
}
