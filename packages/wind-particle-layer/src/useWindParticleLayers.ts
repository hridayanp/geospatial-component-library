import { useEffect, useMemo, useRef, useState } from 'react';
import * as WeatherLayers from 'weatherlayers-gl';
import { ClipExtension } from '@deck.gl/extensions';
import type { Layer } from '@deck.gl/core';
import { MERCATOR_MAX_LATITUDE } from '@hridayanp/geo-utils';
import {
  extractWindVectors,
  fieldToTexture,
  pointsToTexture,
} from './windField';
import type { WindParticleData, WindTextureSource } from './types';

/** Full-scale speed, in whatever unit the data uses. */
export const DEFAULT_MAX_SPEED = 60;

/**
 * Defaults tuned for a readable field at continental scale.
 *
 * They are exported so an application can start from them and vary one value,
 * rather than rediscovering a workable combination from scratch.
 */
export const DEFAULT_PARTICLE_CONFIG = {
  /** Total particles. The dominant cost — raise it only as far as you must. */
  particleCount: 2500,
  /** Trail length in frames. Higher means longer, more persistent streaks. */
  maxAge: 45,
  /** Multiplier on the flow speed. */
  speedFactor: 6,
  /** Stroke width in pixels. */
  width: 1.4,
  /** Extra pre-blur of the field, in cells. Softens coarse grids. */
  imageSmoothing: 0.6,
} as const;

/** A WeatherLayers palette: one colour, or value/colour stops. */
export type ParticlePalette = string | Array<[number, string]>;

export interface UseWindParticleLayersOptions {
  /** The flow field to animate. */
  data?: WindParticleData | null;
  /** Set `false` to stop rendering without unmounting. Default `true`. */
  visible?: boolean;
  /** deck.gl layer id. Must be unique on the map. */
  id?: string;
  /** Number of particles. Default `2500`. */
  particleCount?: number;
  /** Trail length. Default `45`. */
  maxAge?: number;
  /** Speed multiplier. Default `6`. */
  speedFactor?: number;
  /** Particle stroke width in pixels. Default `1.4`. */
  width?: number;
  /** Layer opacity, `0..1`. Default `0.9`. */
  opacity?: number;
  /** A single RGBA colour for every particle. Overrides `colors`. */
  color?: [number, number, number, number];
  /**
   * Colour ramp for particles, applied by reconstructed speed.
   *
   * The GPU recovers speed as `sqrt(u² + v²)` at each particle's position and
   * samples the ramp with it, so colour varies continuously across the field
   * rather than per source point.
   */
  colors?: string[];
  /** Explicit value/colour stops, when even spacing is not what you want. */
  palette?: ParticlePalette;
  /** Full-scale speed. Values above it are clamped. Default `60`. */
  maxSpeed?: number;
  /**
   * GPU interpolation of the field.
   *
   * `CUBIC` (the default) blends neighbouring cells so the flow reads as one
   * continuous field with no seams. `NEAREST` makes each particle move at
   * exactly its own cell's velocity — point-exact, but visibly stepped.
   */
  imageInterpolation?: (typeof WeatherLayers.ImageInterpolation)[keyof typeof WeatherLayers.ImageInterpolation];
  /** Extra pre-blur in cells. Default `0.6`. */
  imageSmoothing?: number;
  /**
   * Cross-fade duration in milliseconds when the field changes.
   *
   * The old and new fields are blended on the GPU, so particles keep their
   * positions and trails through a timeline step instead of restarting. `0`
   * disables the blend.
   */
  transitionMs?: number;
  /** Stop drawing above this zoom. `null` keeps particles at every zoom. */
  maxZoom?: number | null;
  /** Called when building the field fails. */
  onError?: (error: Error) => void;
}

/**
 * Build the deck.gl particle layers for a flow field.
 *
 * Exposed separately from the component so an application that already manages
 * its own deck.gl layer list can drop these into it.
 */
export function useWindParticleLayers(
  options: UseWindParticleLayersOptions,
): Layer[] {
  const {
    data,
    visible = true,
    id = 'gcl-wind-particles',
    particleCount = DEFAULT_PARTICLE_CONFIG.particleCount,
    maxAge = DEFAULT_PARTICLE_CONFIG.maxAge,
    speedFactor = DEFAULT_PARTICLE_CONFIG.speedFactor,
    width = DEFAULT_PARTICLE_CONFIG.width,
    opacity = 0.9,
    color,
    colors,
    palette,
    maxSpeed = DEFAULT_MAX_SPEED,
    imageInterpolation = WeatherLayers.ImageInterpolation.CUBIC,
    imageSmoothing = DEFAULT_PARTICLE_CONFIG.imageSmoothing,
    transitionMs = 900,
    maxZoom = null,
    onError,
  } = options;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  /* ---------------------------------------------------------------- */
  /* 1. Input → UV texture source                                      */
  /* ---------------------------------------------------------------- */
  const source = useMemo<WindTextureSource | null>(() => {
    if (!visible || !data) return null;
    try {
      switch (data.kind) {
        case 'image':
          return {
            url: data.url,
            bounds: data.bounds,
            imageUnscale: data.imageUnscale ?? [-maxSpeed, maxSpeed],
            key: data.url,
          };
        case 'field':
          return fieldToTexture(data, maxSpeed);
        case 'points': {
          const vectors = extractWindVectors(data, maxSpeed);
          return pointsToTexture(vectors, {
            maxSpeed,
            ...(data.frameKey ? { key: data.frameKey } : {}),
          });
        }
        default:
          return null;
      }
    } catch (thrown) {
      const error = thrown instanceof Error ? thrown : new Error(String(thrown));
      console.warn('[gcl] Failed to build the wind field:', error);
      onErrorRef.current?.(error);
      return null;
    }
  }, [data, visible, maxSpeed]);

  const resolvedPalette = useMemo<ParticlePalette | null>(() => {
    if (palette) return palette;
    if (!colors || colors.length === 0) return null;
    if (colors.length === 1) return colors[0] as string;
    // Spread the ramp evenly across the speed scale.
    return colors.map((entry, index) => [
      (index / (colors.length - 1)) * maxSpeed,
      entry,
    ]) as Array<[number, string]>;
  }, [palette, colors, maxSpeed]);

  /* ---------------------------------------------------------------- */
  /* 2. Texture source → GPU textures, with a cross-fade               */
  /* ---------------------------------------------------------------- */
  const [texture, setTexture] = useState<WeatherLayers.TextureData | null>(null);
  const [previousTexture, setPreviousTexture] =
    useState<WeatherLayers.TextureData | null>(null);
  const [bounds, setBounds] = useState<WindTextureSource['bounds'] | null>(null);
  const [unscale, setUnscale] = useState<[number, number]>([-maxSpeed, maxSpeed]);
  const [blend, setBlend] = useState(1);
  const requestRef = useRef(0);

  const sourceKey = source?.key ?? null;

  useEffect(() => {
    if (!source) {
      setTexture(null);
      setPreviousTexture(null);
      setBounds(null);
      return;
    }

    const requestId = ++requestRef.current;
    let cancelled = false;

    // `cache: false` — a generated field produces a unique data URL every
    // frame, so the built-in URL cache would grow without bound.
    WeatherLayers.loadTextureData(source.url, { cache: false })
      .then((loaded) => {
        if (cancelled || requestRef.current !== requestId) return;
        setTexture((current) => {
          // Blending is only meaningful between grids of identical shape;
          // otherwise the two fields would be sampled at mismatched cells.
          const blendable =
            !!current &&
            current.width === loaded.width &&
            current.height === loaded.height;
          setPreviousTexture(blendable ? current : null);
          setBlend(blendable && transitionMs > 0 ? 0 : 1);
          return loaded;
        });
        setBounds(source.bounds);
        setUnscale(source.imageUnscale);
      })
      .catch((thrown: unknown) => {
        if (cancelled) return;
        const error =
          thrown instanceof Error ? thrown : new Error(String(thrown));
        console.warn('[gcl] Failed to load the wind texture:', error);
        onErrorRef.current?.(error);
        setTexture(null);
        setPreviousTexture(null);
        setBounds(null);
      });

    return () => {
      cancelled = true;
    };
    // Keyed on the source's identity rather than its object reference, so an
    // unchanged field does not trigger a reload every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, transitionMs]);

  useEffect(
    () => () => {
      setTexture(null);
      setPreviousTexture(null);
      setBounds(null);
    },
    [],
  );

  /* ---------------------------------------------------------------- */
  /* 3. Drive the cross-fade                                           */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (blend >= 1) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / Math.max(1, transitionMs));
      // Smoothstep, so the field eases in and out rather than sliding linearly.
      setBlend(t * t * (3 - 2 * t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Keyed on the incoming texture: a new field restarts the fade, and
    // `blend` is written (not read) inside the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture, transitionMs]);

  /* ---------------------------------------------------------------- */
  /* 4. Textures → ParticleLayer                                       */
  /* ---------------------------------------------------------------- */
  return useMemo<Layer[]>(() => {
    if (!visible || !texture || !bounds) return [];
    const blending = !!previousTexture && blend < 1;

    return [
      new WeatherLayers.ParticleLayer({
        id,
        // While transitioning, flow out of the previous field into the new one.
        image: blending ? previousTexture : texture,
        image2: blending ? texture : null,
        imageWeight: blending ? blend : 0,
        imageUnscale: unscale,
        imageMinValue: 0,
        imageMaxValue: maxSpeed,
        imageInterpolation,
        imageSmoothing,
        bounds,
        numParticles: particleCount,
        maxAge,
        speedFactor,
        width,
        ...(color ? { color } : {}),
        ...(resolvedPalette ? { palette: resolvedPalette } : {}),
        opacity,
        animate: true,
        maxZoom,
        // Without clipping, particles wrap past the poles and smear across the
        // top and bottom of the map.
        extensions: [new ClipExtension()],
        clipBounds: [-181, -MERCATOR_MAX_LATITUDE, 181, MERCATOR_MAX_LATITUDE],
      } as never) as unknown as Layer,
    ];
  }, [
    visible,
    texture,
    previousTexture,
    blend,
    bounds,
    unscale,
    maxSpeed,
    imageInterpolation,
    imageSmoothing,
    id,
    particleCount,
    maxAge,
    speedFactor,
    width,
    color,
    resolvedPalette,
    opacity,
    maxZoom,
  ]);
}
