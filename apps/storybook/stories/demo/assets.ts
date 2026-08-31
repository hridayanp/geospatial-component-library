/**
 * Sample geospatial datasets used by the stories.
 *
 * The four files in `assets/` at the repository root are served by Storybook as
 * static content (see `.storybook/main.ts`) and fetched at runtime, so the
 * stories exercise the same code path a consuming application does: decode a
 * Cloud-Optimised GeoTIFF, normalise a GeoJSON FeatureCollection, and hand the
 * result to a layer through props.
 *
 * | File | Structure | CRS | Extent |
 * | --- | --- | --- | --- |
 * | `raster.tif` | 58 × 55 single-band float32 grid, 0.1° resolution | EPSG:4326 | 84.339, 19.590, 90.139, 25.090 |
 * | `vector.geojson` | 3,190 Point features with convective and gust attributes | EPSG:4326 | coincident with `raster.tif` |
 * | `wind_particle_raster.tif` | 120 × 128 single-band float32 wind-speed grid, 0.25° resolution | EPSG:4326 | 67.875, 5.875, 97.875, 37.875 |
 * | `wind_particle_vector.geojson` | 15,107 Point observations with speed and bearing | EPSG:4326 | coincident with `wind_particle_raster.tif` |
 *
 * Each dataset is fetched and decoded **once** per session. Memoising at module
 * scope matters for more than start-up cost: a `RasterData` object identity is
 * part of the layer's render dependency, so a loader that returned a fresh
 * object per story would re-colourise on every render.
 */

import {
  boundsFromPoints,
  speedDirectionToUV,
  toFeatureCollection,
  toFiniteNumber,
  type Bounds,
  type GeoJsonFeatureCollection,
  type LngLat,
} from '@hridayanp/geo-utils';
import { decodeGeoTIFF, type RasterData } from '@hridayanp/raster-utils';
import type { WindField } from '@hridayanp/wind-particle-layer';

/** Paths are relative to the Storybook origin, so a base path is honoured. */
const ASSET_BASE = 'assets';

const assetUrl = (name: string) =>
  new URL(`${ASSET_BASE}/${name}`, document.baseURI).toString();

/** Stable cache identities for the decoded frames. */
export const ASSET_FRAME_KEYS = {
  convective: 'asset:raster.tif',
  windSpeed: 'asset:wind_particle_raster.tif',
} as const;

/* ------------------------------------------------------------------ */
/* Raster bands                                                        */
/* ------------------------------------------------------------------ */

let convectiveRasterPromise: Promise<RasterData> | null = null;

/**
 * Convective probability band, decoded from `assets/raster.tif`.
 *
 * Values are a percentage in roughly 0–50. The file declares its NoData
 * sentinel as `nan` in the `GDAL_NODATA` tag; `decodeGeoTIFF` reads the tag, and
 * non-finite cells are excluded from statistics and rendered transparent.
 */
export function loadConvectiveRaster(): Promise<RasterData> {
  convectiveRasterPromise ??= decodeGeoTIFF(assetUrl('raster.tif'), {
    resolution: 'overview',
    unit: '%',
  });
  return convectiveRasterPromise;
}

let windSpeedRasterPromise: Promise<RasterData> | null = null;

/**
 * Wind-speed band, decoded from `assets/wind_particle_raster.tif`.
 *
 * Values are knots in roughly 2–29, over a 0.25° grid. The file declares
 * `-9999` as its NoData sentinel.
 */
export function loadWindSpeedRaster(): Promise<RasterData> {
  windSpeedRasterPromise ??= decodeGeoTIFF(
    assetUrl('wind_particle_raster.tif'),
    { resolution: 'overview', unit: 'kt' },
  );
  return windSpeedRasterPromise;
}

/* ------------------------------------------------------------------ */
/* Vector features                                                     */
/* ------------------------------------------------------------------ */

async function fetchCollection(name: string): Promise<GeoJsonFeatureCollection> {
  const response = await fetch(assetUrl(name));
  if (!response.ok) {
    throw new Error(
      `[stories] ${name} responded ${response.status}. The repository's assets/ directory is served through staticDirs in .storybook/main.ts.`,
    );
  }
  return toFeatureCollection(await response.json());
}

let observationsPromise: Promise<GeoJsonFeatureCollection> | null = null;

/**
 * Convective observation points, from `assets/vector.geojson`.
 *
 * 3,190 Point features. Numeric attributes include `thunderstorm_prob_pct`
 * (0–50), `wind_gust_kt` (5–22) and `thunderstorm_distance_km`; categorical
 * attributes include `thunderstorm_occurrence` and `gust_intensity`. Both kinds
 * are addressable from MapLibre expressions through `['get', …]`.
 */
export function loadObservations(): Promise<GeoJsonFeatureCollection> {
  observationsPromise ??= fetchCollection('vector.geojson');
  return observationsPromise;
}

let windObservationsPromise: Promise<GeoJsonFeatureCollection> | null = null;

/**
 * Wind observations, from `assets/wind_particle_vector.geojson`.
 *
 * 15,107 Point features carrying `wind_speed_kt` (0.1–35.4), `wind_dir_deg`,
 * `wind_dir_deg_compass` and `timestamp`. Bearings follow the meteorological
 * convention — the direction the flow originates from — which is
 * `WindPoints.directionConvention`'s default.
 */
export function loadWindObservations(): Promise<GeoJsonFeatureCollection> {
  windObservationsPromise ??= fetchCollection('wind_particle_vector.geojson');
  return windObservationsPromise;
}

/* ------------------------------------------------------------------ */
/* Derived products                                                    */
/* ------------------------------------------------------------------ */

let windFieldPromise: Promise<WindField> | null = null;

/**
 * A regular u/v velocity grid derived from the wind observations.
 *
 * The observations are already distributed on a 0.25° lattice, so binning them
 * back onto that lattice reconstructs the source grid rather than
 * interpolating. Speed and bearing are resolved into eastward and northward
 * components with `speedDirectionToUV`, using the meteorological `'from'`
 * convention the file records.
 *
 * This is the canonical `kind: 'field'` input. Supplying the observations
 * directly as `kind: 'points'` produces an equivalent field — the layer runs
 * the same rasterisation internally — and the two are compared in the
 * Wind Particle Layer stories.
 */
export function loadWindField(): Promise<WindField> {
  windFieldPromise ??= loadWindObservations().then(toWindField);
  return windFieldPromise;
}

const STEP = 0.25;

function toWindField(collection: GeoJsonFeatureCollection): WindField {
  const positions: LngLat[] = [];
  for (const feature of collection.features) {
    const geometry = feature.geometry;
    if (geometry?.type !== 'Point') continue;
    const [lng, lat] = geometry.coordinates as [number, number];
    positions.push([lng, lat]);
  }

  const extent = boundsFromPoints(positions);
  if (!extent) throw new Error('[stories] wind observations carry no geometry.');

  // Cell centres sit half a step inside the extent, so the grid's outer edges
  // are half a step beyond the outermost observation.
  const half = STEP / 2;
  const bounds: Bounds = [
    extent[0] - half,
    extent[1] - half,
    extent[2] + half,
    extent[3] + half,
  ];

  const width = Math.round((bounds[2] - bounds[0]) / STEP);
  const height = Math.round((bounds[3] - bounds[1]) / STEP);

  const noData = -9999;
  const u = new Float32Array(width * height).fill(noData);
  const v = new Float32Array(width * height).fill(noData);

  for (const feature of collection.features) {
    const geometry = feature.geometry;
    if (geometry?.type !== 'Point') continue;
    const [lng, lat] = geometry.coordinates as [number, number];

    const speed = toFiniteNumber(feature.properties?.['wind_speed_kt']);
    const direction = toFiniteNumber(feature.properties?.['wind_dir_deg']);
    if (speed === null || direction === null) continue;

    const column = Math.floor((lng - bounds[0]) / STEP);
    // Row 0 is the northern edge, matching image space and GeoTIFF row order.
    const row = Math.floor((bounds[3] - lat) / STEP);
    if (column < 0 || column >= width || row < 0 || row >= height) continue;

    const vector = speedDirectionToUV(speed, direction, 'from');
    const index = row * width + column;
    u[index] = vector.u;
    v[index] = vector.v;
  }

  return { kind: 'field', u, v, width, height, bounds, noData };
}

/* ------------------------------------------------------------------ */
/* Extents                                                             */
/* ------------------------------------------------------------------ */

/** Extent of `raster.tif` and `vector.geojson`, `[west, south, east, north]`. */
export const CONVECTIVE_BOUNDS: Bounds = [
  84.338977, 19.590203, 90.138977, 25.090203,
];

/** Extent of the wind datasets, `[west, south, east, north]`. */
export const WIND_BOUNDS: Bounds = [67.875, 5.875, 97.875, 37.875];

/** Camera that frames the convective datasets. */
export const CONVECTIVE_VIEW = {
  center: [87.24, 22.34] as LngLat,
  zoom: 5.4,
};

/** Camera that frames the wind datasets. */
export const WIND_VIEW = {
  center: [82.88, 21.88] as LngLat,
  zoom: 3.4,
};
