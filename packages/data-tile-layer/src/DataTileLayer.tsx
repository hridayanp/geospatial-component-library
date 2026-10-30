import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import maplibregl, {
  type MapMouseEvent,
  type RasterTileSource,
  type SourceSpecification,
} from 'maplibre-gl';
import type { Bounds, LngLat } from '@hridayanp/geo-utils';
import {
  useMap,
  useMapEvent,
  useMapSourceLayers,
  type ManagedLayer,
} from '@hridayanp/map-container';
import { rasterToImageData, type ColorScaleInput } from '@hridayanp/raster-utils';
import { DEFAULT_ENCODING, type DataTileValues } from './encoding';
import {
  TileValueCache,
  lngLatToTile,
  loadTileValues,
  tileBounds,
  type DataTileSourceInput,
} from './tiles';

/** What `onHoverValue` and `sample()` report. */
export interface DataTileSample {
  lngLat: LngLat;
  /** Decoded value (or `A − B` in difference mode); `null` over NoData. */
  value: number | null;
  /** Zoom of the tile the value was read from. */
  tileZoom: number;
  /** Pointer position in page coordinates, when produced by hover. */
  point?: { x: number; y: number };
}

/** Imperative handle exposed through a ref. */
export interface DataTileLayerHandle {
  /**
   * Read the value at a position from tiles already loaded — never triggers a
   * request. Returns `null` when no loaded tile covers the position.
   */
  sample(lngLat: LngLat): DataTileSample | null;
  /** Drop every decoded tile and reload. */
  reload(): void;
}

export interface DataTileLayerProps extends DataTileSourceInput {
  /** Unique layer id. Also names the internal tile protocol. */
  id?: string;
  /** Hide without unmounting. Default `true`. */
  visible?: boolean;
  /** Layer opacity, `0..1`. Default `1`. */
  opacity?: number;
  /** Draw below this existing layer id. */
  beforeId?: string;

  /** Colour ramp applied across `min`..`max`. */
  colorScale: ColorScaleInput;
  /**
   * Low end of the colour range. Required: unlike a single raster, a tiled
   * field has no global minimum the browser can see, and per-tile scaling
   * would make every tile edge a colour seam.
   */
  min: number;
  /** High end of the colour range. */
  max: number;
  /** Values below this render transparent. */
  clipBelow?: number;
  /** Values above this render transparent. */
  clipAbove?: number;

  /**
   * Subtract a second tile set, cell by cell, and render `A − B`. Use with a
   * diverging ramp and a symmetric `min`/`max` around zero.
   */
  subtract?: DataTileSourceInput | null;

  /**
   * Identity of the current data. Change it — to a model run and lead time,
   * say — to discard cached tiles and reload. Without it, cached tiles are
   * keyed by the identity of `tiles`/`loadTile`, so memoise `loadTile`.
   */
  frameKey?: string;

  /** Tile edge in pixels. Default `256`. */
  tileSize?: number;
  minZoom?: number;
  /** Highest zoom with tiles; MapLibre overzooms beyond it. Default `10`. */
  maxZoom?: number;
  /** Only request tiles intersecting this box. */
  bounds?: Bounds;
  attribution?: string;
  /** `'nearest'` shows cells as they are; `'linear'` smooths. Default `'linear'`. */
  resampling?: 'nearest' | 'linear';
  /** Decoded tiles kept in memory per tile set. Default `256`. */
  cacheSize?: number;

  /** Fired with the value under the pointer, and `null` when it leaves. */
  onHoverValue?: (sample: DataTileSample | null) => void;
  /** Fired when a tile fails to load or decode. */
  onError?: (error: Error) => void;
}

let instanceCount = 0;

/**
 * A tiled data field — model output, a reanalysis, an elevation model —
 * delivered as value-encoded image tiles and coloured in the browser.
 *
 * Tiles carry **numbers**, not colours: 16-bit values packed into red and green
 * by default. Each tile is decoded once and cached, so changing the colour
 * ramp or the range recolours from memory with no new requests, and the value
 * under the pointer is available exactly rather than inverted from a colour.
 *
 * ```tsx
 * <DataTileLayer
 *   tiles="https://tiles.example.com/t2m/2026103000/{z}/{x}/{y}.png"
 *   encoding={{ format: 'uint16', scale: 0.01, offset: -100 }}
 *   colorScale={palette}
 *   min={-10}
 *   max={45}
 *   frameKey="t2m-2026103000-f012"
 * />
 * ```
 *
 * Pass `subtract` to render the difference between two tile sets — two model
 * runs, a forecast and its analysis — cell by cell.
 */
export const DataTileLayer = forwardRef<DataTileLayerHandle, DataTileLayerProps>(
  function DataTileLayer(
    {
      id = 'gcl-data-tiles',
      visible = true,
      opacity = 1,
      beforeId,
      tiles,
      loadTile,
      encoding = DEFAULT_ENCODING,
      colorScale,
      min,
      max,
      clipBelow,
      clipAbove,
      subtract,
      frameKey,
      tileSize = 256,
      minZoom = 0,
      maxZoom = 10,
      bounds,
      attribution,
      resampling = 'linear',
      cacheSize = 256,
      onHoverValue,
      onError,
    },
    ref,
  ) {
    const { map, ready } = useMap();

    // One protocol scheme per mounted layer, so two layers never share a
    // handler. Schemes must be URL-safe.
    const scheme = useMemo(
      () => `gcl-data-${id.replace(/[^a-z0-9]/gi, '').toLowerCase()}-${++instanceCount}`,
      [id],
    );

    const cacheA = useMemo(() => new TileValueCache(cacheSize), [cacheSize]);
    const cacheB = useMemo(() => new TileValueCache(cacheSize), [cacheSize]);

    // Everything the protocol handler reads lives in a ref, so it always sees
    // the latest props without being re-registered.
    const config = useRef({
      input: { tiles, loadTile, encoding } as DataTileSourceInput,
      subtract: subtract ?? null,
      colorScale,
      min,
      max,
      clipBelow,
      clipAbove,
      onError,
    });
    config.current = {
      input: { tiles, loadTile, encoding },
      subtract: subtract ?? null,
      colorScale,
      min,
      max,
      clipBelow,
      clipAbove,
      onError,
    };

    /* ------------------------------------------------------------ */
    /* Cache invalidation and recolouring                             */
    /* ------------------------------------------------------------ */

    const tilesKey = Array.isArray(tiles) ? tiles.join('|') : (tiles ?? '');
    const dataIdentity = useRef<unknown[]>([]);
    const [dataVersion, setDataVersion] = useState(0);
    useEffect(() => {
      const identity = frameKey != null
        ? [frameKey]
        : [tilesKey, loadTile, subtract?.tiles, subtract?.loadTile, JSON.stringify(encoding)];
      const changed =
        identity.length !== dataIdentity.current.length ||
        identity.some((value, i) => value !== dataIdentity.current[i]);
      if (!changed) return;
      dataIdentity.current = identity;
      cacheA.clear();
      cacheB.clear();
      setDataVersion((v) => v + 1);
    });

    const styleKey = JSON.stringify([colorScale, min, max, clipBelow, clipAbove, Boolean(subtract)]);
    const renderVersion = `${dataVersion}-${styleKey.length}-${hash(styleKey)}`;
    const tileUrl = `${scheme}://{z}/{x}/{y}?v=${renderVersion}`;

    /* ------------------------------------------------------------ */
    /* Protocol                                                       */
    /* ------------------------------------------------------------ */

    useEffect(() => {
      const load = async (
        cache: TileValueCache,
        input: DataTileSourceInput,
        z: number,
        x: number,
        y: number,
        signal: AbortSignal,
      ): Promise<DataTileValues | null> => {
        const key = `${z}/${x}/${y}`;
        const hit = cache.get(key);
        if (hit) return hit;
        const values = await loadTileValues(
          input,
          z,
          x,
          y,
          signal,
          input.encoding ?? DEFAULT_ENCODING,
        );
        if (values) cache.set(key, values);
        return values;
      };

      maplibregl.addProtocol(scheme, async (params, abortController) => {
        const match = /:\/\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
        if (!match) throw new Error(`[gcl] Malformed data tile URL ${params.url}`);
        const [z, x, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
        const current = config.current;
        const signal = abortController.signal;

        try {
          const [a, b] = await Promise.all([
            load(cacheA, current.input, z, x, y, signal),
            current.subtract
              ? load(cacheB, current.subtract, z, x, y, signal)
              : Promise.resolve(null),
          ]);
          if (!a || (current.subtract && !b)) return { data: await emptyTile() };

          let values = a.values;
          if (current.subtract && b) {
            values = new Float32Array(a.values.length);
            for (let i = 0; i < values.length; i++) {
              values[i] = a.values[i]! - (b.values[i] ?? Number.NaN);
            }
          }

          const colorized = rasterToImageData(
            {
              data: values,
              width: a.width,
              height: a.height,
              bounds: tileBounds(z, x, y),
              noData: null,
            },
            {
              colorScale: current.colorScale,
              min: current.min,
              max: current.max,
              alphaFade: null,
              smoothFactor: 1,
              maxDimension: Math.max(a.width, a.height),
              ...(current.clipBelow != null ? { clipBelow: current.clipBelow } : {}),
              ...(current.clipAbove != null ? { clipAbove: current.clipAbove } : {}),
            },
          );
          return { data: await encodePng(colorized.pixels, colorized.width, colorized.height) };
        } catch (error) {
          if (signal.aborted) throw error;
          const failure = error instanceof Error ? error : new Error(String(error));
          current.onError?.(failure);
          return { data: await emptyTile() };
        }
      });

      return () => {
        maplibregl.removeProtocol(scheme);
      };
    }, [scheme, cacheA, cacheB]);

    /* ------------------------------------------------------------ */
    /* Source and layer                                               */
    /* ------------------------------------------------------------ */

    const sourceUrl = useRef(tileUrl);
    const source = useMemo<SourceSpecification | null>(() => {
      if (!visible) return null;
      return {
        type: 'raster',
        tiles: [sourceUrl.current],
        tileSize,
        minzoom: minZoom,
        maxzoom: maxZoom,
        ...(bounds ? { bounds } : {}),
        ...(attribution ? { attribution } : {}),
      };
    }, [visible, tileSize, minZoom, maxZoom, bounds, attribution]);

    const layers = useMemo<ManagedLayer[]>(
      () => [
        {
          id: `${id}-raster`,
          type: 'raster',
          paint: {
            'raster-opacity': opacity,
            'raster-resampling': resampling,
            // A recolour reloads tiles; fading them in would read as flicker.
            'raster-fade-duration': 0,
          },
        } as ManagedLayer,
      ],
      [id, opacity, resampling],
    );

    useMapSourceLayers({
      sourceId: `${id}-src`,
      source,
      layers,
      ...(beforeId ? { beforeId } : {}),
    });

    // Recolour or reload in place: point the live source at a new cache-busting
    // URL. Decoded values are cached, so a pure restyle makes no requests.
    useEffect(() => {
      if (!map || !ready || sourceUrl.current === tileUrl) return;
      sourceUrl.current = tileUrl;
      const live = map.getSource(`${id}-src`) as RasterTileSource | undefined;
      try {
        live?.setTiles([tileUrl]);
      } catch {
        /* the source may be mid-teardown */
      }
    }, [map, ready, id, tileUrl]);

    /* ------------------------------------------------------------ */
    /* Sampling                                                       */
    /* ------------------------------------------------------------ */

    const sample = (lngLat: LngLat): DataTileSample | null => {
      const subtracting = Boolean(config.current.subtract);
      for (let z = maxZoom; z >= minZoom; z--) {
        const t = lngLatToTile(lngLat[0], lngLat[1], z);
        const x = Math.floor(t.x);
        const y = Math.floor(t.y);
        const key = `${z}/${x}/${y}`;
        const a = cacheA.get(key);
        if (!a) continue;
        const b = subtracting ? cacheB.get(key) : null;
        if (subtracting && !b) continue;
        const column = Math.min(a.width - 1, Math.floor((t.x - x) * a.width));
        const row = Math.min(a.height - 1, Math.floor((t.y - y) * a.height));
        const index = row * a.width + column;
        let value = a.values[index]!;
        if (b) value -= b.values[index]!;
        return {
          lngLat,
          value: Number.isFinite(value) ? value : null,
          tileZoom: z,
        };
      }
      return null;
    };

    useImperativeHandle(ref, () => ({
      sample,
      reload: () => {
        cacheA.clear();
        cacheB.clear();
        setDataVersion((v) => v + 1);
      },
    }));

    useMapEvent(
      'mousemove',
      onHoverValue && visible
        ? (event: MapMouseEvent) => {
            const result = sample([event.lngLat.lng, event.lngLat.lat]);
            const rect = event.target.getContainer().getBoundingClientRect();
            onHoverValue(
              result
                ? {
                    ...result,
                    point: { x: rect.left + event.point.x, y: rect.top + event.point.y },
                  }
                : null,
            );
          }
        : null,
    );
    useMapEvent('mouseout', onHoverValue ? () => onHoverValue(null) : null);

    return null;
  },
);

/** Short stable hash, so the cache-busting parameter stays compact. */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

let encoder: HTMLCanvasElement | null = null;

async function encodePng(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<ArrayBuffer> {
  encoder ??= document.createElement('canvas');
  encoder.width = width;
  encoder.height = height;
  const context = encoder.getContext('2d');
  if (!context) throw new Error('[gcl] 2D canvas unavailable');
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
  const blob = await new Promise<Blob | null>((resolve) =>
    encoder!.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('[gcl] PNG encoding failed');
  return blob.arrayBuffer();
}

let empty: Promise<ArrayBuffer> | null = null;

/** A 1×1 transparent PNG, for tiles with no data. */
function emptyTile(): Promise<ArrayBuffer> {
  empty ??= encodePng(new Uint8ClampedArray(4), 1, 1);
  return empty;
}
