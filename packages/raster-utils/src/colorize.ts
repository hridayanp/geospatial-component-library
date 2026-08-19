import { buildColorLut, DEFAULT_LUT_SIZE } from './color';
import { isValidValue, normalizeValue, resolveDomain, smoothstep } from './stats';
import type { ColorizeOptions, ColorizedRaster, RasterData } from './types';

const DEFAULT_MAX_DIMENSION = 1024;
const DEFAULT_ALPHA_FADE: [number, number] = [0.03, 0.09];

/**
 * Turn a georeferenced band into RGBA pixels.
 *
 * ## Why the raw values are interpolated rather than the colours
 *
 * Model output grids are coarse. Drawing one output pixel per source cell and
 * then blurring the *coloured* result still reads as hard patchy blocks,
 * because the colour was locked in before any blur ran. Here every output pixel
 * bilinearly interpolates the **raw numeric values** of its neighbouring source
 * cells first, and only then maps the smoothly varying result through the
 * colour ramp (via a precomputed LUT, so this stays fast). That produces a
 * genuinely continuous colour field.
 *
 * Alpha is likewise a smooth ramp rather than a hard cutoff near the bottom of
 * the range, and cells on the ragged edge of the valid-data region get a
 * partial-coverage fade, so the raster dissolves into transparency at its edges
 * instead of showing a rectangular outline.
 *
 * The whole function is synchronous and allocation-light; it is safe to call
 * inside a web worker, and `pixels` can be transferred back with zero copies.
 */
export function rasterToImageData(
  raster: RasterData,
  options: ColorizeOptions,
): ColorizedRaster {
  const {
    colorScale,
    min,
    max,
    opacity = 1,
    smoothFactor = 1,
    smoothEdges = false,
    alphaFade = DEFAULT_ALPHA_FADE,
    maxDimension = DEFAULT_MAX_DIMENSION,
    clipBelow,
    clipAbove,
  } = options;

  const { data, width, height, noData } = raster;
  const domain = resolveDomain(raster, min, max);
  const lut = buildColorLut(colorScale, DEFAULT_LUT_SIZE);
  const lutMax = DEFAULT_LUT_SIZE - 1;
  const globalAlpha = Math.min(1, Math.max(0, opacity));

  // Cap the synthesised resolution: every output pixel costs a manual bilinear
  // sample in JS, and the texture has to be uploaded to the GPU afterwards.
  const factor = Math.max(1, smoothFactor);
  const targetScale = Math.min(
    factor,
    maxDimension / Math.max(width, height, 1),
  );
  const outWidth = Math.max(1, Math.round(width * targetScale));
  const outHeight = Math.max(1, Math.round(height * targetScale));

  const pixels = new Uint8ClampedArray(outWidth * outHeight * 4);

  const valid = (v: number) => isValidValue(v, noData);

  /**
   * Bilinearly sample the raw value grid at fractional source coordinates.
   * Returns `null` when every neighbour is NoData; otherwise the interpolated
   * value plus a `0..1` coverage (how much of the 2×2 neighbourhood held real
   * data), which feathers alpha at the edge of the valid region.
   */
  const sample = (fx: number, fy: number): { value: number; coverage: number } | null => {
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, width - 1);
    const y1 = Math.min(y0 + 1, height - 1);
    const tx = fx - x0;
    const ty = fy - y0;

    const v00 = data[y0 * width + x0] as number;
    const v10 = data[y0 * width + x1] as number;
    const v01 = data[y1 * width + x0] as number;
    const v11 = data[y1 * width + x1] as number;

    const w00 = (1 - tx) * (1 - ty) * (valid(v00) ? 1 : 0);
    const w10 = tx * (1 - ty) * (valid(v10) ? 1 : 0);
    const w01 = (1 - tx) * ty * (valid(v01) ? 1 : 0);
    const w11 = tx * ty * (valid(v11) ? 1 : 0);

    const total = w00 + w10 + w01 + w11;
    if (total <= 0) return null;

    const value =
      ((valid(v00) ? v00 : 0) * w00 +
        (valid(v10) ? v10 : 0) * w10 +
        (valid(v01) ? v01 : 0) * w01 +
        (valid(v11) ? v11 : 0) * w11) /
      total;

    return { value, coverage: total };
  };

  for (let oy = 0; oy < outHeight; oy++) {
    const fy = outHeight > 1 ? (oy / (outHeight - 1)) * (height - 1) : 0;
    const rowOffset = oy * outWidth;
    for (let ox = 0; ox < outWidth; ox++) {
      const fx = outWidth > 1 ? (ox / (outWidth - 1)) * (width - 1) : 0;
      const px = (rowOffset + ox) * 4;

      const sampled = sample(fx, fy);
      if (!sampled) continue; // leaves RGBA at 0 — fully transparent

      if (clipBelow != null && sampled.value < clipBelow) continue;
      if (clipAbove != null && sampled.value > clipAbove) continue;

      const norm = normalizeValue(sampled.value, domain);
      const ramp = alphaFade
        ? smoothstep(alphaFade[0], alphaFade[1], norm)
        : 1;
      const alpha = Math.round(ramp * sampled.coverage * globalAlpha * 255);
      if (alpha <= 0) continue;

      const lutIndex = Math.round(norm * lutMax) * 3;
      pixels[px] = lut[lutIndex] as number;
      pixels[px + 1] = lut[lutIndex + 1] as number;
      pixels[px + 2] = lut[lutIndex + 2] as number;
      pixels[px + 3] = alpha;
    }
  }

  if (smoothEdges) {
    featherEdges(pixels, outWidth, outHeight, Math.max(1, Math.round(targetScale * 0.75)));
  }

  return {
    pixels,
    width: outWidth,
    height: outHeight,
    bounds: raster.bounds,
    domain,
  };
}

/**
 * Gaussian-weighted blur that only ever *reduces* alpha, so the interior stays
 * crisp while the outline softens. Colour is averaged across covered
 * neighbours too, which stops the feathered rim from picking up black fringing
 * from the transparent pixels around it.
 */
function featherEdges(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): void {
  const originalAlpha = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    originalAlpha[i] = pixels[i * 4 + 3] as number;
  }

  const radiusSq = radius * radius;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const px = index * 4;
      const centerAlpha = originalAlpha[index] as number;

      let alphaSum = 0;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let weightSum = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;

          const nIndex = ny * width + nx;
          const alpha = originalAlpha[nIndex] as number;
          if (alpha <= 0) continue;

          const weight = Math.exp(-(dx * dx + dy * dy) / radiusSq);
          const nPx = nIndex * 4;
          alphaSum += alpha * weight;
          rSum += (pixels[nPx] as number) * weight;
          gSum += (pixels[nPx + 1] as number) * weight;
          bSum += (pixels[nPx + 2] as number) * weight;
          weightSum += weight;
        }
      }

      if (weightSum <= 0) continue;
      const feathered = Math.round(alphaSum / (weightSum * 1.2));
      const finalAlpha = Math.min(centerAlpha, feathered);
      if (centerAlpha <= 0 && finalAlpha <= 0) continue;

      pixels[px] = Math.round(rSum / weightSum);
      pixels[px + 1] = Math.round(gSum / weightSum);
      pixels[px + 2] = Math.round(bSum / weightSum);
      pixels[px + 3] = Math.max(0, Math.min(255, finalAlpha));
    }
  }
}

/**
 * Draw a colourised raster onto a canvas.
 *
 * Works with both `HTMLCanvasElement` and `OffscreenCanvas`, so the same code
 * path serves the main thread and a worker.
 */
export function drawColorizedRaster(
  colorized: ColorizedRaster,
  canvas: HTMLCanvasElement | OffscreenCanvas,
): void {
  canvas.width = colorized.width;
  canvas.height = colorized.height;
  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error('[gcl] 2D canvas context unavailable');
  const imageData = new ImageData(
    colorized.pixels,
    colorized.width,
    colorized.height,
  );
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Colourise a raster straight to a PNG data URL, ready for a MapLibre `image`
 * source or a deck.gl `BitmapLayer`.
 *
 * Requires a DOM; in a worker use {@link rasterToImageData} plus
 * {@link rasterToBitmap} instead.
 */
export function rasterToDataUrl(
  raster: RasterData,
  options: ColorizeOptions,
): { url: string; bounds: ColorizedRaster['bounds']; domain: [number, number] } {
  if (typeof document === 'undefined') {
    throw new Error(
      '[gcl] rasterToDataUrl requires a DOM. Use rasterToImageData in a worker.',
    );
  }
  const colorized = rasterToImageData(raster, options);
  const canvas = document.createElement('canvas');
  drawColorizedRaster(colorized, canvas);
  return {
    url: canvas.toDataURL('image/png'),
    bounds: colorized.bounds,
    domain: colorized.domain,
  };
}

/**
 * Colourise a raster into an `ImageBitmap`.
 *
 * Cheaper than a data URL for repeated updates: there is no base64 encode, no
 * decode, and the result can be transferred out of a worker.
 */
export async function rasterToBitmap(
  raster: RasterData,
  options: ColorizeOptions,
): Promise<ImageBitmap> {
  const colorized = rasterToImageData(raster, options);
  const imageData = new ImageData(
    colorized.pixels,
    colorized.width,
    colorized.height,
  );
  return createImageBitmap(imageData);
}
