import type { ClassTable } from '@hridayanp/classified-raster';
import type { RasterData } from '@hridayanp/raster-utils';

/**
 * A classified band derived from a continuous one.
 *
 * The sample datasets are continuous measurements, so the classified-raster
 * stories reclassify one into ordered severity classes — a standard operation on
 * a continuous surface, and one that produces exactly the integer-coded band
 * those components consume. The class boundaries below are the ones the
 * convective probability band's own distribution supports.
 */

/** Ordered severity classes for convective probability, in percent. */
export const CONVECTIVE_CLASSES: ClassTable = [
  { value: 1, label: 'Negligible', color: '#dbeafe', description: 'Below 2%' },
  { value: 2, label: 'Low', color: '#93c5fd', description: '2–8%' },
  { value: 3, label: 'Moderate', color: '#facc15', description: '8–18%' },
  { value: 4, label: 'Elevated', color: '#f97316', description: '18–30%' },
  { value: 5, label: 'High', color: '#dc2626', description: 'Above 30%' },
];

/** Upper bound of each class, aligned with `CONVECTIVE_CLASSES` order. */
const BREAKS = [2, 8, 18, 30, Number.POSITIVE_INFINITY];

/**
 * Reclassify a continuous band into `CONVECTIVE_CLASSES`.
 *
 * NoData and non-finite cells are propagated as NoData rather than being
 * assigned to the lowest class — an unobserved cell is not a negligible one, and
 * conflating the two inflates the first class and understates every statistic
 * derived from the rest.
 */
export function classifyConvective(raster: RasterData): RasterData {
  const { data, width, height, bounds, noData } = raster;
  const sentinel = 0;
  const values = new Uint8Array(width * height);

  for (let i = 0; i < values.length; i++) {
    const raw = Number(data[i]);
    if (!Number.isFinite(raw) || (noData != null && raw === noData)) {
      values[i] = sentinel;
      continue;
    }
    let code = BREAKS.length;
    for (let k = 0; k < BREAKS.length; k++) {
      if (raw < BREAKS[k]!) {
        code = k + 1;
        break;
      }
    }
    values[i] = code;
  }

  return { data: values, width, height, bounds, noData: sentinel, unit: 'class' };
}

/**
 * Evenly thin a list to at most `limit` entries, preserving spatial spread.
 *
 * Getis-Ord Gi* evaluates every pair of observations, so cost grows with the
 * square of the count. Taking every *n*th feature keeps the sample spread across
 * the full extent, where taking the first *n* would analyse one corner of it.
 */
export function thin<T>(items: readonly T[], limit: number): T[] {
  if (items.length <= limit) return [...items];
  const stride = items.length / limit;
  const out: T[] = [];
  for (let i = 0; out.length < limit && Math.floor(i) < items.length; i += stride) {
    out.push(items[Math.floor(i)]!);
  }
  return out;
}
