import { useDeckLayers } from '@hridayanp/deck-overlay';
import {
  useWindParticleLayers,
  type UseWindParticleLayersOptions,
} from './useWindParticleLayers';

export interface WindParticleLayerProps extends UseWindParticleLayersOptions {
  /** Insert deck's draw call below this MapLibre layer id. */
  beforeId?: string;
  /**
   * Render inside the MapLibre pass so basemap labels can sit above the
   * particles. Default `true`.
   */
  interleaved?: boolean;
}

/**
 * GPU-accelerated animated flow particles.
 *
 * Thousands of particles are advected on the GPU by a UV velocity texture,
 * which is why the field animates smoothly at full frame rate while the CPU
 * stays idle. The component never fetches anything: give it a velocity grid,
 * scattered observations, or a pre-encoded UV image, and it renders.
 *
 * Drop it straight into a `<MapContainer>` and it creates its own deck.gl
 * overlay; wrap several deck-based layers in a `<DeckOverlay>` and they share
 * one.
 *
 * @example Scattered station observations
 * ```tsx
 * <WindParticleLayer
 *   data={{ kind: 'points', data: stations, frameKey: timestamp }}
 *   particleCount={2500}
 *   speedFactor={6}
 *   maxAge={45}
 *   colors={['#93c5fd', '#facc15', '#ef4444']}
 * />
 * ```
 *
 * @example A model velocity grid
 * ```tsx
 * <WindParticleLayer
 *   data={{ kind: 'field', u, v, width, height, bounds }}
 *   maxSpeed={40}
 * />
 * ```
 */
export function WindParticleLayer({
  beforeId,
  interleaved = true,
  ...options
}: WindParticleLayerProps) {
  const layers = useWindParticleLayers(options);

  useDeckLayers(options.id ?? 'gcl-wind-particles', layers, {
    interleaved,
    ...(beforeId ? { beforeId } : {}),
  });

  return null;
}
