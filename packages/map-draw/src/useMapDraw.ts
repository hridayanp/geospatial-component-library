import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TerraDraw,
  TerraDrawCircleMode,
  TerraDrawFreehandMode,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawSelectMode,
  type GeoJSONStoreFeatures,
  type HexColor,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { GeoJsonFeature } from '@hridayanp/geo-utils';
import { useMap } from '@hridayanp/map-container';
import { measureFeature, type FeatureMeasurement } from './measure';

/** A drawing tool. `'select'` edits, moves and deletes existing shapes. */
export type DrawMode =
  | 'point'
  | 'linestring'
  | 'polygon'
  | 'rectangle'
  | 'circle'
  | 'freehand'
  | 'select';

/** Every tool, in toolbar order. */
export const ALL_DRAW_MODES: readonly DrawMode[] = [
  'select',
  'point',
  'linestring',
  'polygon',
  'rectangle',
  'circle',
  'freehand',
];

export interface UseMapDrawOptions {
  /** Prefix for the layers the drawing engine adds. Default `'gcl-draw'`. */
  id?: string;
  /** Tools to enable. Default: all of them. */
  modes?: readonly DrawMode[];
  /**
   * Shapes present when drawing starts — an existing area of interest to edit,
   * for instance. Read once; afterwards the drawing owns its features and
   * reports them through `onChange`.
   */
  defaultFeatures?: readonly GeoJsonFeature[];
  /** Stroke and fill colour, as `#rrggbb`. Default `'#38bdf8'`. */
  color?: string;
  /**
   * Keep only the most recently finished shape. Suits "draw the area of
   * interest" workflows, where a second shape replaces the first.
   */
  singleFeature?: boolean;
  /** Fired with every finished shape whenever the set changes. */
  onChange?: (features: GeoJsonFeature[]) => void;
  /** Fired once per completed shape, with its geodesic measurements. */
  onFinish?: (feature: GeoJsonFeature, measurement: FeatureMeasurement) => void;
}

export interface MapDrawApi {
  /** Active tool, or `null` when idle (the map pans normally). */
  mode: DrawMode | null;
  setMode: (mode: DrawMode | null) => void;
  /** Finished shapes, in drawing order. */
  features: GeoJsonFeature[];
  /** Id of the shape selected in `'select'` mode. */
  selectedId: string | number | null;
  /** Delete one shape by id. */
  remove: (id: string | number) => void;
  /** Delete the selected shape, if any. */
  removeSelected: () => void;
  /** Delete everything. */
  clear: () => void;
  /** `true` once the drawing engine is attached to the map. */
  ready: boolean;
}

const GUIDE_FLAGS = [
  'currentlyDrawing',
  'closingPoint',
  'snappingPoint',
  'coordinatePoint',
  'selectionPoint',
  'midPoint',
];

const DRAWN_MODES = new Set<string>([
  'point',
  'linestring',
  'polygon',
  'rectangle',
  'circle',
  'freehand',
]);

/** Keep only user shapes; drop the engine's guide and handle features. */
function finished(snapshot: GeoJSONStoreFeatures[]): GeoJsonFeature[] {
  return snapshot
    .filter((feature) => {
      const properties = feature.properties as Record<string, unknown>;
      if (!DRAWN_MODES.has(String(properties['mode']))) return false;
      return !GUIDE_FLAGS.some((flag) => properties[flag]);
    })
    .map((feature) => ({
      type: 'Feature',
      id: feature.id as string | number,
      geometry: feature.geometry as GeoJsonFeature['geometry'],
      properties: { ...(feature.properties as Record<string, unknown>) },
    }));
}

/** Infer the tool a plain GeoJSON feature belongs to, so it can be edited. */
function withMode(feature: GeoJsonFeature): GeoJSONStoreFeatures | null {
  const type = feature.geometry?.type;
  const existing = feature.properties?.['mode'];
  const mode =
    typeof existing === 'string' && DRAWN_MODES.has(existing)
      ? existing
      : type === 'Point'
        ? 'point'
        : type === 'LineString'
          ? 'linestring'
          : type === 'Polygon'
            ? 'polygon'
            : null;
  if (!mode || !feature.geometry) return null;
  return {
    type: 'Feature',
    ...(feature.id != null ? { id: feature.id } : {}),
    geometry: feature.geometry,
    properties: { ...(feature.properties ?? {}), mode },
  } as unknown as GeoJSONStoreFeatures;
}

const asHex = (color: string): HexColor =>
  (/^#[0-9a-f]{6}$/i.test(color) ? color : '#38bdf8') as HexColor;

function buildModes(enabled: readonly DrawMode[], color: string) {
  const hex = asHex(color);
  const outline = { outlineColor: hex, outlineWidth: 2, fillColor: hex, fillOpacity: 0.18 };
  const modes = [];
  if (enabled.includes('point')) {
    modes.push(
      new TerraDrawPointMode({
        styles: { pointColor: hex, pointWidth: 6, pointOutlineColor: '#ffffff', pointOutlineWidth: 2 },
      }),
    );
  }
  if (enabled.includes('linestring')) {
    modes.push(new TerraDrawLineStringMode({ styles: { lineStringColor: hex, lineStringWidth: 3 } }));
  }
  if (enabled.includes('polygon')) {
    modes.push(new TerraDrawPolygonMode({ styles: outline }));
  }
  if (enabled.includes('rectangle')) {
    modes.push(new TerraDrawRectangleMode({ styles: outline }));
  }
  if (enabled.includes('circle')) {
    modes.push(new TerraDrawCircleMode({ styles: outline }));
  }
  if (enabled.includes('freehand')) {
    modes.push(new TerraDrawFreehandMode({ styles: outline }));
  }
  if (enabled.includes('select')) {
    const editable = {
      feature: {
        draggable: true,
        coordinates: { midpoints: true, draggable: true, deletable: true },
      },
    };
    modes.push(
      new TerraDrawSelectMode({
        flags: {
          point: { feature: { draggable: true } },
          linestring: editable,
          polygon: editable,
          freehand: { feature: { draggable: true } },
          rectangle: {
            feature: { draggable: true, coordinates: { draggable: true, resizable: 'opposite' } },
          },
          circle: {
            feature: { draggable: true, coordinates: { draggable: true, resizable: 'center-fixed' } },
          },
        },
        styles: {
          selectedPolygonColor: hex,
          selectedPolygonOutlineColor: hex,
          selectedPolygonOutlineWidth: 3,
          selectedPolygonFillOpacity: 0.3,
          selectedLineStringColor: hex,
          selectedLineStringWidth: 4,
          selectedPointColor: hex,
          selectionPointColor: '#ffffff',
          selectionPointOutlineColor: hex,
          midPointColor: hex,
        },
      }),
    );
  }
  return modes;
}

/**
 * Drawing and editing on the enclosing map, as a hook.
 *
 * Wraps terra-draw: the engine owns pointer handling, snapping and the edit
 * handles, while this hook owns the React side — the active tool, the list of
 * finished shapes, and surviving a basemap switch (MapLibre discards the
 * engine's layers with the old style, so the shapes are snapshotted and
 * restored onto the new one).
 *
 * Use it to build a custom toolbar; `DrawControl` is the ready-made one.
 */
export function useMapDraw({
  id = 'gcl-draw',
  modes = ALL_DRAW_MODES,
  defaultFeatures,
  color = '#38bdf8',
  singleFeature = false,
  onChange,
  onFinish,
}: UseMapDrawOptions = {}): MapDrawApi {
  const { map, ready, styleVersion } = useMap();
  const drawRef = useRef<TerraDraw | null>(null);
  const snapshotRef = useRef<GeoJSONStoreFeatures[] | null>(null);
  const modeRef = useRef<DrawMode | null>(null);

  const [mode, setModeState] = useState<DrawMode | null>(null);
  const [features, setFeatures] = useState<GeoJsonFeature[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [attached, setAttached] = useState(false);

  const callbacks = useRef({ onChange, onFinish, singleFeature });
  callbacks.current = { onChange, onFinish, singleFeature };
  const defaultsRef = useRef(defaultFeatures);

  const modesKey = modes.join('|');

  useEffect(() => {
    if (!map || !ready) return;

    let draw: TerraDraw;
    try {
      draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map, prefixId: id }),
        modes: buildModes(modes, color),
      });
      draw.start();
    } catch (error) {
      console.error('[gcl] Failed to start drawing:', error);
      return;
    }
    drawRef.current = draw;

    // Restore what was there before a style swap, or seed the defaults once.
    const seed =
      snapshotRef.current ??
      (defaultsRef.current ?? [])
        .map(withMode)
        .filter((feature): feature is GeoJSONStoreFeatures => feature !== null);
    if (seed.length) {
      try {
        draw.addFeatures(seed);
      } catch (error) {
        console.warn('[gcl] Some initial draw features were rejected:', error);
      }
    }

    let frame = 0;
    const publish = () => {
      cancelAnimationFrame(frame);
      // Coalesce: terra-draw emits a change per pointer move while editing.
      frame = requestAnimationFrame(() => {
        const next = finished(draw.getSnapshot());
        setFeatures(next);
        callbacks.current.onChange?.(next);
      });
    };

    const onFinishShape = (featureId: string | number) => {
      if (callbacks.current.singleFeature) {
        const others = finished(draw.getSnapshot())
          .map((feature) => feature.id)
          .filter((other): other is string | number => other != null && other !== featureId);
        if (others.length) draw.removeFeatures(others);
      }
      const shape = finished(draw.getSnapshot()).find((feature) => feature.id === featureId);
      if (shape) callbacks.current.onFinish?.(shape, measureFeature(shape));
      publish();
    };

    draw.on('change', publish);
    draw.on('finish', onFinishShape);
    draw.on('select', (featureId) => setSelectedId(featureId));
    draw.on('deselect', () => setSelectedId(null));

    if (modeRef.current && modes.includes(modeRef.current)) draw.setMode(modeRef.current);
    setAttached(true);
    publish();

    return () => {
      cancelAnimationFrame(frame);
      try {
        snapshotRef.current = finished(draw.getSnapshot())
          .map((feature) => {
            // Selection state is transient UI; restoring it would leave a shape
            // looking selected with no selection behind it.
            delete (feature.properties as Record<string, unknown>)['selected'];
            return withMode(feature);
          })
          .filter((feature): feature is GeoJSONStoreFeatures => feature !== null);
      } catch {
        /* the engine may already be detached */
      }
      try {
        draw.stop();
      } catch {
        /* after a style swap its layers are already gone */
      }
      drawRef.current = null;
      setAttached(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, styleVersion, id, modesKey, color]);

  const setMode = useCallback((next: DrawMode | null) => {
    modeRef.current = next;
    setModeState(next);
    const draw = drawRef.current;
    if (!draw) return;
    try {
      // 'static' is terra-draw's built-in idle mode: shapes render, the map pans.
      draw.setMode(next ?? 'static');
    } catch (error) {
      console.warn(`[gcl] Draw mode "${next}" is not enabled.`, error);
    }
  }, []);

  const remove = useCallback((featureId: string | number) => {
    drawRef.current?.removeFeatures([featureId]);
  }, []);

  const removeSelected = useCallback(() => {
    if (selectedId == null) return;
    drawRef.current?.removeFeatures([selectedId]);
    setSelectedId(null);
  }, [selectedId]);

  const clear = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    const ids = finished(draw.getSnapshot())
      .map((feature) => feature.id)
      .filter((value): value is string | number => value != null);
    if (ids.length) draw.removeFeatures(ids);
    setSelectedId(null);
  }, []);

  return { mode, setMode, features, selectedId, remove, removeSelected, clear, ready: attached };
}
