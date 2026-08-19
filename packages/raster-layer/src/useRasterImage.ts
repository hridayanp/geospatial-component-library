import { useEffect, useMemo, useRef, useState } from 'react';
import {
  decodeGeoTIFF,
  rasterToDataUrl,
  resolveDomain,
  type RasterData,
} from '@hridayanp/raster-utils';
import { defaultFrameCache, RasterFrameCache, type CachedFrame } from './cache';
import type { RasterLayerData, RasterRenderOptions } from './types';

const isImageInput = (
  data: RasterLayerData,
): data is Extract<RasterLayerData, { kind: 'image' }> =>
  (data as { kind?: string }).kind === 'image';

const isGeoTIFFInput = (
  data: RasterLayerData,
): data is Extract<RasterLayerData, { kind: 'geotiff' }> =>
  (data as { kind?: string }).kind === 'geotiff';

/**
 * Turn any accepted raster input into a colourised image plus its extent.
 *
 * Decoding is asynchronous and cancellable: if the caller advances the
 * timeline while a frame is still decoding, the stale result is discarded
 * rather than being allowed to overwrite a newer one. That single guard is the
 * difference between a timeline that tracks the scrubber and one that appears
 * to lag or jump backwards.
 */
export function useRasterImage(
  data: RasterLayerData | null | undefined,
  options: RasterRenderOptions & {
    /** Multiplies the alpha of the produced image. Prefer layer opacity. */
    opacity?: number;
    /** Supply your own cache to control its lifetime and size. */
    cache?: RasterFrameCache;
    onError?: (error: Error) => void;
  } = {},
): {
  frame: CachedFrame | null;
  loading: boolean;
  error: Error | null;
  /** `true` when the current frame was served from cache. */
  fromCache: boolean;
} {
  const {
    colorScale = ['#000000', '#ffffff'],
    min,
    max,
    smoothFactor = 6,
    smoothEdges = false,
    alphaFade = [0.03, 0.09],
    clipBelow,
    clipAbove,
    frameKey,
    opacity = 1,
    cache = defaultFrameCache,
    onError,
  } = options;

  const [frame, setFrame] = useState<CachedFrame | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Serialising the colour configuration gives a stable dependency: callers
  // routinely pass a fresh array literal for `colorScale` on every render.
  const styleKey = useMemo(
    () =>
      JSON.stringify([
        colorScale,
        min,
        max,
        smoothFactor,
        smoothEdges,
        alphaFade,
        clipBelow,
        clipAbove,
        opacity,
      ]),
    [
      colorScale,
      min,
      max,
      smoothFactor,
      smoothEdges,
      alphaFade,
      clipBelow,
      clipAbove,
      opacity,
    ],
  );

  // A change of colour scale invalidates every previously coloured frame.
  const previousStyleKey = useRef(styleKey);
  if (previousStyleKey.current !== styleKey) {
    previousStyleKey.current = styleKey;
    cache.clear();
  }

  const requestId = useRef(0);

  useEffect(() => {
    if (!data) {
      setFrame(null);
      setLoading(false);
      return;
    }

    // Pre-coloured images need no work at all.
    if (isImageInput(data)) {
      setFrame({
        url: data.url,
        bounds: data.bounds,
        domain: [min ?? 0, max ?? 1],
      });
      setLoading(false);
      setError(null);
      setFromCache(false);
      return;
    }

    const key = frameKey ? `${frameKey}::${styleKey}` : null;
    if (key) {
      const cached = cache.get(key);
      if (cached) {
        setFrame(cached);
        setLoading(false);
        setError(null);
        setFromCache(true);
        return;
      }
    }

    const id = ++requestId.current;
    let cancelled = false;
    setLoading(true);
    setFromCache(false);

    (async () => {
      try {
        const raster: RasterData = isGeoTIFFInput(data)
          ? await decodeGeoTIFF(data.source, {
              band: data.band ?? 0,
              resolution: data.resolution ?? 'overview',
              ...(data.noData !== undefined ? { noData: data.noData } : {}),
            })
          : data;

        // A newer request superseded this one while the file was decoding.
        if (cancelled || requestId.current !== id) return;

        const domain = resolveDomain(raster, min, max);
        const result = rasterToDataUrl(raster, {
          colorScale,
          min: domain[0],
          max: domain[1],
          opacity,
          smoothFactor,
          smoothEdges,
          alphaFade,
          ...(clipBelow != null ? { clipBelow } : {}),
          ...(clipAbove != null ? { clipAbove } : {}),
        });

        if (cancelled || requestId.current !== id) return;

        const next: CachedFrame = {
          url: result.url,
          bounds: result.bounds,
          domain: result.domain,
        };
        if (key) cache.set(key, next);
        setFrame(next);
        setError(null);
        setLoading(false);
      } catch (thrown) {
        if (cancelled || requestId.current !== id) return;
        const wrapped =
          thrown instanceof Error ? thrown : new Error(String(thrown));
        setError(wrapped);
        setLoading(false);
        onErrorRef.current?.(wrapped);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, styleKey, frameKey, cache]);

  return { frame, loading, error, fromCache };
}

/**
 * Decode and cache a frame without rendering it.
 *
 * The host owns data retrieval, so it also owns prefetching: call this for the
 * next frame in a sequence while the current one is on screen and the timeline
 * step that follows becomes a texture swap instead of a decode.
 *
 * @example
 * ```ts
 * useEffect(() => {
 *   const next = frames[index + 1];
 *   if (next) void preloadRasterFrame(next.data, { colorScale, frameKey: next.id });
 * }, [index]);
 * ```
 */
export async function preloadRasterFrame(
  data: RasterLayerData,
  options: RasterRenderOptions & {
    opacity?: number;
    cache?: RasterFrameCache;
  } = {},
): Promise<CachedFrame | null> {
  const {
    colorScale = ['#000000', '#ffffff'],
    min,
    max,
    smoothFactor = 6,
    smoothEdges = false,
    alphaFade = [0.03, 0.09],
    clipBelow,
    clipAbove,
    frameKey,
    opacity = 1,
    cache = defaultFrameCache,
  } = options;

  if (isImageInput(data)) {
    return { url: data.url, bounds: data.bounds, domain: [min ?? 0, max ?? 1] };
  }

  const styleKey = JSON.stringify([
    colorScale,
    min,
    max,
    smoothFactor,
    smoothEdges,
    alphaFade,
    clipBelow,
    clipAbove,
    opacity,
  ]);
  const key = frameKey ? `${frameKey}::${styleKey}` : null;
  if (key) {
    const cached = cache.get(key);
    if (cached) return cached;
  }

  const raster = isGeoTIFFInput(data)
    ? await decodeGeoTIFF(data.source, {
        band: data.band ?? 0,
        resolution: data.resolution ?? 'overview',
        ...(data.noData !== undefined ? { noData: data.noData } : {}),
      })
    : data;

  const domain = resolveDomain(raster, min, max);
  const result = rasterToDataUrl(raster, {
    colorScale,
    min: domain[0],
    max: domain[1],
    opacity,
    smoothFactor,
    smoothEdges,
    alphaFade,
    ...(clipBelow != null ? { clipBelow } : {}),
    ...(clipAbove != null ? { clipAbove } : {}),
  });

  const frame: CachedFrame = {
    url: result.url,
    bounds: result.bounds,
    domain: result.domain,
  };
  if (key) cache.set(key, frame);
  return frame;
}
