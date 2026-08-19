import type { Bounds } from '@hridayanp/geo-utils';
import type { ColorScaleInput, RasterData } from '@hridayanp/raster-utils';

/**
 * A pre-rendered image the host already has — a server-side colourised PNG, a
 * canvas the application drew itself, a tile it stitched.
 *
 * No colour scale is applied; the image is placed on the map as-is.
 */
export interface RasterImageInput {
  kind: 'image';
  /** Image URL, data URL, blob URL or `ImageBitmap`-backed object URL. */
  url: string;
  /** Where to place it, as `[west, south, east, north]`. */
  bounds: Bounds;
}

/**
 * A GeoTIFF or Cloud-Optimised GeoTIFF to decode and colourise in the browser.
 *
 * The library performs the decode but never the retrieval policy: pass a URL
 * your application has already authorised (a signed URL, a proxied path), or
 * an `ArrayBuffer` you fetched yourself.
 */
export interface RasterGeoTIFFInput {
  kind: 'geotiff';
  source: string | ArrayBuffer;
  /** Band index to read. Default `0`. */
  band?: number;
  /** `'overview'` (default) is dramatically faster for animated sequences. */
  resolution?: 'overview' | 'full' | number;
  /** Override the file's own NoData tag. */
  noData?: number | null;
}

/** Anything `<RasterLayer>` will accept as its `data`. */
export type RasterLayerData =
  | RasterData
  | RasterImageInput
  | RasterGeoTIFFInput;

/** Details reported once a frame has been decoded and placed on the map. */
export interface RasterFrameInfo {
  /** Extent the image was placed at. */
  bounds: Bounds;
  /** Value range the colour ramp was stretched across. */
  domain: [number, number];
  /** `true` when the frame came from the in-memory cache rather than a decode. */
  cached: boolean;
  /** Milliseconds spent decoding and colourising. `0` for cache hits. */
  durationMs: number;
}

/** Options shared by the component and the {@link useRasterImage} hook. */
export interface RasterRenderOptions {
  /**
   * Colour ramp. Ignored for `kind: 'image'` data, which is already coloured.
   */
  colorScale?: ColorScaleInput;
  /**
   * Low end of the value range. Defaults to the frame's own minimum, which
   * makes each frame self-scaling — pass an explicit value to keep colours
   * comparable across an animated sequence.
   */
  min?: number;
  /** High end of the value range. */
  max?: number;
  /** Output pixels synthesised per source cell. Default `6`. */
  smoothFactor?: number;
  /** Feather the ragged edge of the valid-data region. Default `false`. */
  smoothEdges?: boolean;
  /**
   * Normalised band across which alpha ramps in, or `null` for a hard edge.
   * Default `[0.03, 0.09]`.
   */
  alphaFade?: [number, number] | null;
  /** Values below this render transparent. */
  clipBelow?: number;
  /** Values above this render transparent. */
  clipAbove?: number;
  /**
   * Cache identity for the decoded frame. Supply a stable key (a timestamp, a
   * file name) and scrubbing back and forth through a sequence becomes
   * instant, because nothing is decoded twice.
   */
  frameKey?: string;
}
