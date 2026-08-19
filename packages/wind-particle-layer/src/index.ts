/**
 * `@hridayanp/wind-particle-layer`
 *
 * GPU-accelerated flow-particle animation for any vector field — wind,
 * currents, drift — built on deck.gl and WeatherLayers GL.
 *
 * The package renders; it never retrieves. Data arrives through props as a
 * velocity grid, scattered observations, or a pre-encoded UV image.
 *
 * Requires a `<MapContainer>` ancestor from `@hridayanp/map-container`.
 */

export { WindParticleLayer } from './WindParticleLayer';
export type { WindParticleLayerProps } from './WindParticleLayer';

export {
  DEFAULT_MAX_SPEED,
  DEFAULT_PARTICLE_CONFIG,
  useWindParticleLayers,
} from './useWindParticleLayers';
export type {
  ParticlePalette,
  UseWindParticleLayersOptions,
} from './useWindParticleLayers';

export {
  MAX_TEXTURE_SIZE,
  encodeUVTexture,
  extractWindVectors,
  featureToWindVector,
  fieldToTexture,
  pointsToTexture,
} from './windField';

export type {
  WindField,
  WindImage,
  WindParticleData,
  WindPoints,
  WindTextureSource,
  WindVector,
} from './types';
