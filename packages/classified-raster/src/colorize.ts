import type { Bounds } from '@hridayanp/geo-utils';
import { toRgba, type RasterData } from '@hridayanp/raster-utils';
import { buildClassIndex, type ClassTable } from './classes';

export interface ColorizeClassifiedOptions {
  /**
   * Global alpha multiplier applied to every classified cell, `0..1`.
   * Default `1`. Prefer the layer's own `opacity` where one is available.
   */
  opacity?: number;
  /**
   * Hard cap on the longest edge of the produced image. Default `2048`.
   *
   * Classified rasters are upsampled by whole-cell replication, so the output
   * is bounded by this rather than by a smoothing factor.
   */
  maxDimension?: number;
  /**
   * Classes to render. Codes outside the set render transparent, leaving the
   * remaining classes in place over the basemap. Omit to render every class.
   */
  visibleClasses?: readonly number[];
}

/** RGBA pixels produced from a classified band. */
export interface ColorizedClassified {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  /** Extent of the produced image — always the source raster's extent. */
  bounds: Bounds;
  /** Cells whose code was absent from the table, NoData, or non-finite. */
  unclassifiedCells: number;
}

/**
 * Colourise a classified band through an exact code lookup.
 *
 * Unlike a continuous ramp, a categorical code must never be interpolated: a
 * value halfway between "water" and "trees" is not half of either, and blending
 * their colours invents a class that does not exist. Every cell is therefore
 * resolved by exact lookup, and cells whose code is absent from the table are
 * left fully transparent rather than being snapped to a neighbouring class.
 *
 * Upsampling replicates whole cells, preserving the hard class boundaries that
 * carry the classification's meaning.
 *
 * Pair the result with `resampling="nearest"` on the layer, so the GPU does not
 * reintroduce interpolation at draw time.
 */
export function colorizeClassified(
  raster: RasterData,
  table: ClassTable,
  options: ColorizeClassifiedOptions = {},
): ColorizedClassified {
  const { opacity = 1, maxDimension = 2048, visibleClasses } = options;
  const { data, width, height, bounds, noData } = raster;

  if (width <= 0 || height <= 0) {
    throw new Error('[gcl] colorizeClassified requires a non-empty grid.');
  }

  const index = buildClassIndex(table);
  const visible = visibleClasses ? new Set(visibleClasses) : null;
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255);

  // Resolve every class colour once. Per-cell colour parsing is the dominant
  // cost otherwise, exactly as it is for a continuous ramp's lookup table.
  const rgbaByCode = new Map<number, [number, number, number, number]>();
  for (const definition of table) {
    if (visible && !visible.has(definition.value)) continue;
    const [r, g, b] = toRgba(definition.color, 1);
    rgbaByCode.set(definition.value, [r, g, b, alpha]);
  }

  // Whole-cell replication, so class boundaries stay on cell edges.
  const scale = Math.max(
    1,
    Math.floor(maxDimension / Math.max(width, height)) || 1,
  );
  const outWidth = width * scale;
  const outHeight = height * scale;

  const pixels = new Uint8ClampedArray(outWidth * outHeight * 4);
  let unclassifiedCells = 0;

  for (let row = 0; row < height; row++) {
    const sourceOffset = row * width;
    for (let column = 0; column < width; column++) {
      const raw = Number(data[sourceOffset + column]);

      let rgba: [number, number, number, number] | undefined;
      if (!Number.isFinite(raw) || (noData != null && raw === noData)) {
        unclassifiedCells += 1;
      } else {
        const code = Math.round(raw);
        rgba = rgbaByCode.get(code);
        if (!rgba && !index.has(code)) unclassifiedCells += 1;
      }
      if (!rgba) continue;

      const [r, g, b, a] = rgba;
      for (let dy = 0; dy < scale; dy++) {
        let target = ((row * scale + dy) * outWidth + column * scale) * 4;
        for (let dx = 0; dx < scale; dx++) {
          pixels[target] = r;
          pixels[target + 1] = g;
          pixels[target + 2] = b;
          pixels[target + 3] = a;
          target += 4;
        }
      }
    }
  }

  return { pixels, width: outWidth, height: outHeight, bounds, unclassifiedCells };
}

/**
 * Colourise a classified band to a PNG data URL.
 *
 * The result is the exact shape `RasterLayer` accepts as `{ kind: 'image' }`
 * input, so a classified raster composes with the existing layer rather than
 * requiring one of its own:
 *
 * ```tsx
 * const image = classifiedToDataUrl(landCover, LAND_COVER);
 * <RasterLayer data={{ kind: 'image', ...image }} resampling="nearest" />
 * ```
 *
 * Requires a DOM. In a worker, use {@link colorizeClassified} and transfer the
 * pixel buffer.
 */
export function classifiedToDataUrl(
  raster: RasterData,
  table: ClassTable,
  options: ColorizeClassifiedOptions = {},
): { url: string; bounds: Bounds; unclassifiedCells: number } {
  if (typeof document === 'undefined') {
    throw new Error(
      '[gcl] classifiedToDataUrl requires a DOM. Use colorizeClassified in a worker.',
    );
  }

  const colorized = colorizeClassified(raster, table, options);
  const canvas = document.createElement('canvas');
  canvas.width = colorized.width;
  canvas.height = colorized.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('[gcl] Could not acquire a 2D canvas context.');
  }
  context.putImageData(
    new ImageData(colorized.pixels, colorized.width, colorized.height),
    0,
    0,
  );

  return {
    url: canvas.toDataURL('image/png'),
    bounds: colorized.bounds,
    unclassifiedCells: colorized.unclassifiedCells,
  };
}

/**
 * A binary change mask: cells whose class differs between two epochs.
 *
 * Produces a `RasterData` of `1` where the class changed, `0` where it
 * persisted, and NoData where either epoch was unclassified — the input a change
 * layer or a hotspot analysis of change intensity expects.
 *
 * @throws when the grids differ in dimensions.
 */
export function changeMask(
  from: RasterData,
  to: RasterData,
  table: ClassTable,
): RasterData {
  if (from.width !== to.width || from.height !== to.height) {
    throw new Error(
      `[gcl] changeMask requires matching grid dimensions (${from.width}×${from.height} vs ${to.width}×${to.height}).`,
    );
  }

  const index = buildClassIndex(table);
  const noData = -1;
  const values = new Float32Array(from.width * from.height).fill(noData);

  const resolve = (raster: RasterData, i: number): number | undefined => {
    const raw = Number(raster.data[i]);
    if (!Number.isFinite(raw)) return undefined;
    if (raster.noData != null && raw === raster.noData) return undefined;
    const code = Math.round(raw);
    return index.has(code) ? code : undefined;
  };

  for (let i = 0; i < values.length; i++) {
    const a = resolve(from, i);
    const b = resolve(to, i);
    if (a === undefined || b === undefined) continue;
    values[i] = a === b ? 0 : 1;
  }

  return {
    data: values,
    width: from.width,
    height: from.height,
    bounds: from.bounds,
    noData,
  };
}
