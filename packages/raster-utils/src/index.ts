/**
 * `@hridayanp/raster-utils`
 *
 * The computational half of raster visualisation, kept deliberately free of
 * React and of any map library: statistics, colour ramps, colourisation,
 * value sampling and GeoTIFF/COG decoding.
 *
 * Everything here is a plain function over plain data, so it can run in a web
 * worker, be unit tested without a browser, or be reused by a renderer that
 * has nothing to do with this library.
 */

export type {
  ColorScale,
  ColorScaleInput,
  ColorStop,
  ColorizeOptions,
  ColorizedRaster,
  RasterArray,
  RasterData,
  RasterSample,
  RasterStats,
} from './types';

export {
  DEFAULT_LUT_SIZE,
  buildColorLut,
  colorAt,
  colorScaleColors,
  colorScaleToCss,
  resolveColorScale,
  sampleColorScale,
  toRgba,
} from './color';

export {
  computeRasterStats,
  isValidValue,
  normalizeRaster,
  normalizeValue,
  resolveDomain,
  smoothstep,
} from './stats';

export {
  drawColorizedRaster,
  rasterToBitmap,
  rasterToDataUrl,
  rasterToImageData,
} from './colorize';

export {
  lngLatToRasterXY,
  rasterXYToLngLat,
  sampleRaster,
  sampleRasterAt,
} from './sample';

export { decodeGeoTIFF, decodeGeoTIFFBands } from './geotiff';
export type { DecodeGeoTIFFOptions, GeoTIFFSource } from './geotiff';
