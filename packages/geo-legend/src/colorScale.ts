/**
 * A minimal, dependency-free reading of a colour ramp.
 *
 * `@hridayanp/raster-utils` has a far richer implementation, but a legend only
 * ever needs a CSS gradient and a list of swatches — and a legend should not
 * force a colour-science library into a bundle that has no raster in it.
 */

/** A ramp stop: a bare colour, or an explicit `[position, colour]` pair. */
export type LegendColorStop = string | [position: number, color: string];

/** Anything the legend accepts as a colour ramp. */
export type LegendColorScale = LegendColorStop[];

/** Stops normalised to `0..1`, sorted. */
export function normalizeStops(
  scale: LegendColorScale,
): Array<[number, string]> {
  if (!scale || scale.length === 0) return [];

  const explicit = scale.filter(
    (stop): stop is [number, string] => Array.isArray(stop) && stop.length === 2,
  );

  if (explicit.length === scale.length) {
    const sorted = [...explicit].sort((a, b) => a[0] - b[0]);
    const first = sorted[0] as [number, string];
    const last = sorted[sorted.length - 1] as [number, string];
    const span = last[0] - first[0];
    return sorted.map(([position, color]) => [
      span > 0 ? (position - first[0]) / span : 0,
      color,
    ]);
  }

  const colors = scale.map((stop) => (Array.isArray(stop) ? stop[1] : stop));
  if (colors.length === 1) {
    return [
      [0, colors[0] as string],
      [1, colors[0] as string],
    ];
  }
  return colors.map((color, index) => [index / (colors.length - 1), color]);
}

/**
 * A CSS gradient for the ramp.
 *
 * `discrete` emits doubled stops so each band is a flat block rather than a
 * blend — the visual difference between "these are classes" and "this is
 * continuous", which matters for how a reader interprets the map.
 */
export function scaleToGradient(
  scale: LegendColorScale,
  direction: string,
  discrete: boolean,
): string {
  const stops = normalizeStops(scale);
  if (stops.length === 0) return 'transparent';

  if (discrete) {
    const segments: string[] = [];
    stops.forEach(([position, color], index) => {
      const next = stops[index + 1]?.[0] ?? 1;
      segments.push(
        `${color} ${(position * 100).toFixed(2)}%`,
        `${color} ${(next * 100).toFixed(2)}%`,
      );
    });
    return `linear-gradient(${direction}, ${segments.join(', ')})`;
  }

  return `linear-gradient(${direction}, ${stops
    .map(([position, color]) => `${color} ${(position * 100).toFixed(2)}%`)
    .join(', ')})`;
}

/** Evenly spaced tick values across a domain, inclusive of both ends. */
export function buildTicks(
  min: number,
  max: number,
  count: number,
): number[] {
  if (count <= 1) return [min, max];
  return Array.from(
    { length: count },
    (_, index) => min + ((max - min) * index) / (count - 1),
  );
}

/**
 * Format a value for a legend tick.
 *
 * Chooses precision from the *range*, not the individual value: a 0–1
 * probability scale needs two decimals where a 0–1000 pressure scale needs
 * none, and a legend that mixes the two reads as broken.
 */
export function defaultFormat(value: number, range: number): string {
  if (!Number.isFinite(value)) return '—';
  if (range === 0) return String(value);
  const magnitude = Math.abs(range);
  const decimals = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : magnitude >= 1 ? 2 : 3;
  return value.toFixed(decimals).replace(/\.0+$/, '');
}
