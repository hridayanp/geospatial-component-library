/**
 * How the bytes of a data tile map back to physical values.
 *
 * - `'uint16'` — the value is packed big-endian into red and green
 *   (`raw = R * 256 + G`), the usual layout for quantised model output. Blue is
 *   ignored; alpha `0` marks NoData.
 * - `'uint8'` — the value is the red channel alone.
 * - `'terrarium'` — Mapzen Terrarium elevation (`R * 256 + G + B / 256 - 32768`).
 * - `'terrain-rgb'` — Mapbox Terrain-RGB (`-10000 + (R * 65536 + G * 256 + B) * 0.1`).
 *
 * For `'uint16'` and `'uint8'` the decoded raw integer is then mapped through
 * `value = raw * scale + offset`.
 */
export interface DataTileEncoding {
  format: 'uint16' | 'uint8' | 'terrarium' | 'terrain-rgb';
  /** Multiplier applied to the raw integer. Default `1`. */
  scale?: number;
  /** Added after scaling. Default `0`. */
  offset?: number;
  /**
   * Raw integer that means "no data", before scaling. Pixels with alpha `0`
   * are always NoData regardless.
   */
  noData?: number | null;
}

/** Decoded values for one tile. `NaN` marks NoData. */
export interface DataTileValues {
  values: Float32Array;
  width: number;
  height: number;
}

/** The default encoding: 16-bit values in red/green, identity scale. */
export const DEFAULT_ENCODING: DataTileEncoding = { format: 'uint16' };

/**
 * Decode RGBA pixels into values.
 *
 * Exported so a host decoding tiles elsewhere — in a worker, on a server —
 * produces exactly the numbers the layer would.
 */
export function decodeTilePixels(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  encoding: DataTileEncoding = DEFAULT_ENCODING,
): DataTileValues {
  const count = width * height;
  const values = new Float32Array(count);
  const scale = encoding.scale ?? 1;
  const offset = encoding.offset ?? 0;
  const noData = encoding.noData ?? null;

  for (let i = 0; i < count; i++) {
    const r = pixels[i * 4]!;
    const g = pixels[i * 4 + 1]!;
    const b = pixels[i * 4 + 2]!;
    const a = pixels[i * 4 + 3]!;
    if (a === 0) {
      values[i] = Number.NaN;
      continue;
    }
    switch (encoding.format) {
      case 'uint8': {
        values[i] = r === noData ? Number.NaN : r * scale + offset;
        break;
      }
      case 'terrarium': {
        values[i] = r * 256 + g + b / 256 - 32768;
        break;
      }
      case 'terrain-rgb': {
        values[i] = -10000 + (r * 65536 + g * 256 + b) * 0.1;
        break;
      }
      default: {
        const raw = r * 256 + g;
        values[i] = raw === noData ? Number.NaN : raw * scale + offset;
      }
    }
  }
  return { values, width, height };
}

/**
 * Inverse of {@link decodeTilePixels} for the integer formats — used to build
 * test tiles and to document the contract precisely.
 */
export function encodeTileValues(
  values: ArrayLike<number>,
  width: number,
  height: number,
  encoding: DataTileEncoding = DEFAULT_ENCODING,
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const scale = encoding.scale ?? 1;
  const offset = encoding.offset ?? 0;
  const max = encoding.format === 'uint8' ? 255 : 65535;
  for (let i = 0; i < width * height; i++) {
    const value = values[i] as number;
    if (!Number.isFinite(value)) continue; // alpha stays 0 → NoData
    const raw = Math.min(max, Math.max(0, Math.round((value - offset) / scale)));
    if (encoding.format === 'uint8') {
      pixels[i * 4] = raw;
    } else {
      pixels[i * 4] = raw >> 8;
      pixels[i * 4 + 1] = raw & 0xff;
    }
    pixels[i * 4 + 3] = 255;
  }
  return pixels;
}
