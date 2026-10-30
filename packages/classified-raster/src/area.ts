import { EARTH_RADIUS_KM, type Bounds } from '@hridayanp/geo-utils';

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Area in square kilometres of each row of a geographic raster grid.
 *
 * Cells of a raster in geographic coordinates (EPSG:4326) are graticule
 * quadrangles, not squares: one degree of longitude spans about 111 km at the
 * equator and nothing at all at the pole. Treating every cell as equal-area —
 * counting cells and multiplying by a single constant — overstates high-latitude
 * classes and understates low-latitude ones, and the error is large enough to
 * invert a ranking over a continental extent.
 *
 * The exact area of a quadrangle on a sphere is
 *
 * ```text
 * A = R² · Δλ · (sin φ₂ − sin φ₁)
 * ```
 *
 * which depends only on the row's latitude bounds. One value per row is
 * therefore sufficient, and computing it once per row rather than once per cell
 * is what keeps a full-grid statistic linear and cheap.
 *
 * Values are computed on a sphere of radius `EARTH_RADIUS_KM` (the IUGG mean
 * radius). Against an ellipsoidal computation the error is well under one
 * percent — appropriate for class composition and change accounting, and not
 * appropriate for cadastral or statutory area reporting.
 *
 * @param bounds Grid extent, `[west, south, east, north]`, describing the outer
 * edges of the grid rather than the centres of the outer cells.
 * @param width Number of columns.
 * @param height Number of rows, ordered north first.
 */
export function rowAreasKm2(
  bounds: Bounds,
  width: number,
  height: number,
): Float64Array {
  const [west, south, east, north] = bounds;
  const areas = new Float64Array(height);
  if (width <= 0 || height <= 0) return areas;

  // Longitude span of a single cell, in radians. Constant across the grid.
  const deltaLambda = toRadians((east - west) / width);
  const radiusSquared = EARTH_RADIUS_KM * EARTH_RADIUS_KM;
  const latitudeStep = (north - south) / height;

  for (let row = 0; row < height; row++) {
    // Row 0 is the northern edge, matching image space and GeoTIFF row order.
    const upper = north - row * latitudeStep;
    const lower = upper - latitudeStep;
    const band = Math.sin(toRadians(upper)) - Math.sin(toRadians(lower));
    areas[row] = Math.abs(radiusSquared * deltaLambda * band);
  }

  return areas;
}

/**
 * Total area of a grid extent in square kilometres.
 *
 * Equivalent to summing {@link rowAreasKm2} across every cell, computed in
 * closed form.
 */
export function boundsAreaKm2(bounds: Bounds): number {
  const [west, south, east, north] = bounds;
  const deltaLambda = toRadians(east - west);
  const band = Math.sin(toRadians(north)) - Math.sin(toRadians(south));
  return Math.abs(EARTH_RADIUS_KM * EARTH_RADIUS_KM * deltaLambda * band);
}
