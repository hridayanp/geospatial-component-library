/** A linear mapping from a data domain onto a pixel range. */
export interface LinearScale {
  domain: [number, number];
  range: [number, number];
  /** Map a data value onto a pixel position. */
  (value: number): number;
  /** Map a pixel position back to a data value. */
  invert: (pixel: number) => number;
}

/** Build a linear scale. A zero-width domain is widened so marks stay visible. */
export function linearScale(
  domain: [number, number],
  range: [number, number],
): LinearScale {
  let [d0, d1] = domain;
  if (d0 === d1) {
    const pad = Math.abs(d0) > 0 ? Math.abs(d0) * 0.05 : 0.5;
    d0 -= pad;
    d1 += pad;
  }
  const [r0, r1] = range;
  const factor = (r1 - r0) / (d1 - d0);

  const scale = ((value: number) => r0 + (value - d0) * factor) as LinearScale;
  scale.domain = [d0, d1];
  scale.range = range;
  scale.invert = (pixel: number) => d0 + (pixel - r0) / factor;
  return scale;
}

/**
 * Tick values at "nice" round numbers covering a domain.
 *
 * Axis ticks carry every value that is not directly labelled, so they have to be
 * readable at a glance: 0 / 20 / 40 / 60, never 0 / 17.3 / 34.6. The step is
 * snapped to 1, 2, 2.5, 5 or 10 times a power of ten — the intervals that read
 * as round in decimal.
 *
 * @param count Approximate number of ticks. The result may differ by one or two
 * once the step is rounded.
 */
export function niceTicks(
  domain: [number, number],
  count = 5,
): number[] {
  const [start, stop] = domain;
  if (!Number.isFinite(start) || !Number.isFinite(stop) || start === stop) {
    return [start];
  }

  const span = Math.abs(stop - start);
  const rawStep = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;

  const step =
    (normalised >= 7.5 ? 10 : normalised >= 3.5 ? 5 : normalised >= 1.5 ? 2 : 1) *
    magnitude;

  const first = Math.ceil(Math.min(start, stop) / step) * step;
  const last = Math.floor(Math.max(start, stop) / step) * step;

  const ticks: number[] = [];
  // Accumulate by index rather than by repeated addition, which drifts.
  for (let i = 0; first + i * step <= last + step * 1e-9; i++) {
    const value = first + i * step;
    // Round away the binary representation error a multiplication introduces.
    ticks.push(Number(value.toPrecision(12)));
  }
  return ticks;
}

/**
 * A domain that includes zero and ends on a round number.
 *
 * Bar and column lengths encode magnitude by their length from the baseline, so
 * their axis must start at zero — a truncated baseline multiplies apparent
 * differences and is the most common way a correct number becomes a misleading
 * chart. Line charts of a quantity that never approaches zero are the recognised
 * exception, which `includeZero: false` covers.
 */
export function niceDomain(
  values: readonly number[],
  options: { includeZero?: boolean; padding?: number } = {},
): [number, number] {
  const { includeZero = true, padding = 0.05 } = options;

  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return [0, 1];

  let min = Math.min(...finite);
  let max = Math.max(...finite);

  if (includeZero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (min === max) {
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1;
    return [min - pad, max + pad];
  }

  const pad = (max - min) * padding;
  const lower = includeZero && min >= 0 ? 0 : min - pad;
  const upper = includeZero && max <= 0 ? 0 : max + pad;

  const ticks = niceTicks([lower, upper], 5);
  const step = (ticks[1] ?? upper) - (ticks[0] ?? lower);
  if (!(step > 0)) return [lower, upper];

  return [
    includeZero && min >= 0 ? 0 : Math.floor(lower / step) * step,
    Math.ceil(upper / step) * step,
  ];
}

/**
 * Format a number for an axis tick or a compact label.
 *
 * Precision is derived from the *span* rather than from the individual value, so
 * every tick on one axis carries the same number of decimals. Mixed precision
 * down a column reads as inconsistent data rather than as formatting.
 */
export function formatCompact(value: number, span = Math.abs(value)): string {
  if (!Number.isFinite(value)) return '—';

  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) {
    return `${trim(value / 1_000_000)}M`;
  }
  if (magnitude >= 10_000) {
    return `${trim(value / 1000)}k`;
  }

  const decimals = span >= 100 ? 0 : span >= 10 ? 1 : span >= 1 ? 2 : 3;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

const trim = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** Format a fraction (`0..1`) as a percentage. */
export function formatPercent(fraction: number, decimals = 1): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/**
 * Estimated rendered width of a label, in pixels.
 *
 * Used to decide whether a value fits inside a mark before drawing it there.
 * Measuring in the DOM would be exact but forces a layout on every render; for
 * the digits and short words a chart label contains, a per-character average is
 * accurate enough to keep a label from being clipped, which is the only decision
 * it informs.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.58;
}
