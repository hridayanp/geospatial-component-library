import { useEffect, useRef } from 'react';
import type {
  GeoJSONSource,
  ImageSource,
  LayerSpecification,
  Map as MapLibreMap,
  SourceSpecification,
} from 'maplibre-gl';
import { useMap } from './context';

/** A layer to attach, minus the `source` — that is filled in for you. */
export type ManagedLayer = Omit<LayerSpecification, 'source'> & {
  source?: string;
};

export interface UseMapSourceLayersOptions {
  /** Unique source id. Must not collide with anything in the basemap style. */
  sourceId: string;
  /**
   * The source to add. Pass `null` to detach everything — that is how a layer
   * component implements `visible={false}` without unmounting.
   */
  source: SourceSpecification | null;
  /** Layers drawn from the source, in draw order. */
  layers: ManagedLayer[];
  /**
   * Insert the layers *below* this existing layer id. The usual reason is to
   * keep basemap labels and boundaries readable on top of data.
   */
  beforeId?: string;
}

const isGeoJsonSource = (spec: SourceSpecification): boolean =>
  spec.type === 'geojson';
const isImageSource = (spec: SourceSpecification): boolean =>
  spec.type === 'image';

/**
 * Attach a source and its layers to the enclosing map, and keep them in sync.
 *
 * This exists because the naive approach — remove and re-add on every change —
 * makes MapLibre unmount the layer, drop its GPU texture and visibly flash. So
 * instead:
 *
 * - the source is added once and afterwards **updated in place**
 *   (`setData` for GeoJSON, `updateImage` for images);
 * - paint, layout, filter and zoom-range changes are applied as individual
 *   property updates rather than a re-add;
 * - a full re-add happens only when the structure genuinely changes (the source
 *   type, or the set of layer ids);
 * - teardown removes layers before the source, which MapLibre requires.
 *
 * It also re-attaches automatically after the basemap style is swapped, since
 * MapLibre discards every non-style source and layer at that point.
 */
export function useMapSourceLayers({
  sourceId,
  source,
  layers,
  beforeId,
}: UseMapSourceLayersOptions): void {
  const { map, ready, styleVersion } = useMap();

  const previousLayers = useRef<Map<string, ManagedLayer>>(new Map());
  const attached = useRef(false);

  // Latest values, read by effects that must not re-run when they change.
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const sourceRef = useRef(source);

  const layerIdsKey = layers.map((layer) => layer.id).join('|');
  const sourceType = source?.type ?? null;

  /* ---------------------------------------------------------------- */
  /* Structural attach / detach                                        */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!map || !ready || !source) {
      return;
    }

    const currentLayers = layersRef.current;

    try {
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, source);
      }
      for (const layer of currentLayers) {
        if (map.getLayer(layer.id)) continue;
        map.addLayer(
          { ...layer, source: sourceId } as LayerSpecification,
          beforeId && map.getLayer(beforeId) ? beforeId : undefined,
        );
      }
      previousLayers.current = new Map(
        currentLayers.map((layer) => [layer.id, layer]),
      );
      attached.current = true;
    } catch (error) {
      console.error(`[gcl] Failed to attach source "${sourceId}":`, error);
    }

    return () => {
      attached.current = false;
      previousLayers.current = new Map();
      // Layers first — MapLibre refuses to remove a source still in use.
      for (const layer of currentLayers) {
        try {
          if (map.getLayer(layer.id)) map.removeLayer(layer.id);
        } catch {
          /* the style may already have been torn down */
        }
      }
      try {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        /* likewise */
      }
    };
    // Only structural identity belongs here. Data and style changes are
    // handled by the in-place update effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, styleVersion, sourceId, sourceType, layerIdsKey, beforeId]);

  /* ---------------------------------------------------------------- */
  /* In-place source data updates                                      */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const previous = sourceRef.current;
    sourceRef.current = source;
    if (!map || !ready || !attached.current || !source) return;
    if (!previous || previous.type !== source.type) return;

    const live = map.getSource(sourceId);
    if (!live) return;

    try {
      if (isGeoJsonSource(source)) {
        const data = (source as { data?: unknown }).data;
        if (data !== (previous as { data?: unknown }).data) {
          (live as GeoJSONSource).setData(
            data as Parameters<GeoJSONSource['setData']>[0],
          );
        }
        return;
      }

      if (isImageSource(source)) {
        const next = source as { url?: string; coordinates?: unknown };
        const prev = previous as { url?: string; coordinates?: unknown };
        const imageSource = live as ImageSource;
        const coordinatesChanged =
          JSON.stringify(next.coordinates) !== JSON.stringify(prev.coordinates);
        if (next.url !== prev.url || coordinatesChanged) {
          imageSource.updateImage({
            url: next.url as string,
            coordinates: next.coordinates as Parameters<
              ImageSource['updateImage']
            >[0]['coordinates'],
          });
        }
        return;
      }

      // Raster / vector / other tiled sources have no in-place data update;
      // a URL change means a new source, which the structural effect handles
      // when the caller changes the source id along with it.
    } catch (error) {
      console.error(`[gcl] Failed to update source "${sourceId}":`, error);
    }
  }, [map, ready, sourceId, source]);

  /* ---------------------------------------------------------------- */
  /* In-place paint / layout / filter updates                          */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!map || !ready || !attached.current) return;
    for (const layer of layers) {
      const previous = previousLayers.current.get(layer.id);
      if (!previous) continue;
      applyLayerDiff(map, layer, previous);
      previousLayers.current.set(layer.id, layer);
    }
  }, [map, ready, layers]);

  /* ---------------------------------------------------------------- */
  /* Draw-order maintenance                                            */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!map || !ready || !attached.current || !beforeId) return;
    if (!map.getLayer(beforeId)) return;
    for (const layer of layersRef.current) {
      try {
        if (map.getLayer(layer.id)) map.moveLayer(layer.id, beforeId);
      } catch {
        /* ignore transient ordering failures during a style swap */
      }
    }
  }, [map, ready, styleVersion, beforeId]);
}

type PaintOrLayout = Record<string, unknown> | undefined;

function applyLayerDiff(
  map: MapLibreMap,
  next: ManagedLayer,
  previous: ManagedLayer,
): void {
  try {
    diffProperties(
      (next as { paint?: PaintOrLayout }).paint,
      (previous as { paint?: PaintOrLayout }).paint,
      (key, value) => map.setPaintProperty(next.id, key, value),
    );
    diffProperties(
      (next as { layout?: PaintOrLayout }).layout,
      (previous as { layout?: PaintOrLayout }).layout,
      (key, value) => map.setLayoutProperty(next.id, key, value),
    );

    const nextFilter = (next as { filter?: unknown }).filter;
    const previousFilter = (previous as { filter?: unknown }).filter;
    if (JSON.stringify(nextFilter) !== JSON.stringify(previousFilter)) {
      map.setFilter(next.id, nextFilter as never);
    }

    if (next.minzoom !== previous.minzoom || next.maxzoom !== previous.maxzoom) {
      map.setLayerZoomRange(next.id, next.minzoom ?? 0, next.maxzoom ?? 24);
    }
  } catch (error) {
    console.error(`[gcl] Failed to update layer "${next.id}":`, error);
  }
}

function diffProperties(
  next: PaintOrLayout,
  previous: PaintOrLayout,
  apply: (key: string, value: unknown) => void,
): void {
  const keys = new Set([
    ...Object.keys(next ?? {}),
    ...Object.keys(previous ?? {}),
  ]);
  for (const key of keys) {
    const nextValue = next?.[key];
    const previousValue = previous?.[key];
    if (nextValue === previousValue) continue;
    if (
      typeof nextValue === 'object' &&
      typeof previousValue === 'object' &&
      JSON.stringify(nextValue) === JSON.stringify(previousValue)
    ) {
      continue;
    }
    apply(key, nextValue);
  }
}
