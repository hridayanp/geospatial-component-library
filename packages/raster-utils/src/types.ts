import type { Bounds } from '@hridayanp/geo-utils';

/** Any array shape a decoded raster band realistically arrives in. */
export type RasterArray =
  | Float32Array
  | Float64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array
  | number[];

/**
 * A single georeferenced raster band.
 *
 * This is the one shape every raster component in the library consumes. A host
 * application can build it from a GeoTIFF, a NetCDF slice, a plain array of
 * model output — the library does not care where the numbers came from.
 */
export interface RasterData {
  /** Row-major band values, `width * height` long, top row first. */
  data: RasterArray;
  /** Number of columns. */
  width: number;
  /** Number of rows. */
  height: number;
  /** Geographic extent of the *image edges*, not the outer pixel centres. */
  bounds: Bounds;
  /**
   * Sentinel marking absent measurements. Cells equal to it — and any `NaN` —
   * are rendered fully transparent and excluded from statistics.
   */
  noData?: number | null;
  /** Optional unit label, carried through to legends and hover cards. */
  unit?: string;
}

/** Summary statistics over the valid (non-NoData) cells of a raster. */
export interface RasterStats {
  min: number;
  max: number;
  /** Count of cells that held a real measurement. */
  validCount: number;
  /** Total cells inspected. */
  totalCount: number;
  /** Arithmetic mean of the valid cells, or `null` when there are none. */
  mean: number | null;
}

/**
 * A colour ramp stop. Either a bare colour (positions are then spread evenly)
 * or an explicit `[position, colour]` pair.
 *
 * Positions are expressed in the raster's own value domain when `domain` is
 * supplied to {@link ColorScale}, otherwise in normalised `0..1` space.
 */
export type ColorStop = string | [position: number, color: string];

/** A colour ramp, in the loosest form a component will accept. */
export type ColorScaleInput = string[] | ColorStop[] | ColorScale;

/** A fully resolved colour ramp. */
export interface ColorScale {
  /** Ordered stops, positions already normalised into `0..1`. */
  stops: Array<[position: number, color: string]>;
  /**
   * `'continuous'` interpolates between stops; `'discrete'` snaps to the
   * nearest stop below the value, producing hard classed bands.
   */
  mode: 'continuous' | 'discrete';
  /** Colour space used for interpolation. */
  interpolation: 'rgb' | 'lab' | 'lch' | 'hsl';
}

/** Everything {@link rasterToImageData} needs beyond the raster itself. */
export interface ColorizeOptions {
  /** Colour ramp applied across the value range. */
  colorScale: ColorScaleInput;
  /**
   * Low end of the value range mapped to the first ramp stop. Defaults to the
   * raster's own minimum, which makes each frame self-scaling; pass an explicit
   * value to keep colours stable across an animated sequence.
   */
  min?: number;
  /** High end of the value range. Defaults to the raster's own maximum. */
  max?: number;
  /** Global multiplier applied to every pixel's alpha, `0..1`. Default `1`. */
  opacity?: number;
  /**
   * Output pixels synthesised per source cell. `1` keeps native resolution;
   * higher values bilinearly interpolate the *raw values* before colouring, so
   * the result reads as a continuous field instead of visible grid squares.
   * Default `1`.
   */
  smoothFactor?: number;
  /**
   * Feather the ragged outer edge of the valid-data region so the raster
   * dissolves into transparency instead of showing a boxy outline.
   * Costs an extra blur pass. Default `false`.
   */
  smoothEdges?: boolean;
  /**
   * Normalised band across which alpha ramps up from fully transparent, as
   * `[start, end]`. Keeps the bottom of the ramp from showing a hard on/off
   * edge. Pass `null` to disable and render every valid cell fully opaque.
   * Default `[0.03, 0.09]`.
   */
  alphaFade?: [number, number] | null;
  /**
   * Hard ceiling on the longest edge of the generated image, so a large grid
   * combined with a high `smoothFactor` cannot blow up CPU or GPU cost.
   * Default `1024`.
   */
  maxDimension?: number;
  /** Values below this (after NoData filtering) render transparent. */
  clipBelow?: number;
  /** Values above this render transparent. */
  clipAbove?: number;
}

/** Result of colourising a raster. */
export interface ColorizedRaster {
  /** RGBA pixels, `width * height * 4` long. */
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  /** Extent of the produced image — always the source raster's bounds. */
  bounds: Bounds;
  /** Value range the ramp was stretched across. */
  domain: [number, number];
}

/** A value read out of a raster at a geographic position. */
export interface RasterSample {
  /** Interpolated or nearest band value, or `null` where there is no data. */
  value: number | null;
  /** Source column the position fell in. */
  column: number;
  /** Source row the position fell in. */
  row: number;
}
