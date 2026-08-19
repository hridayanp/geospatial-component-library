import type { Bounds, GeoJson, GeoJsonFeature } from '@hridayanp/geo-utils';

/**
 * A regular grid of vector components — the canonical form of a flow field.
 *
 * `u` is the eastward component and `v` the northward one, both in the same
 * unit as {@link WindParticleLayerProps.maxSpeed}. Row 0 is the **northern**
 * edge, matching image space and GeoTIFF row order.
 */
export interface WindField {
  kind: 'field';
  u: ArrayLike<number>;
  v: ArrayLike<number>;
  width: number;
  height: number;
  /** Extent of the grid's outer edges, `[west, south, east, north]`. */
  bounds: Bounds;
  /** Cells equal to this (or `NaN`) draw no particles. */
  noData?: number | null;
}

/**
 * Scattered observations — stations, buoys, model points — carrying a speed
 * and a direction rather than components.
 *
 * The layer rasterises them onto a regular grid, filling small gaps with a
 * distance-weighted average of their neighbours so the result reads as one
 * continuous flow instead of a grid of isolated arrows.
 */
export interface WindPoints {
  kind: 'points';
  /** GeoJSON of point (or polygon-centroid) features. */
  data: GeoJson | GeoJsonFeature[];
  /**
   * Property holding the speed. Defaults to a list of common spellings —
   * `speed`, `wind_speed`, `wind_speed_kt`, `ws`, `value`…
   */
  speedProperty?: string;
  /**
   * Property holding the direction, in degrees or as a compass name.
   * Defaults to common spellings — `direction`, `wind_dir_deg`, `dir`…
   */
  directionProperty?: string;
  /**
   * How to read the direction.
   *
   * `'from'` (the meteorological convention, and the default) means the value
   * is where the flow comes *from*, so particles travel the opposite way.
   * `'towards'` means the value is the direction of travel itself.
   */
  directionConvention?: 'from' | 'towards';
  /**
   * Cache identity for the built texture. Supply the frame's timestamp and a
   * timeline step will not rebuild an identical field.
   */
  frameKey?: string;
}

/**
 * A UV-encoded image the host produced elsewhere — a pre-baked PNG from a
 * processing pipeline, for instance.
 *
 * The encoding must match WeatherLayers' `imageUnscale` contract: red carries
 * the eastward component and green the northward one, each linearly mapped
 * from `imageUnscale` onto `0..255`, with alpha `255` where data exists.
 */
export interface WindImage {
  kind: 'image';
  url: string;
  bounds: Bounds;
  /** Value range the bytes decode back to. Default `[-maxSpeed, maxSpeed]`. */
  imageUnscale?: [number, number];
}

/** Anything `<WindParticleLayer>` will accept as its `data`. */
export type WindParticleData = WindField | WindPoints | WindImage;

/** A single vector sample extracted from scattered input. */
export interface WindVector {
  lon: number;
  lat: number;
  /** Magnitude, clamped onto the layer's speed scale. */
  speed: number;
  /** Direction in degrees, normalised to the layer's convention. */
  direction: number;
  /** Eastward component. */
  u: number;
  /** Northward component. */
  v: number;
}

/** A UV texture ready to hand to WeatherLayers. */
export interface WindTextureSource {
  /** PNG data URL. */
  url: string;
  bounds: Bounds;
  /** Value range the bytes decode back to. */
  imageUnscale: [number, number];
  /** Identity used to avoid rebuilding an unchanged field. */
  key: string;
}
