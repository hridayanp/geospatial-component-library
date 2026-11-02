/**
 * A small, dependency-free animated GIF encoder.
 *
 * Colours are quantised onto a fixed 6×7×6 RGB cube (252 colours) rather than
 * an adaptive palette. A fixed palette is identical across frames, so an
 * animation never "swims" as each frame picks different colours, and it costs
 * one table lookup per pixel instead of a clustering pass — which matters when
 * encoding dozens of full-resolution map frames in the browser. Index 255 is
 * reserved for transparency.
 */

export interface GifFrame {
  /** RGBA pixels, `width * height * 4` long. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** How long this frame shows, in milliseconds. Overrides the default delay. */
  delayMs?: number;
}

export interface EncodeGifOptions {
  /** Default per-frame delay in milliseconds. Default `500`. */
  delayMs?: number;
  /** Times to repeat; `0` loops forever. Default `0`. */
  loop?: number;
  /** Ordered (Bayer) dithering, which hides banding on smooth ramps. Default `true`. */
  dither?: boolean;
}

const LEVELS_R = 6;
const LEVELS_G = 7;
const LEVELS_B = 6;
const TRANSPARENT = 255;

/** The fixed palette: 252 cube colours, padded to 256 entries. */
function buildPalette(): Uint8Array {
  const palette = new Uint8Array(256 * 3);
  let i = 0;
  for (let r = 0; r < LEVELS_R; r++) {
    for (let g = 0; g < LEVELS_G; g++) {
      for (let b = 0; b < LEVELS_B; b++) {
        palette[i * 3] = Math.round((r * 255) / (LEVELS_R - 1));
        palette[i * 3 + 1] = Math.round((g * 255) / (LEVELS_G - 1));
        palette[i * 3 + 2] = Math.round((b * 255) / (LEVELS_B - 1));
        i++;
      }
    }
  }
  return palette;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (v) => (v + 0.5) / 16 - 0.5,
);

function quantise(frame: GifFrame, dither: boolean): Uint8Array {
  const { data, width, height } = frame;
  const out = new Uint8Array(width * height);
  const stepR = 255 / (LEVELS_R - 1);
  const stepG = 255 / (LEVELS_G - 1);
  const stepB = 255 / (LEVELS_B - 1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (data[i * 4 + 3]! < 128) {
        out[i] = TRANSPARENT;
        continue;
      }
      const t = dither ? BAYER4[(y & 3) * 4 + (x & 3)]! : 0;
      const r = Math.min(LEVELS_R - 1, Math.max(0, Math.round(data[i * 4]! / stepR + t)));
      const g = Math.min(LEVELS_G - 1, Math.max(0, Math.round(data[i * 4 + 1]! / stepG + t)));
      const b = Math.min(LEVELS_B - 1, Math.max(0, Math.round(data[i * 4 + 2]! / stepB + t)));
      out[i] = (r * LEVELS_G + g) * LEVELS_B + b;
    }
  }
  return out;
}

/** Growable byte buffer. */
class ByteWriter {
  private buffer = new Uint8Array(1 << 16);
  length = 0;

  private ensure(extra: number) {
    if (this.length + extra <= this.buffer.length) return;
    let size = this.buffer.length * 2;
    while (size < this.length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buffer.subarray(0, this.length));
    this.buffer = next;
  }

  byte(value: number) {
    this.ensure(1);
    this.buffer[this.length++] = value & 0xff;
  }

  short(value: number) {
    this.byte(value);
    this.byte(value >> 8);
  }

  bytes(values: ArrayLike<number>) {
    this.ensure(values.length);
    for (let i = 0; i < values.length; i++) this.buffer[this.length++] = values[i]!;
  }

  ascii(text: string) {
    for (let i = 0; i < text.length; i++) this.byte(text.charCodeAt(i));
  }

  result(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }
}

/**
 * GIF-flavoured LZW, written into 255-byte sub-blocks.
 *
 * Follows the code-size schedule of omggif: the code width grows *before* the
 * first code that needs the wider width is assigned, and the table is reset
 * with a clear code once all 4096 codes are used.
 */
function writeLzw(out: ByteWriter, indices: Uint8Array, minCodeSize: number) {
  out.byte(minCodeSize);
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let nextCode = eoiCode + 1;
  let codeSize = minCodeSize + 1;
  let table = new Map<number, number>();

  let bitBuffer = 0;
  let bitCount = 0;
  const block: number[] = [];
  const flushBlock = () => {
    if (block.length === 0) return;
    out.byte(block.length);
    out.bytes(block);
    block.length = 0;
  };
  const emit = (code: number) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      block.push(bitBuffer & 0xff);
      bitBuffer >>>= 8;
      bitCount -= 8;
      if (block.length === 255) flushBlock();
    }
  };

  emit(clearCode);
  let current = indices[0] ?? 0;
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]!;
    const key = (current << 8) | k;
    const existing = table.get(key);
    if (existing !== undefined) {
      current = existing;
      continue;
    }
    emit(current);
    if (nextCode === 4096) {
      emit(clearCode);
      nextCode = eoiCode + 1;
      codeSize = minCodeSize + 1;
      table = new Map();
    } else {
      if (nextCode >= 1 << codeSize) codeSize++;
      table.set(key, nextCode++);
    }
    current = k;
  }
  emit(current);
  emit(eoiCode);
  if (bitCount > 0) block.push(bitBuffer & 0xff);
  flushBlock();
  out.byte(0); // block terminator
}

/**
 * Encode RGBA frames as an animated GIF.
 *
 * Every frame must share the first frame's dimensions. Pixels with alpha below
 * 128 become transparent.
 */
export function encodeGif(frames: readonly GifFrame[], options: EncodeGifOptions = {}): Uint8Array {
  const first = frames[0];
  if (!first) throw new Error('[gcl] encodeGif needs at least one frame');
  const { width, height } = first;
  const delay = options.delayMs ?? 500;
  const dither = options.dither ?? true;

  const out = new ByteWriter();
  out.ascii('GIF89a');
  out.short(width);
  out.short(height);
  out.byte(0xf7); // global colour table, 8 bits/channel, 256 entries
  out.byte(0); // background colour index
  out.byte(0); // pixel aspect ratio
  out.bytes(buildPalette());

  // NETSCAPE2.0 application extension: loop count.
  out.byte(0x21);
  out.byte(0xff);
  out.byte(11);
  out.ascii('NETSCAPE2.0');
  out.byte(3);
  out.byte(1);
  out.short(options.loop ?? 0);
  out.byte(0);

  for (const frame of frames) {
    if (frame.width !== width || frame.height !== height) {
      throw new Error('[gcl] encodeGif: every frame must have the same size');
    }
    // Graphic control: restore-to-background disposal, transparency on index 255.
    out.byte(0x21);
    out.byte(0xf9);
    out.byte(4);
    out.byte(0b00001001);
    out.short(Math.round((frame.delayMs ?? delay) / 10));
    out.byte(TRANSPARENT);
    out.byte(0);

    out.byte(0x2c);
    out.short(0);
    out.short(0);
    out.short(width);
    out.short(height);
    out.byte(0);

    writeLzw(out, quantise(frame, dither), 8);
  }

  out.byte(0x3b);
  return out.result();
}
