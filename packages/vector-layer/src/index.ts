/**
 * `@hridayanp/vector-layer`
 *
 * One generic GeoJSON layer for every geometry type, styled entirely through
 * props and MapLibre expressions.
 *
 * Requires a `<MapContainer>` ancestor from `@hridayanp/map-container`.
 */

export { VectorLayer } from './VectorLayer';
export type {
  StyleValue,
  VectorInteractionInfo,
  VectorLayerProps,
} from './VectorLayer';

export type {
  GeoJson,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
} from '@hridayanp/geo-utils';
