import { speedDirectionToUV } from '@hridayanp/geo-utils';

/**
 * SVG path data for a wind barb whose station sits at the origin, shaft
 * pointing up (a northerly) before rotation. Rotate the containing group by
 * the direction the wind blows **from**.
 *
 * Feathers follow WMO practice: round to 5 kt; pennant 50, full 10, half 5.
 * Returns `{ calm: true }` for speeds that round to zero, which are drawn as
 * a circle instead.
 */
export function barbPath(
  speedKt: number,
  length = 22,
  hemisphere: 'north' | 'south' = 'north',
): { calm: boolean; shaft: string; feathers: string; pennants: string } {
  const rounded = Math.max(0, Math.round(speedKt / 5) * 5);
  if (rounded === 0) return { calm: true, shaft: '', feathers: '', pennants: '' };

  const side = hemisphere === 'south' ? 1 : -1;
  const feather = length * 0.42;
  const spacing = length * 0.17;
  let remaining = rounded;
  let y = -length;
  let pennants = '';
  let feathers = '';

  while (remaining >= 50) {
    pennants += `M0 ${y} L${side * feather} ${y - spacing * 0.6} L0 ${y + spacing * 1.1} Z `;
    y += spacing * 1.4;
    remaining -= 50;
  }
  while (remaining >= 10) {
    feathers += `M0 ${y} L${side * feather} ${y - spacing} `;
    y += spacing;
    remaining -= 10;
  }
  if (remaining >= 5) {
    if (rounded === 5) y += spacing;
    feathers += `M0 ${y} L${(side * feather) / 2} ${y - spacing / 2} `;
  }
  return { calm: false, shaft: `M0 0 L0 ${-length}`, feathers, pennants };
}

/** A wind observation for statistics. */
export interface WindSample {
  /** Direction the wind blows from, degrees. */
  direction: number;
  /** Speed in the caller's unit. */
  speed: number;
}

export interface WindRoseOptions {
  /** Number of direction sectors. Default `16`. */
  sectors?: number;
  /**
   * Lower edges of the speed classes. Default `[0, 5, 10, 15, 20, 25]` —
   * knots or m/s, whichever the samples are in.
   */
  speedBins?: readonly number[];
  /** Speeds below this count as calm and are reported separately. Default `0.5`. */
  calmBelow?: number;
}

export interface WindRoseData {
  sectors: number;
  speedBins: number[];
  /** `frequencies[sector][speedClass]`, as fractions of all samples. */
  frequencies: number[][];
  /** Fraction of samples below `calmBelow`. */
  calm: number;
  /** Samples counted, excluding those with a missing value. */
  total: number;
}

/**
 * Bin wind observations by direction sector and speed class.
 *
 * Sector 0 is centred on north, so with 16 sectors it spans 348.75°–11.25°.
 * Calms are kept out of the sectors — they have no direction — and reported
 * as their own fraction, which the rose prints in its centre.
 */
export function windRoseBins(
  samples: readonly WindSample[],
  { sectors = 16, speedBins = [0, 5, 10, 15, 20, 25], calmBelow = 0.5 }: WindRoseOptions = {},
): WindRoseData {
  const bins = [...speedBins].sort((a, b) => a - b);
  const counts = Array.from({ length: sectors }, () => new Array<number>(bins.length).fill(0));
  let calm = 0;
  let total = 0;
  const width = 360 / sectors;

  for (const { direction, speed } of samples) {
    if (!Number.isFinite(direction) || !Number.isFinite(speed)) continue;
    total++;
    if (speed < calmBelow) {
      calm++;
      continue;
    }
    const sector = Math.floor((((direction % 360) + 360 + width / 2) % 360) / width) % sectors;
    let speedClass = 0;
    for (let i = bins.length - 1; i >= 0; i--) {
      if (speed >= bins[i]!) {
        speedClass = i;
        break;
      }
    }
    counts[sector]![speedClass]!++;
  }

  const divisor = Math.max(1, total);
  return {
    sectors,
    speedBins: bins,
    frequencies: counts.map((row) => row.map((count) => count / divisor)),
    calm: calm / divisor,
    total,
  };
}

/** `[u, v]` from speed and the direction the wind blows from. */
export function windToUV(speed: number, direction: number): [number, number] {
  const { u, v } = speedDirectionToUV(speed, direction, 'from');
  return [u, v];
}
