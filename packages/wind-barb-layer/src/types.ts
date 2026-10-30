import type { Bounds, GeoJson, GeoJsonFeature } from '@hridayanp/geo-utils';

/**
 * A regular grid of vector components.
 *
 * Structurally identical to `WindField` in `@hridayanp/wind-particle-layer`, so
 * the same object drives particles and barbs without conversion. `u` is
 * eastward, `v` northward; row 0 is the northern edge.
 */
export interface WindBarbField {
  kind: 'field';
  u: ArrayLike<number>;
  v: ArrayLike<number>;
  width: number;
  height: number;
  /** Extent of the grid's outer edges, `[west, south, east, north]`. */
  bounds: Bounds;
  /** Cells equal to this (or `NaN`) draw no barb. */
  noData?: number | null;
}

/**
 * Scattered observations carrying a speed and a direction.
 *
 * Structurally identical to `WindPoints` in `@hridayanp/wind-particle-layer`.
 */
export interface WindBarbPoints {
  kind: 'points';
  data: GeoJson | GeoJsonFeature[];
  /** Property holding the speed. Defaults to common spellings. */
  speedProperty?: string;
  /** Property holding the direction, in degrees or a compass name. */
  directionProperty?: string;
  /**
   * `'from'` (meteorological, the default) or `'towards'` (direction of
   * travel).
   */
  directionConvention?: 'from' | 'towards';
}

/** Anything `<WindBarbLayer>` accepts. */
export type WindBarbData = WindBarbField | WindBarbPoints;

/** Unit the input speeds are expressed in. Barbs are always drawn in knots. */
export type WindSpeedUnit = 'kt' | 'm/s' | 'km/h' | 'mph';

/** One resolved barb, ready to place. */
export interface WindBarbSample {
  lng: number;
  lat: number;
  /** Speed in knots. */
  speedKt: number;
  /** Direction the wind blows **from**, degrees clockwise from north. */
  direction: number;
}
