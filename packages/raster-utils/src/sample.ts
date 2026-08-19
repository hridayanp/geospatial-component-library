import type { Bounds, LngLat } from '@hridayanp/geo-utils';
import { isValidValue } from './stats';
import type { RasterData, RasterSample } from './types';

/**
 * Convert a geographic position into fractional raster coordinates.
 *
 * Row 0 is the northern edge, matching image space and the row ordering of
 * every GeoTIFF this library decodes.
 */
export function lngLatToRasterXY(
  bounds: Bounds,
  width: number,
  height: number,
  position: LngLat,
): { x: number; y: number } {
  const [west, south, east, north] = bounds;
  const [lng, lat] = position;
  const spanLng = east - west;
  const spanLat = north - south;
  return {
    x: spanLng === 0 ? 0 : ((lng - west) / spanLng) * width,
    y: spanLat === 0 ? 0 : ((north - lat) / spanLat) * height,
  };
}

/** Centre coordinate of a raster cell. */
export function rasterXYToLngLat(
  bounds: Bounds,
  width: number,
  height: number,
  column: number,
  row: number,
): LngLat {
  const [west, south, east, north] = bounds;
  return [
    west + ((column + 0.5) / width) * (east - west),
    north - ((row + 0.5) / height) * (north - south),
  ];
}

/**
 * Read a raster's value at a geographic position.
 *
 * `'nearest'` returns the exact cell value — right for categorical or classed
 * data, and for hover readouts where users expect to see a value that actually
 * exists in the source. `'bilinear'` interpolates the four surrounding cells,
 * which matches what the smoothed rendering actually shows on screen.
 *
 * Positions outside the raster, and cells that hold NoData, return
 * `value: null` rather than throwing, because hovering off the edge of the data
 * is a normal thing for a user to do.
 */
export function sampleRaster(
  raster: RasterData,
  position: LngLat,
  method: 'nearest' | 'bilinear' = 'nearest',
): RasterSample {
  const { data, width, height, bounds, noData } = raster;
  const { x, y } = lngLatToRasterXY(bounds, width, height, position);

  const column = Math.floor(x);
  const row = Math.floor(y);

  if (column < 0 || row < 0 || column >= width || row >= height) {
    return { value: null, column, row };
  }

  if (method === 'nearest') {
    const value = data[row * width + column] as number;
    return {
      value: isValidValue(value, noData) ? value : null,
      column,
      row,
    };
  }

  // Sample around cell centres so interpolation is symmetric about them.
  const fx = Math.min(width - 1, Math.max(0, x - 0.5));
  const fy = Math.min(height - 1, Math.max(0, y - 0.5));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const tx = fx - x0;
  const ty = fy - y0;

  let sum = 0;
  let weightSum = 0;
  const accumulate = (cx: number, cy: number, weight: number) => {
    const value = data[cy * width + cx] as number;
    if (!isValidValue(value, noData) || weight <= 0) return;
    sum += value * weight;
    weightSum += weight;
  };
  accumulate(x0, y0, (1 - tx) * (1 - ty));
  accumulate(x1, y0, tx * (1 - ty));
  accumulate(x0, y1, (1 - tx) * ty);
  accumulate(x1, y1, tx * ty);

  return {
    value: weightSum > 0 ? sum / weightSum : null,
    column,
    row,
  };
}

/**
 * Sample many positions in one pass.
 *
 * Marginally faster than repeated {@link sampleRaster} calls and much easier to
 * read at a call site that is building a profile or a cross-section.
 */
export function sampleRasterAt(
  raster: RasterData,
  positions: Iterable<LngLat>,
  method: 'nearest' | 'bilinear' = 'nearest',
): RasterSample[] {
  const out: RasterSample[] = [];
  for (const position of positions) {
    out.push(sampleRaster(raster, position, method));
  }
  return out;
}
