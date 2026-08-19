import chroma from 'chroma-js';
import type { ColorScale, ColorScaleInput, ColorStop } from './types';

/** Default lookup-table resolution. 256 entries is imperceptible from exact. */
export const DEFAULT_LUT_SIZE = 256;

function isResolvedScale(value: unknown): value is ColorScale {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as ColorScale).stops)
  );
}

/**
 * Normalise any accepted colour-ramp shape into a {@link ColorScale}.
 *
 * Bare colour arrays are spread evenly across `0..1`. Explicit
 * `[position, colour]` stops are rescaled from their own range into `0..1`, so
 * a caller can express stops in real units (knots, millimetres, kelvin) and
 * still get a ramp that lines up with a normalised value.
 */
export function resolveColorScale(
  input: ColorScaleInput,
  options: {
    mode?: ColorScale['mode'];
    interpolation?: ColorScale['interpolation'];
  } = {},
): ColorScale {
  if (isResolvedScale(input)) {
    return {
      ...input,
      mode: options.mode ?? input.mode,
      interpolation: options.interpolation ?? input.interpolation,
    };
  }

  const stops = input as ColorStop[];
  const mode = options.mode ?? 'continuous';
  const interpolation = options.interpolation ?? 'rgb';

  if (!Array.isArray(stops) || stops.length === 0) {
    return {
      stops: [
        [0, '#000000'],
        [1, '#ffffff'],
      ],
      mode,
      interpolation,
    };
  }

  const explicit = stops.filter(
    (s): s is [number, string] => Array.isArray(s) && s.length === 2,
  );

  if (explicit.length === stops.length) {
    const sorted = [...explicit].sort((a, b) => a[0] - b[0]);
    const first = sorted[0] as [number, string];
    const last = sorted[sorted.length - 1] as [number, string];
    const span = last[0] - first[0];
    return {
      stops: sorted.map(([pos, color]) => [
        span > 0 ? (pos - first[0]) / span : 0,
        color,
      ]),
      mode,
      interpolation,
    };
  }

  const colors = stops.map((s) => (Array.isArray(s) ? s[1] : s));
  if (colors.length === 1) {
    return {
      stops: [
        [0, colors[0] as string],
        [1, colors[0] as string],
      ],
      mode,
      interpolation,
    };
  }
  return {
    stops: colors.map((color, i) => [i / (colors.length - 1), color]),
    mode,
    interpolation,
  };
}

/** The colour ramp's stop colours, in order. Convenient for CSS gradients. */
export function colorScaleColors(input: ColorScaleInput): string[] {
  return resolveColorScale(input).stops.map(([, color]) => color);
}

function buildChromaScale(scale: ColorScale) {
  return chroma
    .scale(scale.stops.map(([, color]) => color))
    .domain(scale.stops.map(([position]) => position))
    .mode(scale.interpolation);
}

/**
 * Sample the ramp at a normalised position and return a hex colour.
 *
 * In `'discrete'` mode the position snaps down to the nearest stop, producing
 * hard classed bands rather than a gradient.
 */
export function colorAt(input: ColorScaleInput, position: number): string {
  const scale = resolveColorScale(input);
  const t = Math.min(1, Math.max(0, position));
  if (scale.mode === 'discrete') {
    let chosen = scale.stops[0]?.[1] ?? '#000000';
    for (const [stopPos, color] of scale.stops) {
      if (t >= stopPos) chosen = color;
    }
    return chosen;
  }
  return buildChromaScale(scale)(t).hex();
}

/**
 * Precompute the ramp into a flat `size * 3` RGB lookup table.
 *
 * Colouring a megapixel raster one `chroma()` call at a time is the single
 * biggest cost in the render path; an array index is not. Build this once per
 * colour scale and reuse it for every frame.
 */
export function buildColorLut(
  input: ColorScaleInput,
  size: number = DEFAULT_LUT_SIZE,
): Uint8Array {
  const scale = resolveColorScale(input);
  const lut = new Uint8Array(size * 3);

  if (scale.mode === 'discrete') {
    for (let i = 0; i < size; i++) {
      const [r, g, b] = chroma(colorAt(scale, i / (size - 1))).rgb();
      lut[i * 3] = r;
      lut[i * 3 + 1] = g;
      lut[i * 3 + 2] = b;
    }
    return lut;
  }

  const chromaScale = buildChromaScale(scale);
  for (let i = 0; i < size; i++) {
    const [r, g, b] = chromaScale(i / (size - 1)).rgb();
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  return lut;
}

/**
 * A CSS `linear-gradient(...)` string for the ramp — the cheapest possible way
 * to draw a legend bar.
 *
 * Discrete scales produce hard colour stops so the bands stay crisp.
 */
export function colorScaleToCss(
  input: ColorScaleInput,
  direction: 'to right' | 'to left' | 'to top' | 'to bottom' = 'to right',
): string {
  const scale = resolveColorScale(input);
  if (scale.stops.length === 0) return 'transparent';

  if (scale.mode === 'discrete') {
    const segments: string[] = [];
    scale.stops.forEach(([position, color], i) => {
      const next = scale.stops[i + 1]?.[0] ?? 1;
      segments.push(`${color} ${position * 100}%`, `${color} ${next * 100}%`);
    });
    return `linear-gradient(${direction}, ${segments.join(', ')})`;
  }

  return `linear-gradient(${direction}, ${scale.stops
    .map(([position, color]) => `${color} ${(position * 100).toFixed(2)}%`)
    .join(', ')})`;
}

/**
 * Expand a ramp into `count` evenly spaced colours — for swatch rows, discrete
 * legends and categorical styling derived from a continuous ramp.
 */
export function sampleColorScale(
  input: ColorScaleInput,
  count: number,
): string[] {
  if (count <= 0) return [];
  if (count === 1) return [colorAt(input, 0.5)];
  return Array.from({ length: count }, (_, i) => colorAt(input, i / (count - 1)));
}

/** Convert a colour of any CSS form into `[r, g, b, a]` with `a` in `0..255`. */
export function toRgba(color: string, opacity = 1): [number, number, number, number] {
  const [r, g, b, a] = chroma(color).rgba();
  return [r, g, b, Math.round(a * opacity * 255)];
}
