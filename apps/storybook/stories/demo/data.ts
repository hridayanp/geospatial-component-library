import type {
  Bounds,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
} from '@hridayanp/geo-utils';
import type { RasterData } from '@hridayanp/raster-utils';
import type { WindField } from '@hridayanp/wind-particle-layer';

/**
 * Synthetic data for the docs site.
 *
 * Every value here is generated, deterministic and meaningless — the point is
 * to exercise the components, not to depict anything real. That is also the
 * point of the library: none of these components know or care where the
 * numbers came from.
 */

/** The demo extent, `[west, south, east, north]`. */
export const DEMO_BOUNDS: Bounds = [88, 22, 96, 29];
export const DEMO_CENTER: [number, number] = [92, 25.5];

/** A tiny deterministic PRNG, so every reload shows the same field. */
export function makeRandom(seed = 42): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export interface MakeRasterOptions {
  width?: number;
  height?: number;
  bounds?: Bounds;
  /** Number of Gaussian blobs summed into the field. Default `4`. */
  blobs?: number;
  seed?: number;
  /** Value at the field's peak. Default `100`. */
  peak?: number;
  /** Fraction of cells forced to NoData. Default `0`. */
  noDataFraction?: number;
  /** NoData sentinel. Default `-9999`. */
  noData?: number;
  /** Shift the blobs, to fake a sequence of frames. Default `0`. */
  phase?: number;
}

/**
 * A smooth, blobby scalar field — the shape most model output takes, and the
 * shape that shows off interpolation, colour ramps and alpha fading.
 */
export function makeRaster({
  width = 96,
  height = 84,
  bounds = DEMO_BOUNDS,
  blobs = 4,
  seed = 7,
  peak = 100,
  noDataFraction = 0,
  noData = -9999,
  phase = 0,
}: MakeRasterOptions = {}): RasterData {
  const random = makeRandom(seed);
  const centres = Array.from({ length: blobs }, () => ({
    x: random(),
    y: random(),
    radius: 0.12 + random() * 0.22,
    weight: 0.4 + random() * 0.6,
    driftX: (random() - 0.5) * 0.5,
    driftY: (random() - 0.5) * 0.5,
  }));

  const data = new Float32Array(width * height);

  for (let row = 0; row < height; row++) {
    const ny = row / (height - 1);
    for (let column = 0; column < width; column++) {
      const nx = column / (width - 1);
      let value = 0;
      for (const blob of centres) {
        const cx = blob.x + blob.driftX * phase;
        const cy = blob.y + blob.driftY * phase;
        const distanceSq = (nx - cx) ** 2 + (ny - cy) ** 2;
        value += blob.weight * Math.exp(-distanceSq / (2 * blob.radius ** 2));
      }
      data[row * width + column] = Math.min(peak, value * peak * 0.85);
    }
  }

  if (noDataFraction > 0) {
    // Punch out a contiguous region rather than scattered pixels — that is
    // what a real coverage gap looks like, and it exercises the edge feather.
    const holeRandom = makeRandom(seed + 1);
    const holes = Math.max(1, Math.round(noDataFraction * 8));
    for (let i = 0; i < holes; i++) {
      const hx = holeRandom() * width;
      const hy = holeRandom() * height;
      const radius = (0.06 + holeRandom() * 0.12) * Math.min(width, height);
      for (let row = 0; row < height; row++) {
        for (let column = 0; column < width; column++) {
          if ((column - hx) ** 2 + (row - hy) ** 2 < radius ** 2) {
            data[row * width + column] = noData;
          }
        }
      }
    }
  }

  return { data, width, height, bounds, noData };
}

/** A sequence of frames, as an animated timeline would supply them. */
export function makeRasterSequence(
  count = 12,
  options: MakeRasterOptions = {},
): Array<{ id: string; label: string; timestamp: string; raster: RasterData }> {
  const start = Date.UTC(2026, 0, 1, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const timestamp = new Date(start + index * 30 * 60 * 1000).toISOString();
    return {
      id: timestamp,
      label: timestamp.slice(11, 16),
      timestamp,
      raster: makeRaster({ ...options, phase: index / Math.max(1, count - 1) }),
    };
  });
}

/** Scattered point features carrying a few numeric properties. */
export function makePoints(
  count = 40,
  seed = 11,
): GeoJsonFeatureCollection {
  const random = makeRandom(seed);
  const [west, south, east, north] = DEMO_BOUNDS;
  const features: GeoJsonFeature[] = Array.from({ length: count }, (_, index) => {
    const speed = Math.round(random() * 45);
    return {
      type: 'Feature',
      id: index,
      geometry: {
        type: 'Point',
        coordinates: [
          west + random() * (east - west),
          south + random() * (north - south),
        ],
      },
      properties: {
        name: `Site ${String(index + 1).padStart(2, '0')}`,
        value: Math.round(random() * 100),
        speed,
        direction: Math.round(random() * 360),
      },
    };
  });
  return { type: 'FeatureCollection', features };
}

/** A handful of polygons, including one MultiPolygon. */
export function makePolygons(seed = 5): GeoJsonFeatureCollection {
  const random = makeRandom(seed);
  const [west, south, east, north] = DEMO_BOUNDS;

  const ring = (cx: number, cy: number, radius: number, vertices = 9) =>
    Array.from({ length: vertices + 1 }, (_, index) => {
      const angle = ((index % vertices) / vertices) * Math.PI * 2;
      const wobble = 0.7 + random() * 0.6;
      return [
        cx + Math.cos(angle) * radius * wobble,
        cy + Math.sin(angle) * radius * wobble * 0.8,
      ];
    });

  const features: GeoJsonFeature[] = [
    {
      type: 'Feature',
      id: 'a',
      geometry: { type: 'Polygon', coordinates: [ring(90.4, 25.6, 0.9)] },
      properties: { name: 'Zone A', intensity: 0.8, color: '#ef4444' },
    },
    {
      type: 'Feature',
      id: 'b',
      geometry: { type: 'Polygon', coordinates: [ring(93.6, 26.6, 0.7)] },
      properties: { name: 'Zone B', intensity: 0.45, color: '#f59e0b' },
    },
    {
      type: 'Feature',
      id: 'c',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[ring(94.6, 23.6, 0.5)], [ring(89.4, 23.2, 0.45)]],
      },
      properties: { name: 'Zone C', intensity: 0.2, color: '#22d3ee' },
    },
    {
      type: 'Feature',
      id: 'frame',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [west + 0.3, south + 0.3],
            [east - 0.3, south + 0.3],
            [east - 0.3, north - 0.3],
            [west + 0.3, north - 0.3],
            [west + 0.3, south + 0.3],
          ],
        ],
      },
      properties: { name: 'Domain', intensity: 0, color: '#94a3b8' },
    },
  ];

  return { type: 'FeatureCollection', features };
}

/** Line and MultiLineString features. */
export function makeLines(seed = 3): GeoJsonFeatureCollection {
  const random = makeRandom(seed);
  const [west, , east] = DEMO_BOUNDS;

  const track = (startY: number, steps = 24) =>
    Array.from({ length: steps }, (_, index) => {
      const t = index / (steps - 1);
      return [
        west + t * (east - west),
        startY + Math.sin(t * Math.PI * 2 + random() * 0.05) * 0.9,
      ];
    });

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'track-1',
        geometry: { type: 'LineString', coordinates: track(24.5) },
        properties: { name: 'Track 1', color: '#38bdf8' },
      },
      {
        type: 'Feature',
        id: 'track-2',
        geometry: {
          type: 'MultiLineString',
          coordinates: [track(26.5), track(27.6)],
        },
        properties: { name: 'Track 2', color: '#a78bfa' },
      },
    ],
  };
}

/** Everything at once — the case a generic vector layer has to handle. */
export function makeMixedGeometry(): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      ...makePolygons().features,
      ...makeLines().features,
      ...makePoints(18).features,
    ],
  };
}

/**
 * A smooth rotational velocity field — a vortex plus a background flow.
 *
 * Rotation is the most informative test case for particle rendering: it shows
 * whether interpolation, direction convention and clamping are all correct at
 * a glance.
 */
export function makeWindField({
  width = 64,
  height = 56,
  bounds = DEMO_BOUNDS,
  maxSpeed = 40,
  phase = 0,
}: {
  width?: number;
  height?: number;
  bounds?: Bounds;
  maxSpeed?: number;
  phase?: number;
} = {}): WindField {
  const u = new Float32Array(width * height);
  const v = new Float32Array(width * height);
  const cx = 0.5 + Math.cos(phase * Math.PI * 2) * 0.12;
  const cy = 0.5 + Math.sin(phase * Math.PI * 2) * 0.1;

  for (let row = 0; row < height; row++) {
    const ny = row / (height - 1);
    for (let column = 0; column < width; column++) {
      const nx = column / (width - 1);
      const dx = nx - cx;
      const dy = ny - cy;
      const distance = Math.hypot(dx, dy) + 1e-6;
      const swirl = Math.exp(-distance * 3.2) * maxSpeed;
      const index = row * width + column;
      // Tangential component gives the rotation; a constant easterly is added
      // so the whole field also translates.
      u[index] = (-dy / distance) * swirl + maxSpeed * 0.18;
      v[index] = (dx / distance) * swirl;
    }
  }

  return { kind: 'field', u, v, width, height, bounds };
}

/** Scattered observations carrying speed and direction rather than u/v. */
export function makeWindPoints(
  count = 90,
  seed = 21,
): GeoJsonFeatureCollection {
  const random = makeRandom(seed);
  const [west, south, east, north] = DEMO_BOUNDS;
  const features: GeoJsonFeature[] = Array.from({ length: count }, (_, index) => {
    const lon = west + random() * (east - west);
    const lat = south + random() * (north - south);
    // A broad rotation so the rasterised field reads as a coherent flow.
    const angle = Math.atan2(lat - 25.5, lon - 92);
    return {
      type: 'Feature',
      id: index,
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        station: `S${index}`,
        wind_speed_kt: Math.round(8 + random() * 28),
        wind_dir_deg: Math.round(((angle * 180) / Math.PI + 450) % 360),
      },
    };
  });
  return { type: 'FeatureCollection', features };
}

/** Colour ramps used across the stories. */
export const PALETTES = {
  ocean: ['#03045e', '#0077b6', '#00b4d8', '#90e0ef', '#caf0f8'],
  heat: ['#0b2545', '#134074', '#8da9c4', '#eef4ed', '#f4d35e', '#ee964b', '#c1121f'],
  viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
  magma: ['#000004', '#3b0f70', '#8c2981', '#de4968', '#fe9f6d', '#fcfdbf'],
  diverging: ['#2166ac', '#92c5de', '#f7f7f7', '#f4a582', '#b2182b'],
  mono: ['#0f172a', '#e2e8f0'],
} as const;

/**
 * A basemap style for the demos.
 *
 * The library's own default renders a blank background and makes no network
 * request; the docs site opts in to OpenStreetMap tiles explicitly, with the
 * attribution their terms require.
 */
export const DEMO_BASEMAP = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background' as const,
      paint: { 'background-color': '#0b1220' },
    },
    {
      id: 'osm',
      type: 'raster' as const,
      source: 'osm',
      paint: { 'raster-opacity': 0.55, 'raster-saturation': -0.6 },
    },
  ],
};
