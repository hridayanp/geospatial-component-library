import type { RasterData } from '@hridayanp/raster-utils';
import type { WindField } from '@hridayanp/wind-particle-layer';

/**
 * Temporal sequences derived from the single-time sample datasets.
 *
 * The files in `assets/` record one analysis time, so the stories that document
 * playback construct a sequence from the decoded data rather than from a second
 * source. Both helpers preserve grid dimensions, extent and the NoData mask, so
 * the rendering path is identical to a real forecast series: N distinct objects,
 * each with a stable cache identity, and — for the velocity fields — matching
 * dimensions, which is what permits the GPU cross-fade to run between frames.
 */

/** One step of a derived raster sequence, shaped as a `TimelineFrame`. */
export interface DerivedRasterFrame {
  id: string;
  label: string;
  /** `TimelineFrame.meta` is passed through untouched; stories read it back. */
  meta: { raster: RasterData };
}

/**
 * Derive a raster sequence by advecting a weighting field across a decoded
 * band. Cells holding NoData are propagated as `NaN` and stay transparent.
 */
export function deriveRasterSequence(
  base: RasterData,
  count: number,
  startHourUtc = 13,
): DerivedRasterFrame[] {
  const { width, height, bounds, noData, unit } = base;
  const source = base.data;

  return Array.from({ length: count }, (_, step) => {
    const phase = (step / count) * Math.PI * 2;
    const values = new Float32Array(width * height);

    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        const index = row * width + column;
        const value = Number(source[index]);
        if (!Number.isFinite(value) || (noData != null && value === noData)) {
          values[index] = Number.NaN;
          continue;
        }
        const nx = column / Math.max(1, width - 1);
        const ny = row / Math.max(1, height - 1);
        const weight =
          0.45 +
          0.55 *
            (0.5 + 0.5 * Math.sin(phase + nx * 3.1)) *
            (0.5 + 0.5 * Math.cos(phase * 0.7 + ny * 2.4));
        values[index] = value * weight;
      }
    }

    const minutes = step * 30;
    const hh = String(startHourUtc + Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');

    return {
      id: `derived-raster-${step}`,
      label: `${hh}:${mm} UTC`,
      meta: {
        raster: {
          data: values,
          width,
          height,
          bounds,
          noData: Number.NaN,
          ...(unit ? { unit } : {}),
        },
      },
    };
  });
}

/**
 * Derive a sequence of velocity grids by rotating and scaling every vector in a
 * decoded field. Grid dimensions are preserved across the sequence.
 */
export function deriveWindFields(base: WindField, count: number): WindField[] {
  const { width, height, bounds, noData } = base;
  const sentinel = noData ?? -9999;

  return Array.from({ length: count }, (_, step) => {
    const phase = (step / count) * Math.PI * 2;
    const u = new Float32Array(width * height);
    const v = new Float32Array(width * height);

    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        const index = row * width + column;
        const su = Number(base.u[index]);
        const sv = Number(base.v[index]);
        if (
          !Number.isFinite(su) ||
          !Number.isFinite(sv) ||
          su === sentinel ||
          sv === sentinel
        ) {
          u[index] = sentinel;
          v[index] = sentinel;
          continue;
        }

        const nx = column / Math.max(1, width - 1);
        const angle = Math.sin(phase + nx * 2.2) * 0.35;
        const scale = 0.75 + 0.35 * Math.cos(phase + nx * 1.4);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        u[index] = (su * cos - sv * sin) * scale;
        v[index] = (su * sin + sv * cos) * scale;
      }
    }

    return { kind: 'field', u, v, width, height, bounds, noData: sentinel };
  });
}
