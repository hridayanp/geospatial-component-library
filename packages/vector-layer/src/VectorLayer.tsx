import { useCallback, useMemo, useRef } from 'react';
import type {
  FilterSpecification,
  MapLayerMouseEvent,
  SourceSpecification,
} from 'maplibre-gl';
import type { GeoJsonFeature, GeoJson, LngLat } from '@hridayanp/geo-utils';
import { toFeatureCollection } from '@hridayanp/geo-utils';
import {
  useMapLayerEvent,
  useMapSourceLayers,
  type ManagedLayer,
} from '@hridayanp/map-container';

/**
 * A style value: either a literal, or a MapLibre expression that computes it
 * from feature properties.
 *
 * Expressions are what make one generic layer able to replace a dozen
 * hand-written ones — `['get', 'color']` styles every feature from its own
 * data without the component knowing anything about that data.
 */
export type StyleValue<T> = T | unknown[];

/** What a hover or click handler receives. */
export interface VectorInteractionInfo {
  /** The topmost feature under the pointer. */
  feature: GeoJsonFeature;
  /** All features under the pointer, topmost first. */
  features: GeoJsonFeature[];
  /** Geographic position of the pointer. */
  lngLat: LngLat;
  /** Pointer position in page coordinates — ready for a tooltip. */
  point: { x: number; y: number };
  /** Which of the generated sub-layers was hit. */
  layerId: string;
  /** The original MapLibre event, if you need to stop propagation. */
  originalEvent: MapLayerMouseEvent;
}

export interface VectorLayerProps {
  /** Unique layer id; sub-layer ids are derived from it. */
  id?: string;
  /**
   * GeoJSON to render. Accepts a FeatureCollection, a single Feature, a bare
   * geometry or an array of features — whichever shape your data arrives in.
   */
  data?: GeoJson | GeoJsonFeature[] | null;
  /** Hide without unmounting. Default `true`. */
  visible?: boolean;
  /** Multiplies every sub-layer's opacity. Default `1`. */
  opacity?: number;
  /** Draw below this existing layer id. */
  beforeId?: string;
  /** Restrict the whole layer to a zoom range. */
  minZoom?: number;
  maxZoom?: number;

  /** Polygon fill colour. Pass `false` to draw outlines only. */
  fill?: StyleValue<string> | false;
  /** Polygon fill opacity. Default `0.4`. */
  fillOpacity?: StyleValue<number>;
  /** Line and polygon-outline colour. Pass `false` for no stroke. */
  stroke?: StyleValue<string> | false;
  /** Stroke width in pixels. Default `1.5`. */
  strokeWidth?: StyleValue<number>;
  /** Stroke opacity. Default `1`. */
  strokeOpacity?: StyleValue<number>;
  /** Dash pattern in line widths, e.g. `[2, 1]`. */
  strokeDasharray?: number[];

  /** Point radius in pixels. Default `5`. */
  pointRadius?: StyleValue<number>;
  /** Point fill colour. Falls back to `stroke`, then to a neutral grey. */
  pointColor?: StyleValue<string>;
  /** Point outline colour. */
  pointStrokeColor?: StyleValue<string>;
  /** Point outline width. Default `1`. */
  pointStrokeWidth?: StyleValue<number>;

  /**
   * Additional MapLibre filter expression, combined with the internal
   * geometry-type filters. Use it to show a subset without re-slicing the data
   * — cheaper than handing the source a new FeatureCollection.
   */
  filter?: FilterSpecification;

  /** Enable hover and click handling. Default `true` when a handler is given. */
  interactive?: boolean;
  /**
   * Radius of an invisible hit target drawn around each point, in pixels.
   * Small symbols are hard to hover precisely; this widens the target without
   * changing what is drawn. Default `0` (no extra target).
   */
  hitRadius?: number;
  onHover?: (info: VectorInteractionInfo) => void;
  onLeave?: () => void;
  onClick?: (info: VectorInteractionInfo) => void;

  /** Cluster nearby points. Only meaningful for point data. */
  cluster?: boolean;
  /** Cluster radius in pixels. Default `50`. */
  clusterRadius?: number;
  /** Zoom past which points stop clustering. */
  clusterMaxZoom?: number;

  /**
   * Douglas–Peucker simplification tolerance passed to the GeoJSON source.
   * Higher values mean fewer vertices and faster rendering at the cost of
   * fidelity. Default `0.375` (MapLibre's own default).
   */
  tolerance?: number;
}

const POLYGON_FILTER: FilterSpecification = [
  'match',
  ['geometry-type'],
  ['Polygon', 'MultiPolygon'],
  true,
  false,
];
const LINE_FILTER: FilterSpecification = [
  'match',
  ['geometry-type'],
  ['LineString', 'MultiLineString'],
  true,
  false,
];
const POINT_FILTER: FilterSpecification = [
  'match',
  ['geometry-type'],
  ['Point', 'MultiPoint'],
  true,
  false,
];

const combine = (
  base: FilterSpecification,
  extra?: FilterSpecification,
): FilterSpecification =>
  (extra ? ['all', base, extra] : base) as FilterSpecification;

/**
 * A generic GeoJSON layer covering every geometry type.
 *
 * Polygons, lines and points from a single source are drawn by separate
 * MapLibre sub-layers with geometry-type filters, which is the only way to
 * style them independently — but the caller sees one component and one set of
 * props.
 *
 * Because every style prop also accepts a MapLibre expression, per-feature
 * styling needs no special support: bake a value into your properties and read
 * it back with `['get', ...]`.
 *
 * @example Uniform styling
 * ```tsx
 * <VectorLayer data={boundaries} fill={false} stroke="#38bdf8" strokeWidth={1.5} />
 * ```
 *
 * @example Data-driven styling and hover
 * ```tsx
 * <VectorLayer
 *   data={cells}
 *   fill={['coalesce', ['get', 'color'], '#64748b']}
 *   fillOpacity={['interpolate', ['linear'], ['get', 'intensity'], 0, 0.1, 1, 0.8]}
 *   hitRadius={12}
 *   onHover={(info) => setHovered(info)}
 *   onLeave={() => setHovered(null)}
 * />
 * ```
 */
export function VectorLayer({
  id = 'gcl-vector',
  data,
  visible = true,
  opacity = 1,
  beforeId,
  minZoom,
  maxZoom,
  fill = '#38bdf8',
  fillOpacity = 0.4,
  stroke = '#38bdf8',
  strokeWidth = 1.5,
  strokeOpacity = 1,
  strokeDasharray,
  pointRadius = 5,
  pointColor,
  pointStrokeColor = '#ffffff',
  pointStrokeWidth = 1,
  filter,
  interactive,
  hitRadius = 0,
  onHover,
  onLeave,
  onClick,
  cluster = false,
  clusterRadius = 50,
  clusterMaxZoom,
  tolerance,
}: VectorLayerProps) {
  const collection = useMemo(() => toFeatureCollection(data ?? null), [data]);

  const source = useMemo<SourceSpecification | null>(() => {
    if (!visible) return null;
    return {
      type: 'geojson',
      data: collection,
      ...(tolerance != null ? { tolerance } : {}),
      ...(cluster
        ? {
            cluster: true,
            clusterRadius,
            ...(clusterMaxZoom != null ? { clusterMaxZoom } : {}),
          }
        : {}),
    } as SourceSpecification;
  }, [visible, collection, tolerance, cluster, clusterRadius, clusterMaxZoom]);

  const zoomRange = useMemo(
    () => ({
      ...(minZoom != null ? { minzoom: minZoom } : {}),
      ...(maxZoom != null ? { maxzoom: maxZoom } : {}),
    }),
    [minZoom, maxZoom],
  );

  const layers = useMemo<ManagedLayer[]>(() => {
    const built: ManagedLayer[] = [];

    if (fill !== false) {
      built.push({
        id: `${id}-fill`,
        type: 'fill',
        filter: combine(POLYGON_FILTER, filter),
        ...zoomRange,
        paint: {
          'fill-color': fill,
          'fill-opacity': multiply(fillOpacity, opacity),
        },
      } as ManagedLayer);
    }

    if (stroke !== false) {
      // Polygon outlines and standalone lines are separate sub-layers so a
      // polygon can be filled and outlined while a line is only stroked.
      built.push({
        id: `${id}-outline`,
        type: 'line',
        filter: combine(POLYGON_FILTER, filter),
        ...zoomRange,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': stroke,
          'line-width': strokeWidth,
          'line-opacity': multiply(strokeOpacity, opacity),
          ...(strokeDasharray ? { 'line-dasharray': strokeDasharray } : {}),
        },
      } as ManagedLayer);

      built.push({
        id: `${id}-line`,
        type: 'line',
        filter: combine(LINE_FILTER, filter),
        ...zoomRange,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': stroke,
          'line-width': strokeWidth,
          'line-opacity': multiply(strokeOpacity, opacity),
          ...(strokeDasharray ? { 'line-dasharray': strokeDasharray } : {}),
        },
      } as ManagedLayer);
    }

    built.push({
      id: `${id}-point`,
      type: 'circle',
      filter: combine(POINT_FILTER, filter),
      ...zoomRange,
      paint: {
        'circle-radius': pointRadius,
        'circle-color': pointColor ?? (stroke === false ? '#94a3b8' : stroke),
        'circle-opacity': opacity,
        'circle-stroke-color': pointStrokeColor,
        'circle-stroke-width': pointStrokeWidth,
        'circle-stroke-opacity': opacity,
      },
    } as ManagedLayer);

    if (hitRadius > 0) {
      // Not `opacity: 0` — MapLibre skips hit-testing fully transparent
      // geometry, so the target has to be technically visible but invisible.
      built.push({
        id: `${id}-hit`,
        type: 'circle',
        filter: combine(POINT_FILTER, filter),
        ...zoomRange,
        paint: {
          'circle-radius': hitRadius,
          'circle-color': '#000000',
          'circle-opacity': 0.00001,
        },
      } as ManagedLayer);
    }

    return built;
  }, [
    id,
    fill,
    fillOpacity,
    stroke,
    strokeWidth,
    strokeOpacity,
    strokeDasharray,
    pointRadius,
    pointColor,
    pointStrokeColor,
    pointStrokeWidth,
    hitRadius,
    filter,
    opacity,
    zoomRange,
  ]);

  useMapSourceLayers({
    sourceId: `${id}-src`,
    source,
    layers,
    ...(beforeId ? { beforeId } : {}),
  });

  /* ---------------------------------------------------------------- */
  /* Interaction                                                       */
  /* ---------------------------------------------------------------- */
  const isInteractive =
    interactive ?? Boolean(onHover || onClick || onLeave);

  const interactiveLayerIds = useMemo(() => {
    if (!isInteractive) return [];
    const ids = layers.map((layer) => layer.id);
    // Prefer the widened hit target when there is one.
    return hitRadius > 0
      ? ids.filter((layerId) => layerId !== `${id}-point`)
      : ids;
  }, [isInteractive, layers, hitRadius, id]);

  const handlers = useRef({ onHover, onClick, onLeave });
  handlers.current = { onHover, onClick, onLeave };

  const toInfo = useCallback(
    (event: MapLayerMouseEvent): VectorInteractionInfo | null => {
      const features = (event.features ?? []) as unknown as GeoJsonFeature[];
      const feature = features[0];
      if (!feature) return null;
      return {
        feature,
        features,
        lngLat: [event.lngLat.lng, event.lngLat.lat],
        point: {
          x: (event.originalEvent as MouseEvent).clientX,
          y: (event.originalEvent as MouseEvent).clientY,
        },
        layerId: (event as unknown as { layer?: { id: string } }).layer?.id ?? id,
        originalEvent: event,
      };
    },
    [id],
  );

  useMapLayerEvent(
    interactiveLayerIds,
    'mousemove',
    isInteractive && onHover
      ? (event) => {
          const info = toInfo(event as MapLayerMouseEvent);
          if (info) handlers.current.onHover?.(info);
        }
      : null,
  );

  useMapLayerEvent(
    interactiveLayerIds,
    'mouseleave',
    isInteractive && (onLeave || onHover)
      ? () => handlers.current.onLeave?.()
      : null,
  );

  useMapLayerEvent(
    interactiveLayerIds,
    'click',
    isInteractive && onClick
      ? (event) => {
          const info = toInfo(event as MapLayerMouseEvent);
          if (info) handlers.current.onClick?.(info);
        }
      : null,
  );

  return null;
}

/**
 * Fold a global opacity into a style value.
 *
 * A literal can be multiplied outright; an expression has to be wrapped in a
 * `*` expression so the multiplication happens on the GPU per feature.
 */
function multiply(value: StyleValue<number>, factor: number): StyleValue<number> {
  if (factor === 1) return value;
  if (typeof value === 'number') return value * factor;
  return ['*', value, factor];
}
