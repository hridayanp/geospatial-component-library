import type { Bounds } from '@hridayanp/geo-utils';
import type { RasterArray, RasterData } from './types';

/**
 * Where to read a GeoTIFF from.
 *
 * A `string` is treated as a URL and read with HTTP range requests, which is
 * what makes Cloud-Optimised GeoTIFFs cheap: only the requested overview is
 * transferred. An `ArrayBuffer` is decoded in place.
 *
 * The library never signs, authenticates or schedules these reads — the host
 * application owns data retrieval and passes in a URL it has already prepared.
 */
export type GeoTIFFSource = string | ArrayBuffer;

export interface DecodeGeoTIFFOptions {
  /** Zero-based band index to read. Default `0`. */
  band?: number;
  /**
   * Which resolution level to decode.
   *
   * `'overview'` (the default) reads the smallest overview the file carries,
   * which is dramatically faster and is the right choice for an animated
   * sequence. `'full'` reads the full-resolution image. A number selects an
   * explicit image index.
   */
  resolution?: 'overview' | 'full' | number;
  /**
   * NoData sentinel. Defaults to the file's own GDAL_NODATA tag, falling back
   * to `-9999` when the tag is absent — the conventional value in most weather
   * and remote-sensing pipelines.
   */
  noData?: number | null;
  /** Unit label carried onto the returned {@link RasterData}. */
  unit?: string;
  /** Passed through to `geotiff`'s reader, e.g. for custom fetch headers. */
  readOptions?: Record<string, unknown>;
}

interface GeoTIFFImageLike {
  getWidth(): number;
  getHeight(): number;
  getBoundingBox(): number[];
  getGDALNoData(): number | null;
  readRasters(options?: Record<string, unknown>): Promise<unknown>;
}

interface GeoTIFFLike {
  getImageCount(): Promise<number>;
  getImage(index?: number): Promise<GeoTIFFImageLike>;
}

let geotiffModule: Promise<typeof import('geotiff')> | null = null;

/**
 * `geotiff` is an optional peer dependency, imported lazily so that an
 * application which only renders arrays it already has in memory never pays to
 * download the decoder.
 */
async function loadGeoTIFF(): Promise<typeof import('geotiff')> {
  if (!geotiffModule) {
    geotiffModule = import('geotiff').catch(() => {
      throw new Error(
        '[gcl] GeoTIFF decoding requires the optional peer dependency "geotiff". Install it with: npm install geotiff',
      );
    });
  }
  return geotiffModule;
}

/**
 * Decode a GeoTIFF (including a Cloud-Optimised GeoTIFF) into a
 * {@link RasterData}.
 *
 * Reading the smallest overview by default is the single biggest performance
 * lever when scrubbing through a time series: it turns a multi-megabyte
 * full-resolution decode into a few hundred kilobytes, and the result is then
 * smoothly upsampled at colourisation time anyway.
 */
export async function decodeGeoTIFF(
  source: GeoTIFFSource,
  options: DecodeGeoTIFFOptions = {},
): Promise<RasterData> {
  const { band = 0, resolution = 'overview', unit, readOptions } = options;
  const { fromArrayBuffer, fromUrl } = await loadGeoTIFF();

  const tiff = (
    typeof source === 'string'
      ? await fromUrl(source, readOptions)
      : await fromArrayBuffer(source)
  ) as unknown as GeoTIFFLike;

  const imageCount = await tiff.getImageCount();
  const index =
    typeof resolution === 'number'
      ? Math.min(Math.max(0, resolution), imageCount - 1)
      : resolution === 'full'
        ? 0
        : imageCount > 1
          ? imageCount - 1
          : 0;

  const image = await tiff.getImage(index);
  const noData =
    options.noData !== undefined
      ? options.noData
      : (image.getGDALNoData() ?? -9999);

  const rasters = (await image.readRasters()) as unknown[];
  const data = rasters[band] as RasterArray | undefined;
  if (!data) {
    throw new Error(
      `[gcl] GeoTIFF has no band at index ${band} (found ${rasters.length}).`,
    );
  }

  const [minX, minY, maxX, maxY] = image.getBoundingBox();
  const bounds: Bounds = [
    minX as number,
    minY as number,
    maxX as number,
    maxY as number,
  ];

  return {
    data,
    width: image.getWidth(),
    height: image.getHeight(),
    bounds,
    noData,
    ...(unit ? { unit } : {}),
  };
}

/**
 * Decode several bands of the same GeoTIFF in one pass.
 *
 * Cheaper than calling {@link decodeGeoTIFF} once per band, since the file
 * header and the requested overview are only read once. Typically used for
 * paired vector components stored as two bands (u/v wind, x/y current).
 */
export async function decodeGeoTIFFBands(
  source: GeoTIFFSource,
  bands: number[],
  options: Omit<DecodeGeoTIFFOptions, 'band'> = {},
): Promise<RasterData[]> {
  const { resolution = 'overview', unit, readOptions } = options;
  const { fromArrayBuffer, fromUrl } = await loadGeoTIFF();

  const tiff = (
    typeof source === 'string'
      ? await fromUrl(source, readOptions)
      : await fromArrayBuffer(source)
  ) as unknown as GeoTIFFLike;

  const imageCount = await tiff.getImageCount();
  const index =
    typeof resolution === 'number'
      ? Math.min(Math.max(0, resolution), imageCount - 1)
      : resolution === 'full'
        ? 0
        : imageCount > 1
          ? imageCount - 1
          : 0;

  const image = await tiff.getImage(index);
  const noData =
    options.noData !== undefined
      ? options.noData
      : (image.getGDALNoData() ?? -9999);
  const rasters = (await image.readRasters()) as unknown[];
  const [minX, minY, maxX, maxY] = image.getBoundingBox();
  const bounds: Bounds = [
    minX as number,
    minY as number,
    maxX as number,
    maxY as number,
  ];
  const width = image.getWidth();
  const height = image.getHeight();

  return bands.map((band) => {
    const data = rasters[band] as RasterArray | undefined;
    if (!data) {
      throw new Error(`[gcl] GeoTIFF has no band at index ${band}.`);
    }
    return {
      data,
      width,
      height,
      bounds,
      noData,
      ...(unit ? { unit } : {}),
    } satisfies RasterData;
  });
}
