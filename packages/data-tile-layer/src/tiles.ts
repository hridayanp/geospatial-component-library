import {
  decodeTilePixels,
  type DataTileEncoding,
  type DataTileValues,
} from './encoding';

/** What a tile loader may resolve to. */
export type DataTileResult =
  | DataTileValues
  | ImageData
  | ImageBitmap
  | HTMLImageElement
  | HTMLCanvasElement
  | Blob
  | ArrayBuffer
  | null;

/**
 * Host-supplied tile loader.
 *
 * Use it when tiles need an auth header, come from a worker, are generated in
 * the browser, or arrive as raw values rather than images. Returning
 * {@link DataTileValues} skips image decoding entirely. Resolve `null` for a
 * tile that does not exist.
 */
export type DataTileLoader = (
  tile: { z: number; x: number; y: number },
  signal: AbortSignal,
) => Promise<DataTileResult>;

/** Where one set of data tiles comes from. */
export interface DataTileSourceInput {
  /**
   * `{z}/{x}/{y}` URL template(s), fetched with `fetch`. Supply a URL the host
   * has already authorised; the layer owns no credentials and no retry policy.
   */
  tiles?: string | string[];
  /** Custom loader. Takes precedence over `tiles`. */
  loadTile?: DataTileLoader;
  /** Byte layout of the tile images. Default `{ format: 'uint16' }`. */
  encoding?: DataTileEncoding;
}

/** Fractional tile coordinates of a position at a zoom level (Web Mercator). */
export function lngLatToTile(
  lng: number,
  lat: number,
  z: number,
): { x: number; y: number } {
  const n = 2 ** z;
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

/** Geographic bounds `[west, south, east, north]` of a tile. */
export function tileBounds(z: number, x: number, y: number): [number, number, number, number] {
  const n = 2 ** z;
  const lng = (tx: number) => (tx / n) * 360 - 180;
  const lat = (ty: number) =>
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n))) * 180) / Math.PI;
  return [lng(x), lat(y + 1), lng(x + 1), lat(y)];
}

/** A small least-recently-used cache for decoded tiles. */
export class TileValueCache {
  private readonly entries = new Map<string, DataTileValues>();

  constructor(private readonly capacity = 256) {}

  get(key: string): DataTileValues | undefined {
    const value = this.entries.get(key);
    if (value) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: string, value: DataTileValues): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

let scratch: HTMLCanvasElement | null = null;

function pixelsOf(
  source: CanvasImageSource,
  width: number,
  height: number,
): Uint8ClampedArray {
  scratch ??= document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  const context = scratch.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('[gcl] 2D canvas unavailable');
  context.clearRect(0, 0, width, height);
  context.drawImage(source, 0, 0);
  return context.getImageData(0, 0, width, height).data;
}

async function bitmapFrom(blob: Blob): Promise<ImageBitmap> {
  // Without these flags the browser may premultiply or colour-manage the
  // pixels, which silently changes the encoded numbers.
  return createImageBitmap(blob, {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  });
}

/** Normalise any loader result into decoded values. */
export async function toTileValues(
  result: DataTileResult,
  encoding: DataTileEncoding,
): Promise<DataTileValues | null> {
  if (result == null) return null;
  if ('values' in result && result.values instanceof Float32Array) {
    return result;
  }
  if (typeof ImageData !== 'undefined' && result instanceof ImageData) {
    return decodeTilePixels(result.data, result.width, result.height, encoding);
  }
  if (result instanceof ArrayBuffer) {
    return toTileValues(new Blob([result]), encoding);
  }
  if (typeof Blob !== 'undefined' && result instanceof Blob) {
    const bitmap = await bitmapFrom(result);
    try {
      return decodeTilePixels(
        pixelsOf(bitmap, bitmap.width, bitmap.height),
        bitmap.width,
        bitmap.height,
        encoding,
      );
    } finally {
      bitmap.close();
    }
  }
  const image = result as ImageBitmap | HTMLImageElement | HTMLCanvasElement;
  const width = 'naturalWidth' in image ? image.naturalWidth : image.width;
  const height = 'naturalHeight' in image ? image.naturalHeight : image.height;
  return decodeTilePixels(pixelsOf(image, width, height), width, height, encoding);
}

/** Resolve one tile from a source description. */
export async function loadTileValues(
  input: DataTileSourceInput,
  z: number,
  x: number,
  y: number,
  signal: AbortSignal,
  encoding: DataTileEncoding,
): Promise<DataTileValues | null> {
  if (input.loadTile) {
    return toTileValues(await input.loadTile({ z, x, y }, signal), encoding);
  }
  const templates = input.tiles
    ? Array.isArray(input.tiles)
      ? input.tiles
      : [input.tiles]
    : [];
  if (templates.length === 0) return null;
  // Spread requests across hosts the way MapLibre does for `a/b/c` subdomains.
  const template = templates[(x + y) % templates.length]!;
  const url = template
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
  const response = await fetch(url, { signal });
  if (response.status === 404 || response.status === 204) return null;
  if (!response.ok) throw new Error(`[gcl] Data tile ${url} failed: ${response.status}`);
  return toTileValues(await response.blob(), encoding);
}
