import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import maplibregl, {
  type LngLatBoundsLike,
  type Map as MapLibreMap,
  type MapMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl';
import type { Bounds, LngLat, ViewState } from '@hridayanp/geo-utils';
import { MapContext, type MapContextValue } from './context';
import { DEFAULT_MAP_STYLE } from './style';

/** Imperative handle exposed through a ref on `<MapContainer>`. */
export interface MapContainerHandle {
  /** The MapLibre instance, or `null` before it has been created. */
  getMap(): MapLibreMap | null;
  /** Animate the camera to fit a bounding box. */
  fitBounds(bounds: Bounds, options?: { padding?: number; duration?: number }): void;
  /** Jump or ease the camera to a view state. */
  flyTo(view: Partial<ViewState> & { duration?: number }): void;
  /** Force a resize, e.g. after the surrounding layout changed. */
  resize(): void;
}

export interface MapContainerProps {
  /**
   * MapLibre style. Defaults to a blank background so the component never
   * fetches a basemap the host did not ask for.
   */
  mapStyle?: StyleSpecification | string;
  /** Initial (or controlled) centre as `[longitude, latitude]`. */
  center?: LngLat;
  /** Initial (or controlled) zoom level. */
  zoom?: number;
  /** Camera rotation in degrees. */
  bearing?: number;
  /** Camera tilt in degrees. */
  pitch?: number;
  /**
   * Fit this bounding box on mount instead of using `center`/`zoom`.
   * Changing it afterwards re-fits the camera.
   */
  bounds?: Bounds;
  /** Padding in pixels applied when fitting `bounds`. Default `24`. */
  fitBoundsPadding?: number;
  minZoom?: number;
  maxZoom?: number;
  /** Restrict panning to this box. */
  maxBounds?: Bounds;
  /** Set `false` for a static, non-interactive map. Default `true`. */
  interactive?: boolean;
  /**
   * Map projection. `'globe'` requires MapLibre 5+; it is applied defensively
   * and ignored on older versions rather than throwing.
   */
  projection?: 'mercator' | 'globe';
  /** Show MapLibre's attribution control. Default `true`. */
  attributionControl?: boolean;
  /** CSS cursor over the map canvas. */
  cursor?: CSSProperties['cursor'];
  /**
   * Keep the WebGL drawing buffer so `canvas.toDataURL()` works. Costs memory;
   * only enable when you actually need to export the map as an image.
   */
  preserveDrawingBuffer?: boolean;
  /** Repeat the world horizontally when zoomed out. Default `true`. */
  renderWorldCopies?: boolean;

  /** Fired once the style has loaded and layers may be added. */
  onLoad?: (map: MapLibreMap) => void;
  /** Fired continuously while the camera moves. */
  onMove?: (view: ViewState) => void;
  /** Fired once the camera settles. Cheaper to react to than `onMove`. */
  onMoveEnd?: (view: ViewState) => void;
  onClick?: (event: MapMouseEvent) => void;
  onMouseMove?: (event: MapMouseEvent) => void;
  onMouseLeave?: () => void;
  onError?: (error: Error) => void;

  className?: string;
  style?: CSSProperties;
  /**
   * Layers and overlay UI. Layer components attach themselves through context
   * and render nothing; overlay components (legends, controls, timelines)
   * render into an absolutely positioned layer above the canvas.
   */
  children?: ReactNode;
}

const toViewState = (map: MapLibreMap): ViewState => {
  const center = map.getCenter();
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
};

const toLngLatBounds = (bounds: Bounds): LngLatBoundsLike => [
  [bounds[0], bounds[1]],
  [bounds[2], bounds[3]],
];

/**
 * A reusable MapLibre GL map that knows nothing about what is drawn on it.
 *
 * It owns exactly three things: the map instance, the camera, and a React
 * context that lets child layers attach themselves. Data, styling and
 * interpretation all belong to the host application.
 *
 * @example
 * ```tsx
 * <MapContainer center={[92.7, 26.1]} zoom={6} style={{ height: 480 }}>
 *   <RasterLayer data={raster} colorScale={['#001f3f', '#7fdbff']} />
 *   <VectorLayer data={boundaries} stroke="#94a3b8" />
 *   <GeoLegend colorScale={['#001f3f', '#7fdbff']} min={0} max={40} />
 * </MapContainer>
 * ```
 */
export const MapContainer = forwardRef<MapContainerHandle, MapContainerProps>(
  function MapContainer(props, ref) {
    const {
      mapStyle = DEFAULT_MAP_STYLE,
      center,
      zoom,
      bearing,
      pitch,
      bounds,
      fitBoundsPadding = 24,
      minZoom,
      maxZoom,
      maxBounds,
      interactive = true,
      projection,
      attributionControl = true,
      cursor,
      preserveDrawingBuffer = false,
      renderWorldCopies = true,
      onLoad,
      onMove,
      onMoveEnd,
      onClick,
      onMouseMove,
      onMouseLeave,
      onError,
      className,
      style,
      children,
    } = props;

    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const [map, setMap] = useState<MapLibreMap | null>(null);
    const [ready, setReady] = useState(false);
    const [styleVersion, setStyleVersion] = useState(0);

    // Handlers live in a ref so changing one never tears down a map listener.
    const handlers = useRef({
      onLoad,
      onMove,
      onMoveEnd,
      onClick,
      onMouseMove,
      onMouseLeave,
      onError,
    });
    handlers.current = {
      onLoad,
      onMove,
      onMoveEnd,
      onClick,
      onMouseMove,
      onMouseLeave,
      onError,
    };

    // Initial camera is captured once; afterwards the props act as a
    // controlled camera through the sync effects below.
    const initial = useRef({ center, zoom, bearing, pitch, bounds });
    // The style currently applied to the live map, so the sync effect can tell
    // a genuine change from the initial value the constructor already used.
    const appliedStyle = useRef<StyleSpecification | string>(mapStyle);

    /* -------------------------------------------------------------- */
    /* Create the map exactly once                                     */
    /* -------------------------------------------------------------- */
    useEffect(() => {
      const container = containerRef.current;
      if (!container || mapRef.current) return;

      const instance = new maplibregl.Map({
        container,
        style: mapStyle,
        center: initial.current.center ?? [0, 0],
        zoom: initial.current.zoom ?? 1,
        bearing: initial.current.bearing ?? 0,
        pitch: initial.current.pitch ?? 0,
        interactive,
        attributionControl: attributionControl ? {} : false,
        renderWorldCopies,
        ...(minZoom != null ? { minZoom } : {}),
        ...(maxZoom != null ? { maxZoom } : {}),
        ...(maxBounds ? { maxBounds: toLngLatBounds(maxBounds) } : {}),
        // MapLibre 5 moved this into `canvasContextAttributes`; 4 took it at
        // the top level. Passing both keeps one component working on both.
        ...(preserveDrawingBuffer
          ? ({
              preserveDrawingBuffer: true,
              canvasContextAttributes: { preserveDrawingBuffer: true },
            } as Record<string, unknown>)
          : {}),
      });

      mapRef.current = instance;
      setMap(instance);

      if (initial.current.bounds) {
        instance.fitBounds(toLngLatBounds(initial.current.bounds), {
          padding: fitBoundsPadding,
          duration: 0,
        });
      }

      const handleLoad = () => {
        setReady(true);
        setStyleVersion((v) => v + 1);
        handlers.current.onLoad?.(instance);
      };
      // `styledata` also fires for the initial load and for every setStyle, so
      // layer packages can re-attach after a basemap swap.
      const handleStyleData = () => setStyleVersion((v) => v + 1);
      const handleMove = () => handlers.current.onMove?.(toViewState(instance));
      const handleMoveEnd = () =>
        handlers.current.onMoveEnd?.(toViewState(instance));
      const handleClick = (event: MapMouseEvent) =>
        handlers.current.onClick?.(event);
      const handleMouseMove = (event: MapMouseEvent) =>
        handlers.current.onMouseMove?.(event);
      const handleMouseOut = () => handlers.current.onMouseLeave?.();
      const handleError = (event: { error?: Error }) => {
        if (handlers.current.onError) handlers.current.onError(event.error ?? new Error('Map error'));
        else console.error('[gcl] MapLibre error:', event.error);
      };

      instance.on('load', handleLoad);
      instance.on('styledata', handleStyleData);
      instance.on('move', handleMove);
      instance.on('moveend', handleMoveEnd);
      instance.on('click', handleClick);
      instance.on('mousemove', handleMouseMove);
      instance.on('mouseout', handleMouseOut);
      instance.on('error', handleError);

      return () => {
        instance.off('load', handleLoad);
        instance.off('styledata', handleStyleData);
        instance.off('move', handleMove);
        instance.off('moveend', handleMoveEnd);
        instance.off('click', handleClick);
        instance.off('mousemove', handleMouseMove);
        instance.off('mouseout', handleMouseOut);
        instance.off('error', handleError);
        instance.remove();
        mapRef.current = null;
        setMap(null);
        setReady(false);
      };
      // Creation options are intentionally read once; the effects below keep
      // the live map in sync with any of them that can change.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* -------------------------------------------------------------- */
    /* Keep the live map in sync with changing props                   */
    /* -------------------------------------------------------------- */
    useEffect(() => {
      if (!map) return;
      // The constructor already applied the initial style. Calling setStyle
      // again while it is still loading makes MapLibre throw away the
      // in-progress style and rebuild from scratch, which it warns about.
      if (appliedStyle.current === mapStyle) return;
      appliedStyle.current = mapStyle;
      map.setStyle(mapStyle);
    }, [map, mapStyle]);

    useEffect(() => {
      if (!map || !center) return;
      const current = map.getCenter();
      // Only move when the difference is larger than sub-pixel jitter,
      // otherwise a controlled `center` fights the user's own panning.
      if (
        Math.abs(current.lng - center[0]) < 1e-6 &&
        Math.abs(current.lat - center[1]) < 1e-6
      ) {
        return;
      }
      map.easeTo({ center, duration: 300 });
    }, [map, center]);

    useEffect(() => {
      if (!map || zoom == null) return;
      if (Math.abs(map.getZoom() - zoom) < 1e-4) return;
      map.easeTo({ zoom, duration: 300 });
    }, [map, zoom]);

    useEffect(() => {
      if (!map || bearing == null) return;
      if (Math.abs(map.getBearing() - bearing) < 1e-4) return;
      map.easeTo({ bearing, duration: 300 });
    }, [map, bearing]);

    useEffect(() => {
      if (!map || pitch == null) return;
      if (Math.abs(map.getPitch() - pitch) < 1e-4) return;
      map.easeTo({ pitch, duration: 300 });
    }, [map, pitch]);

    const boundsKey = bounds ? bounds.join(',') : '';
    useEffect(() => {
      if (!map || !bounds) return;
      map.fitBounds(toLngLatBounds(bounds), {
        padding: fitBoundsPadding,
        duration: 400,
      });
      // Keyed on the serialised box so a new array with identical numbers does
      // not re-trigger a camera animation on every render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, boundsKey, fitBoundsPadding]);

    useEffect(() => {
      if (!map) return;
      if (minZoom != null) map.setMinZoom(minZoom);
      if (maxZoom != null) map.setMaxZoom(maxZoom);
    }, [map, minZoom, maxZoom]);

    useEffect(() => {
      if (!map) return;
      map.setMaxBounds(maxBounds ? toLngLatBounds(maxBounds) : null);
    }, [map, maxBounds]);

    useEffect(() => {
      if (!map || !projection) return;
      const setProjection = (
        map as unknown as {
          setProjection?: (spec: { type: string }) => void;
        }
      ).setProjection;
      if (typeof setProjection !== 'function') {
        console.warn(
          '[gcl] This MapLibre version does not support setProjection(); the projection prop was ignored.',
        );
        return;
      }
      setProjection.call(map, { type: projection });
    }, [map, projection]);

    useEffect(() => {
      if (!map) return;
      map.getCanvas().style.cursor = cursor ?? '';
    }, [map, cursor]);

    useEffect(() => {
      if (!map) return;
      const handlerMap = interactive ? 'enable' : 'disable';
      for (const name of [
        'scrollZoom',
        'boxZoom',
        'dragRotate',
        'dragPan',
        'keyboard',
        'doubleClickZoom',
        'touchZoomRotate',
      ] as const) {
        map[name]?.[handlerMap]?.();
      }
    }, [map, interactive]);

    /* -------------------------------------------------------------- */
    /* Resize with the container, not just the window                  */
    /* -------------------------------------------------------------- */
    useEffect(() => {
      const container = containerRef.current;
      if (!map || !container || typeof ResizeObserver === 'undefined') return;
      // MapLibre only listens to window resizes, so a map inside a collapsible
      // panel or a split pane would otherwise stay the wrong size.
      const observer = new ResizeObserver(() => map.resize());
      observer.observe(container);
      return () => observer.disconnect();
    }, [map]);

    /* -------------------------------------------------------------- */
    /* Imperative handle                                               */
    /* -------------------------------------------------------------- */
    const fitBounds = useCallback(
      (target: Bounds, options?: { padding?: number; duration?: number }) => {
        mapRef.current?.fitBounds(toLngLatBounds(target), {
          padding: options?.padding ?? fitBoundsPadding,
          duration: options?.duration ?? 400,
        });
      },
      [fitBoundsPadding],
    );

    useImperativeHandle(
      ref,
      (): MapContainerHandle => ({
        getMap: () => mapRef.current,
        fitBounds,
        flyTo: (view) =>
          mapRef.current?.flyTo({
            ...(view.center ? { center: view.center } : {}),
            ...(view.zoom != null ? { zoom: view.zoom } : {}),
            ...(view.bearing != null ? { bearing: view.bearing } : {}),
            ...(view.pitch != null ? { pitch: view.pitch } : {}),
            duration: view.duration ?? 600,
          }),
        resize: () => mapRef.current?.resize(),
      }),
      [fitBounds],
    );

    const contextValue = useMemo<MapContextValue>(
      () => ({ map, ready, styleVersion }),
      [map, ready, styleVersion],
    );

    return (
      <div
        className={className}
        style={{ position: 'relative', width: '100%', height: '100%', ...style }}
      >
        {/* MapLibre owns this node's children — React must never touch it. */}
        <div
          ref={containerRef}
          style={{ position: 'absolute', inset: 0 }}
          data-gcl-map-canvas=""
        />
        <MapContext.Provider value={contextValue}>
          <div
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            data-gcl-map-overlay=""
          >
            {children}
          </div>
        </MapContext.Provider>
      </div>
    );
  },
);
