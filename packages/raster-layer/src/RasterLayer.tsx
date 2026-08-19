import { useEffect, useMemo, useRef, useState } from 'react';
import type { SourceSpecification } from 'maplibre-gl';
import { boundsToImageCorners } from '@hridayanp/geo-utils';
import { useMapSourceLayers, type ManagedLayer } from '@hridayanp/map-container';
import type { RasterFrameCache, CachedFrame } from './cache';
import { useRasterImage } from './useRasterImage';
import type {
  RasterFrameInfo,
  RasterLayerData,
  RasterRenderOptions,
} from './types';

export interface RasterLayerProps extends RasterRenderOptions {
  /** Unique layer id. Change it only if two raster layers would collide. */
  id?: string;
  /** The raster to draw. `null` renders nothing without unmounting. */
  data?: RasterLayerData | null;
  /** Layer opacity, `0..1`. Default `1`. */
  opacity?: number;
  /** Set `false` to hide without discarding cached frames. Default `true`. */
  visible?: boolean;
  /** Draw below this existing layer id — usually to keep labels legible. */
  beforeId?: string;
  /**
   * GPU sampling when the image is scaled. `'linear'` (default) keeps zooming
   * smooth; `'nearest'` preserves hard cell edges, which is what you want for
   * classified or categorical rasters.
   */
  resampling?: 'linear' | 'nearest';
  /**
   * Cross-fade two image buffers instead of swapping one in place. This is
   * what removes the flash when stepping through an animated sequence — see
   * the note on the component below. Default `true`.
   */
  doubleBuffered?: boolean;
  /** Supply a cache to control frame retention across layers or unmounts. */
  cache?: RasterFrameCache;
  /** Fired whenever a new frame has been decoded and placed on the map. */
  onFrame?: (info: RasterFrameInfo) => void;
  /** Fired while a frame is decoding, and again when it finishes. */
  onLoadingChange?: (loading: boolean) => void;
  /** Fired when decoding or colourising fails. */
  onError?: (error: Error) => void;
}

type BufferState = {
  a: CachedFrame | null;
  b: CachedFrame | null;
  active: 'a' | 'b';
};

const imageSource = (frame: CachedFrame | null): SourceSpecification | null =>
  frame
    ? ({
        type: 'image',
        url: frame.url,
        coordinates: boundsToImageCorners(frame.bounds),
      } as SourceSpecification)
    : null;

/**
 * A generic raster visualisation layer.
 *
 * This one component replaces what is usually a family of near-identical
 * per-variable layers (temperature, rainfall, probability, pressure…). Those
 * differ only in their data and their colour ramp — both of which are props
 * here, so there is nothing left to specialise.
 *
 * ## Why two buffers
 *
 * Updating a MapLibre `image` source in place makes it cross-fade over 300ms
 * by default, and replacing the source outright unmounts and remounts the
 * layer — either way the raster visibly flashes on every timeline step. So the
 * layer keeps two image sources permanently mounted and simply swaps which one
 * is opaque, after waiting two animation frames for the incoming texture to be
 * uploaded. The result is a hard, blink-free cut between frames.
 *
 * @example Static raster
 * ```tsx
 * <RasterLayer data={raster} colorScale={['#0b2545', '#f4d35e']} />
 * ```
 *
 * @example Animated sequence with stable colours and cached frames
 * ```tsx
 * <RasterLayer
 *   data={frames[index].raster}
 *   frameKey={frames[index].timestamp}
 *   colorScale={palette}
 *   min={0}
 *   max={100}
 *   opacity={0.75}
 * />
 * ```
 */
export function RasterLayer({
  id = 'gcl-raster',
  data,
  opacity = 1,
  visible = true,
  beforeId,
  resampling = 'linear',
  doubleBuffered = true,
  cache,
  onFrame,
  onLoadingChange,
  onError,
  ...renderOptions
}: RasterLayerProps) {
  const { frame, loading, error } = useRasterImage(visible ? data : null, {
    ...renderOptions,
    ...(cache ? { cache } : {}),
    ...(onError ? { onError } : {}),
  });

  const [buffers, setBuffers] = useState<BufferState>({
    a: null,
    b: null,
    active: 'a',
  });
  const activeRef = useRef<'a' | 'b'>('a');
  const rafRef = useRef<number | null>(null);
  const frameStart = useRef<number>(0);

  const callbacks = useRef({ onFrame, onLoadingChange });
  callbacks.current = { onFrame, onLoadingChange };

  useEffect(() => {
    callbacks.current.onLoadingChange?.(loading);
    if (loading) frameStart.current = performance.now();
  }, [loading]);

  /* ---------------------------------------------------------------- */
  /* Publish each decoded frame into the inactive buffer, then flip     */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!frame) {
      setBuffers({ a: null, b: null, active: 'a' });
      activeRef.current = 'a';
      return;
    }

    const publish = () => {
      callbacks.current.onFrame?.({
        bounds: frame.bounds,
        domain: frame.domain,
        cached: performance.now() - frameStart.current < 2,
        durationMs: Math.max(0, performance.now() - frameStart.current),
      });
    };

    if (!doubleBuffered) {
      setBuffers({ a: frame, b: null, active: 'a' });
      activeRef.current = 'a';
      publish();
      return;
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setBuffers((current) => {
      // First frame: nothing to cross-fade from, so show it immediately.
      if (!current.a && !current.b) {
        activeRef.current = 'a';
        return { a: frame, b: null, active: 'a' };
      }
      const target = activeRef.current === 'a' ? 'b' : 'a';
      return { ...current, [target]: frame };
    });

    // Two frames: one for React to commit the new source, one for MapLibre to
    // finish uploading the texture. Flipping any sooner shows a blank buffer.
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setBuffers((current) => {
          if (!current.a && !current.b) return current;
          const next = activeRef.current === 'a' ? 'b' : 'a';
          if (!current[next]) return current;
          activeRef.current = next;
          return { ...current, active: next };
        });
        publish();
      });
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [frame, doubleBuffered]);

  useEffect(() => {
    if (error) console.error(`[gcl] RasterLayer "${id}":`, error);
  }, [error, id]);

  const paintFor = (buffer: 'a' | 'b') => ({
    'raster-opacity': buffers.active === buffer ? opacity : 0,
    'raster-resampling': resampling,
    // MapLibre's own 300ms image cross-fade fights the manual buffer swap and
    // shows as a blink; the swap above already provides the transition.
    'raster-fade-duration': 0,
  });

  const layersA = useMemo<ManagedLayer[]>(
    () => [{ id: `${id}-a`, type: 'raster', paint: paintFor('a') } as ManagedLayer],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, buffers.active, opacity, resampling],
  );
  const layersB = useMemo<ManagedLayer[]>(
    () => [{ id: `${id}-b`, type: 'raster', paint: paintFor('b') } as ManagedLayer],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, buffers.active, opacity, resampling],
  );

  const sourceA = useMemo(
    () => (visible ? imageSource(buffers.a) : null),
    [visible, buffers.a],
  );
  const sourceB = useMemo(
    () => (visible ? imageSource(buffers.b) : null),
    [visible, buffers.b],
  );

  useMapSourceLayers({
    sourceId: `${id}-src-a`,
    source: sourceA,
    layers: layersA,
    ...(beforeId ? { beforeId } : {}),
  });

  useMapSourceLayers({
    sourceId: `${id}-src-b`,
    source: sourceB,
    layers: layersB,
    ...(beforeId ? { beforeId } : {}),
  });

  return null;
}
