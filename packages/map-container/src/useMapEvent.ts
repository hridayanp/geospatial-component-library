import { useEffect, useRef } from 'react';
import type { MapLayerEventType, MapEventType } from 'maplibre-gl';
import { useMap } from './context';

/**
 * Subscribe to a map-wide event for as long as the component is mounted.
 *
 * The handler is held in a ref, so passing an inline arrow function does not
 * re-subscribe on every render — a common and expensive mistake when the
 * handler fires on `mousemove`.
 */
export function useMapEvent<T extends keyof MapEventType>(
  type: T,
  handler: ((event: MapEventType[T]) => void) | null | undefined,
): void {
  const { map, ready } = useMap();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!map || !ready || !handler) return;
    const listener = (event: MapEventType[T]) => handlerRef.current?.(event);
    map.on(type, listener as never);
    return () => {
      map.off(type, listener as never);
    };
    // `handler` is only in the deps to toggle the subscription on and off when
    // it appears or disappears; identity changes are absorbed by the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, type, !handler]);
}

/**
 * Subscribe to an event scoped to one or more layers, so the handler only
 * fires when the pointer is actually over a rendered feature.
 *
 * Re-subscribes when the style is swapped, because MapLibre drops layer
 * listeners along with the layers themselves.
 */
export function useMapLayerEvent<T extends keyof MapLayerEventType>(
  layerIds: string | string[] | null | undefined,
  type: T,
  handler: ((event: MapLayerEventType[T]) => void) | null | undefined,
): void {
  const { map, ready, styleVersion } = useMap();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const ids = layerIds == null ? [] : Array.isArray(layerIds) ? layerIds : [layerIds];
  const idsKey = ids.join('|');

  useEffect(() => {
    if (!map || !ready || !handler || ids.length === 0) return;
    const listener = (event: MapLayerEventType[T]) => handlerRef.current?.(event);
    const bound: string[] = [];

    for (const id of ids) {
      if (!map.getLayer(id)) continue;
      map.on(type, id, listener as never);
      bound.push(id);
    }

    return () => {
      for (const id of bound) {
        try {
          map.off(type, id, listener as never);
        } catch {
          /* the layer may already be gone */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, styleVersion, idsKey, type, !handler]);
}

/**
 * Set the canvas cursor while a condition holds — the conventional way to
 * signal that something under the pointer is interactive.
 */
export function useMapCursor(cursor: string | null): void {
  const { map } = useMap();
  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas();
    const previous = canvas.style.cursor;
    if (cursor != null) canvas.style.cursor = cursor;
    return () => {
      canvas.style.cursor = previous;
    };
  }, [map, cursor]);
}
