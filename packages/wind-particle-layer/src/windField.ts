import {
  getFeatures,
  geometryAnchor,
  parseDirection,
  pickProperty,
  speedDirectionToUV,
  toFiniteNumber,
  uvToSpeedDirection,
  type Bounds,
  type GeoJsonFeature,
} from '@hridayanp/geo-utils';
import type {
  WindField,
  WindPoints,
  WindTextureSource,
  WindVector,
} from './types';

/** Longest edge of a generated UV texture. Higher is smoother but slower. */
export const MAX_TEXTURE_SIZE = 512;

/** Passes of gap filling used to close small holes in a scattered grid. */
const FILL_PASSES = 4;

/** Property names commonly used for speed, in priority order. */
const SPEED_KEYS = [
  'speed',
  'wind_speed',
  'wind_speed_kt',
  'wind_speed_ms',
  'wind_gust',
  'wind_gust_kt',
  'speed_kt',
  'spd',
  'ws',
  'wspd',
  'magnitude',
  'value',
] as const;

/** Property names commonly used for direction, in priority order. */
const DIRECTION_KEYS = [
  'direction',
  'wind_dir_deg',
  'wind_direction',
  'wind_dir',
  'dir_deg',
  'dir',
  'wdir',
  'wd',
  'wind_dir_deg_compass',
  'wind_direction_compass',
  'wind_dir_compass',
  'compass',
] as const;

/** Property names commonly used for the eastward/northward components. */
const U_KEYS = ['u', 'u_kt', 'wind_u', 'wind_u_kt', 'ugrd'] as const;
const V_KEYS = ['v', 'v_kt', 'wind_v', 'wind_v_kt', 'vgrd'] as const;

/**
 * Convert one feature into a flow vector.
 *
 * Explicit `u`/`v` properties win when present, because they carry no
 * convention ambiguity. Otherwise a speed and a direction are read — accepting
 * numeric bearings and compass names alike, since real feeds use both.
 *
 * Speed is clamped to `maxSpeed` **without rotating the vector**, so an
 * outlier gust keeps its direction rather than skewing the field.
 */
export function featureToWindVector(
  feature: GeoJsonFeature,
  options: {
    maxSpeed: number;
    speedProperty?: string;
    directionProperty?: string;
    convention: 'from' | 'towards';
  },
): WindVector | null {
  if (!feature) return null;

  const anchor = geometryAnchor(feature.geometry);
  const properties = (feature.properties ?? {}) as Record<string, unknown>;

  const lon =
    anchor?.[0] ??
    toFiniteNumber(
      pickProperty(properties, ['lon', 'lng', 'longitude', 'long']),
    );
  const lat =
    anchor?.[1] ??
    toFiniteNumber(pickProperty(properties, ['lat', 'latitude']));
  if (lon == null || lat == null) return null;

  const { maxSpeed, speedProperty, directionProperty, convention } = options;

  // 1. Explicit components.
  const u = toFiniteNumber(pickProperty(properties, U_KEYS));
  const v = toFiniteNumber(pickProperty(properties, V_KEYS));
  if (u != null && v != null) {
    const magnitude = Math.hypot(u, v);
    const scale = magnitude > maxSpeed ? maxSpeed / magnitude : 1;
    const { direction } = uvToSpeedDirection(u, v, convention);
    return {
      lon,
      lat,
      speed: magnitude * scale,
      direction,
      u: u * scale,
      v: v * scale,
    };
  }

  // 2. Speed plus direction.
  const speedKeys = speedProperty ? [speedProperty, ...SPEED_KEYS] : SPEED_KEYS;
  const directionKeys = directionProperty
    ? [directionProperty, ...DIRECTION_KEYS]
    : DIRECTION_KEYS;

  const rawSpeed = toFiniteNumber(pickProperty(properties, speedKeys));
  const rawDirection = parseDirection(
    pickProperty(properties, directionKeys) as string | number | null,
  );
  if (rawSpeed == null || rawDirection == null) return null;

  const speed = Math.min(maxSpeed, Math.max(0, rawSpeed));
  const components = speedDirectionToUV(speed, rawDirection, convention);
  return { lon, lat, speed, direction: rawDirection, ...components };
}

/** Convert every feature in the input into a flow vector. */
export function extractWindVectors(
  input: WindPoints,
  maxSpeed: number,
): WindVector[] {
  const convention = input.directionConvention ?? 'from';
  const vectors: WindVector[] = [];
  for (const feature of getFeatures(input.data)) {
    const vector = featureToWindVector(feature, {
      maxSpeed,
      ...(input.speedProperty ? { speedProperty: input.speedProperty } : {}),
      ...(input.directionProperty
        ? { directionProperty: input.directionProperty }
        : {}),
      convention,
    });
    if (vector) vectors.push(vector);
  }
  return vectors;
}

/** Median spacing of a coordinate list, used to infer a grid step. */
function inferStep(values: number[]): number {
  const unique = Array.from(
    new Set(values.map((value) => Math.round(value * 1e4) / 1e4)),
  ).sort((a, b) => a - b);
  if (unique.length < 2) return 0;
  const deltas: number[] = [];
  for (let i = 1; i < unique.length; i++) {
    const delta = (unique[i] as number) - (unique[i - 1] as number);
    if (delta > 1e-6) deltas.push(delta);
  }
  if (deltas.length === 0) return 0;
  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)] as number;
}

/**
 * Encode a `u`/`v` grid as a UV PNG data URL.
 *
 * The encoding is WeatherLayers' `imageUnscale` contract for 8-bit data:
 *
 * ```
 * R = (u - min) / (max - min) * 255   eastward component
 * G = (v - min) / (max - min) * 255   northward component
 * B = 0                               unused
 * A = 255 where data exists, 0 elsewhere
 * ```
 *
 * Alpha must be a hard `255`, not a partial value: WeatherLayers treats
 * anything less as missing data and simply draws no particles there.
 */
export function encodeUVTexture(
  u: ArrayLike<number>,
  v: ArrayLike<number>,
  width: number,
  height: number,
  bounds: Bounds,
  options: { maxSpeed: number; noData?: number | null; key?: string },
): WindTextureSource | null {
  if (typeof document === 'undefined') return null;
  const { maxSpeed, noData } = options;
  const cells = width * height;
  if (cells <= 0 || u.length < cells || v.length < cells) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imageData = ctx.createImageData(width, height);
  const span = maxSpeed * 2;

  for (let i = 0; i < cells; i++) {
    const offset = i * 4;
    const uValue = u[i] as number;
    const vValue = v[i] as number;
    const missing =
      Number.isNaN(uValue) ||
      Number.isNaN(vValue) ||
      (noData != null && (uValue === noData || vValue === noData));
    if (missing) {
      imageData.data[offset + 3] = 0;
      continue;
    }
    imageData.data[offset] = Math.round(
      ((Math.min(maxSpeed, Math.max(-maxSpeed, uValue)) + maxSpeed) / span) * 255,
    );
    imageData.data[offset + 1] = Math.round(
      ((Math.min(maxSpeed, Math.max(-maxSpeed, vValue)) + maxSpeed) / span) * 255,
    );
    imageData.data[offset + 2] = 0;
    imageData.data[offset + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  return {
    url: canvas.toDataURL('image/png'),
    bounds,
    imageUnscale: [-maxSpeed, maxSpeed],
    key:
      options.key ??
      [`${width}x${height}`, bounds.map((b) => b.toFixed(4)).join(','), maxSpeed].join(
        ':',
      ),
  };
}

/** Encode a {@link WindField} directly — no resampling needed. */
export function fieldToTexture(
  field: WindField,
  maxSpeed: number,
  key?: string,
): WindTextureSource | null {
  return encodeUVTexture(
    field.u,
    field.v,
    field.width,
    field.height,
    field.bounds,
    {
      maxSpeed,
      ...(field.noData !== undefined ? { noData: field.noData } : {}),
      ...(key ? { key } : {}),
    },
  );
}

/**
 * Rasterise scattered vectors onto a regular grid and encode it.
 *
 * Two details make the difference between a field that reads as weather and
 * one that reads as a scatter plot:
 *
 * - the grid is sized from the input's **own point spacing**, so the texture
 *   matches the data's real resolution rather than an arbitrary constant;
 * - gaps take a **distance-weighted average of their neighbours** rather than
 *   copying the nearest cell. A hard copy leaves a visible seam where two
 *   filled patches meet, which reads on screen as the flow "jumping".
 */
export function pointsToTexture(
  vectors: WindVector[],
  options: { maxSpeed: number; key?: string; maxTextureSize?: number },
): WindTextureSource | null {
  const { maxSpeed, key, maxTextureSize = MAX_TEXTURE_SIZE } = options;
  if (vectors.length < 2) return null;
  if (typeof document === 'undefined') return null;

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const point of vectors) {
    if (point.lon < minLon) minLon = point.lon;
    if (point.lon > maxLon) maxLon = point.lon;
    if (point.lat < minLat) minLat = point.lat;
    if (point.lat > maxLat) maxLat = point.lat;
  }
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) return null;

  const stepLon = inferStep(vectors.map((p) => p.lon)) || 0.25;
  const stepLat = inferStep(vectors.map((p) => p.lat)) || 0.25;

  // Image edges sit half a cell outside the outermost sample centres.
  const bounds: Bounds = [
    minLon - stepLon / 2,
    minLat - stepLat / 2,
    maxLon + stepLon / 2,
    maxLat + stepLat / 2,
  ];
  const spanLon = bounds[2] - bounds[0];
  const spanLat = bounds[3] - bounds[1];
  if (spanLon <= 0 || spanLat <= 0) return null;

  let width = Math.max(2, Math.round(spanLon / stepLon));
  let height = Math.max(2, Math.round(spanLat / stepLat));
  const scale = Math.min(1, maxTextureSize / Math.max(width, height));
  width = Math.max(2, Math.round(width * scale));
  height = Math.max(2, Math.round(height * scale));

  const cells = width * height;
  const sumU = new Float32Array(cells);
  const sumV = new Float32Array(cells);
  const count = new Uint16Array(cells);

  for (const point of vectors) {
    const cx = Math.floor(((point.lon - bounds[0]) / spanLon) * width);
    // Row 0 is the northern edge — image space runs top-down.
    const cy = Math.floor(((bounds[3] - point.lat) / spanLat) * height);
    const x = Math.min(width - 1, Math.max(0, cx));
    const y = Math.min(height - 1, Math.max(0, cy));
    const index = x + y * width;
    sumU[index] = (sumU[index] as number) + point.u;
    sumV[index] = (sumV[index] as number) + point.v;
    count[index] = (count[index] as number) + 1;
  }

  const u = new Float32Array(cells);
  const v = new Float32Array(cells);
  const filled = new Uint8Array(cells);
  for (let i = 0; i < cells; i++) {
    const n = count[i] as number;
    if (n > 0) {
      u[i] = (sumU[i] as number) / n;
      v[i] = (sumV[i] as number) / n;
      filled[i] = 1;
    } else {
      u[i] = Number.NaN;
      v[i] = Number.NaN;
    }
  }

  for (let pass = 0; pass < FILL_PASSES; pass++) {
    const nextFilled = filled.slice();
    let changed = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = x + y * width;
        if (filled[index]) continue;
        let sumWeightedU = 0;
        let sumWeightedV = 0;
        let weightSum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const neighbour = nx + ny * width;
            if (!filled[neighbour]) continue;
            // Orthogonal neighbours weigh more than diagonals.
            const weight = dx === 0 || dy === 0 ? 1 : Math.SQRT1_2;
            sumWeightedU += (u[neighbour] as number) * weight;
            sumWeightedV += (v[neighbour] as number) * weight;
            weightSum += weight;
          }
        }
        if (weightSum > 0) {
          u[index] = sumWeightedU / weightSum;
          v[index] = sumWeightedV / weightSum;
          nextFilled[index] = 1;
          changed = true;
        }
      }
    }
    filled.set(nextFilled);
    if (!changed) break;
  }

  return encodeUVTexture(u, v, width, height, bounds, {
    maxSpeed,
    key: key ?? `${width}x${height}:${vectors.length}:${bounds.join(',')}`,
  });
}
