import { barbComponents } from './samples';

/** Logical edge of every generated icon, in CSS pixels. */
export const ICON_SIZE = 64;
/** Resolution multiplier, so icons stay crisp on high-density displays. */
const PIXEL_RATIO = 2;

const CENTRE = ICON_SIZE / 2;
const SHAFT = 26;
const FEATHER = 11;
const SPACING = 4.5;

/** Name of the image registered for a barb of the given rounded speed. */
export function barbIconName(
  prefix: string,
  roundedKt: number,
  hemisphere: 'north' | 'south',
): string {
  return `${prefix}-barb-${hemisphere === 'south' ? 's' : 'n'}-${roundedKt}`;
}

/** Name of the image registered for a direction arrow. */
export function arrowIconName(prefix: string): string {
  return `${prefix}-arrow`;
}

type Draw = (context: CanvasRenderingContext2D, mirror: (x: number) => number) => void;

function drawBarb(speedKt: number): Draw {
  return (context, mx) => {
    const { rounded, pennants, full, half } = barbComponents(speedKt);
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    if (rounded === 0) {
      // Calm: an open circle around the station, no shaft.
      context.beginPath();
      context.arc(CENTRE, CENTRE, 5, 0, Math.PI * 2);
      context.stroke();
      return;
    }

    // The shaft runs from the station towards the direction the wind comes
    // from; at rotation 0 that is straight up, i.e. a northerly.
    const tip = CENTRE - SHAFT;
    context.beginPath();
    context.moveTo(mx(CENTRE), CENTRE);
    context.lineTo(mx(CENTRE), tip);
    context.stroke();

    let y = tip;
    for (let i = 0; i < pennants; i++) {
      context.beginPath();
      context.moveTo(mx(CENTRE), y);
      context.lineTo(mx(CENTRE - FEATHER), y - 3);
      context.lineTo(mx(CENTRE), y + 5);
      context.closePath();
      context.fill();
      y += 5 + 1.5;
    }
    for (let i = 0; i < full; i++) {
      context.beginPath();
      context.moveTo(mx(CENTRE), y);
      context.lineTo(mx(CENTRE - FEATHER), y - 4.5);
      context.stroke();
      y += SPACING;
    }
    if (half) {
      // A lone half barb is set one space in from the tip, so it cannot be
      // misread as a full barb with a short shaft.
      if (pennants === 0 && full === 0) y += SPACING;
      context.beginPath();
      context.moveTo(mx(CENTRE), y);
      context.lineTo(mx(CENTRE - FEATHER / 2), y - 2.25);
      context.stroke();
    }
  };
}

const drawArrow: Draw = (context) => {
  context.lineWidth = 2.5;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  // Points up: rotation is the direction of travel.
  context.beginPath();
  context.moveTo(CENTRE, CENTRE + 18);
  context.lineTo(CENTRE, CENTRE - 16);
  context.stroke();
  context.beginPath();
  context.moveTo(CENTRE, CENTRE - 22);
  context.lineTo(CENTRE - 7, CENTRE - 10);
  context.lineTo(CENTRE + 7, CENTRE - 10);
  context.closePath();
  context.fill();
};

/**
 * Two-pass chamfer distance transform: the distance from every pixel to the
 * nearest pixel where `mask` is set. O(n), which matters — icons are generated
 * on demand while the map is drawing.
 */
function chamfer(mask: Uint8Array, width: number, height: number): Float32Array {
  const INF = 1e6;
  const D1 = 1;
  const D2 = Math.SQRT2;
  const dist = new Float32Array(width * height);
  for (let i = 0; i < dist.length; i++) dist[i] = mask[i] ? 0 : INF;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let d = dist[i]!;
      if (x > 0) d = Math.min(d, dist[i - 1]! + D1);
      if (y > 0) {
        d = Math.min(d, dist[i - width]! + D1);
        if (x > 0) d = Math.min(d, dist[i - width - 1]! + D2);
        if (x < width - 1) d = Math.min(d, dist[i - width + 1]! + D2);
      }
      dist[i] = d;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      let d = dist[i]!;
      if (x < width - 1) d = Math.min(d, dist[i + 1]! + D1);
      if (y < height - 1) {
        d = Math.min(d, dist[i + width]! + D1);
        if (x < width - 1) d = Math.min(d, dist[i + width + 1]! + D2);
        if (x > 0) d = Math.min(d, dist[i + width - 1]! + D2);
      }
      dist[i] = d;
    }
  }
  return dist;
}

export interface SdfImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  pixelRatio: number;
}

/**
 * Rasterise a glyph and encode it as a signed distance field.
 *
 * An SDF icon is recoloured by MapLibre's `icon-color` and can carry an
 * `icon-halo`, so one image per speed serves every colour scheme — a plain
 * bitmap would need a separate image for every colour a barb is drawn in.
 * The encoding follows TinySDF (radius 8, cutoff 0.25), the convention MapLibre
 * uses for its own glyphs.
 */
function rasterise(draw: Draw, mirror: boolean): SdfImage | null {
  if (typeof document === 'undefined') return null;
  const size = ICON_SIZE * PIXEL_RATIO;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;

  context.scale(PIXEL_RATIO, PIXEL_RATIO);
  context.strokeStyle = '#000';
  context.fillStyle = '#000';
  draw(context, mirror ? (x) => ICON_SIZE - x : (x) => x);

  const pixels = context.getImageData(0, 0, size, size).data;
  const inside = new Uint8Array(size * size);
  const outside = new Uint8Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const on = pixels[i * 4 + 3]! >= 128;
    inside[i] = on ? 1 : 0;
    outside[i] = on ? 0 : 1;
  }
  const toInside = chamfer(inside, size, size);
  const toOutside = chamfer(outside, size, size);

  const RADIUS = 8;
  const CUTOFF = 0.25;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const signed = inside[i] ? -(toOutside[i]! - 0.5) : toInside[i]! - 0.5;
    const alpha = 255 - 255 * (signed / RADIUS + CUTOFF);
    data[i * 4] = 0;
    data[i * 4 + 1] = 0;
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = alpha;
  }
  return { width: size, height: size, data, pixelRatio: PIXEL_RATIO };
}

/** SDF image of a wind barb for a speed in knots. */
export function createBarbImage(
  speedKt: number,
  hemisphere: 'north' | 'south' = 'north',
): SdfImage | null {
  // Northern-hemisphere barbs sit on the left of the shaft looking from the
  // station; the southern convention mirrors them.
  return rasterise(drawBarb(speedKt), hemisphere === 'south');
}

/** SDF image of a direction arrow pointing up. */
export function createArrowImage(): SdfImage | null {
  return rasterise(drawArrow, false);
}
