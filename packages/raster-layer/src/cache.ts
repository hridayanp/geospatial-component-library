import type { Bounds } from '@hridayanp/geo-utils';

/** A colourised frame, ready to hand to a MapLibre image source. */
export interface CachedFrame {
  url: string;
  bounds: Bounds;
  domain: [number, number];
}

/**
 * A bounded least-recently-used cache of decoded frames.
 *
 * Decoding and colourising a GeoTIFF costs tens to hundreds of milliseconds;
 * scrubbing a timeline revisits the same frames constantly. Caching them turns
 * the second pass through a sequence into pure texture swaps — which is what
 * makes playback feel instant rather than stuttery.
 *
 * The bound matters just as much: every entry holds a base64 PNG, so an
 * unbounded cache over a long forecast run would quietly consume hundreds of
 * megabytes.
 */
export class RasterFrameCache {
  private readonly entries = new Map<string, CachedFrame>();

  constructor(private maxSize = 24) {}

  get(key: string): CachedFrame | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    // Re-insert to mark as most recently used.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  set(key: string, frame: CachedFrame): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, frame);
    while (this.entries.size > this.maxSize) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  /** Drop everything — call when the colour scale changes. */
  clear(): void {
    this.entries.clear();
  }

  /** Change the bound, evicting immediately if it shrank. */
  resize(maxSize: number): void {
    this.maxSize = Math.max(1, maxSize);
    while (this.entries.size > this.maxSize) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

/**
 * The cache used when a component is not given one of its own.
 *
 * Shared deliberately: two layers showing the same frames — a main map and an
 * inset, say — should decode each frame once between them.
 */
export const defaultFrameCache = new RasterFrameCache(24);
