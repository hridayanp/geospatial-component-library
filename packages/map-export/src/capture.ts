import type { Map as MapLibreMap } from 'maplibre-gl';
import { encodeGif, type EncodeGifOptions, type GifFrame } from './gif';

/** Raster format for a still export. */
export type ImageFormat = 'png' | 'jpeg' | 'webp';

export interface CaptureOptions {
  /** Default `'png'`. */
  format?: ImageFormat;
  /** `0..1` for JPEG and WebP. Default `0.92`. */
  quality?: number;
  /**
   * Fill behind the map. Defaults to white for JPEG, which cannot hold
   * transparency, and to transparent otherwise.
   */
  background?: string;
  /** Title drawn in a band across the top of the image. */
  title?: string;
  /** Small text in the bottom-right corner — credit the data and the basemap. */
  attribution?: string;
  /**
   * Draw anything else onto the export — a legend, a north arrow, a valid
   * time — with the 2D canvas API, after the map and before the title band.
   */
  decorate?: (context: CanvasRenderingContext2D, size: { width: number; height: number; pixelRatio: number }) => void;
  /** Wait for tiles to finish loading first. Default `true`. */
  waitForIdle?: boolean;
  /** Give up waiting for idle after this long. Default `5000` ms. */
  idleTimeoutMs?: number;
}

/** Resolve once the map has finished loading and rendering, or after `timeoutMs`. */
export function waitForMapIdle(map: MapLibreMap, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      map.off('idle', finish);
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    if (map.loaded() && !map.isMoving()) {
      // Already idle; still take one frame so a pending style change lands.
      map.once('render', () => window.setTimeout(finish, 0));
      map.triggerRepaint();
    } else {
      map.on('idle', finish);
    }
  });
}

/**
 * Copy the map's current frame into a 2D canvas.
 *
 * WebGL clears its drawing buffer after compositing unless the map was created
 * with `preserveDrawingBuffer`, which costs memory for the map's whole life.
 * Instead, this requests one render and copies the canvas inside that render
 * callback, while the frame is still in the buffer — so export works on any
 * `MapContainer` without opting in up front.
 */
export function readMapCanvas(map: MapLibreMap): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    map.once('render', () => {
      try {
        const source = map.getCanvas();
        const copy = document.createElement('canvas');
        copy.width = source.width;
        copy.height = source.height;
        const context = copy.getContext('2d');
        if (!context) throw new Error('[gcl] 2D canvas unavailable');
        context.drawImage(source, 0, 0);
        resolve(copy);
      } catch (error) {
        // A cross-origin tile without CORS headers taints the canvas.
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    map.triggerRepaint();
  });
}

/** Compose the map frame with background, decorations, title and attribution. */
async function compose(map: MapLibreMap, options: CaptureOptions): Promise<HTMLCanvasElement> {
  if (options.waitForIdle !== false) await waitForMapIdle(map, options.idleTimeoutMs);
  const frame = await readMapCanvas(map);
  const pixelRatio = frame.width / Math.max(1, map.getCanvas().clientWidth || frame.width);
  const titleBand = options.title ? Math.round(36 * pixelRatio) : 0;

  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height + titleBand;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('[gcl] 2D canvas unavailable');

  const background = options.background ?? (options.format === 'jpeg' ? '#ffffff' : null);
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(frame, 0, titleBand);

  options.decorate?.(context, { width: canvas.width, height: canvas.height, pixelRatio });

  const font = (size: number, weight = 400) =>
    `${weight} ${Math.round(size * pixelRatio)}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  if (options.title) {
    context.fillStyle = 'rgba(15, 23, 42, 0.92)';
    context.fillRect(0, 0, canvas.width, titleBand);
    context.fillStyle = '#f8fafc';
    context.font = font(15, 600);
    context.textBaseline = 'middle';
    context.fillText(options.title, Math.round(12 * pixelRatio), titleBand / 2);
  }

  if (options.attribution) {
    context.font = font(10);
    const padding = Math.round(4 * pixelRatio);
    const width = context.measureText(options.attribution).width + padding * 2;
    const height = Math.round(16 * pixelRatio);
    context.fillStyle = 'rgba(255, 255, 255, 0.75)';
    context.fillRect(canvas.width - width, canvas.height - height, width, height);
    context.fillStyle = '#0f172a';
    context.textBaseline = 'middle';
    context.fillText(options.attribution, canvas.width - width + padding, canvas.height - height / 2);
  }
  return canvas;
}

/**
 * Export the map as an image `Blob`.
 *
 * ```ts
 * const blob = await captureMap(map, { format: 'png', title: 'MSLP 30 Oct 06Z' });
 * downloadBlob(blob, 'mslp.png');
 * ```
 *
 * Only what MapLibre draws is captured; HTML overlays (legends, panels) are
 * not part of the WebGL canvas. Use `decorate` to draw a legend into the
 * export. Tiles served without CORS headers taint the canvas and make export
 * impossible — that is a browser security rule, reported as a rejected promise.
 */
export async function captureMap(map: MapLibreMap, options: CaptureOptions = {}): Promise<Blob> {
  const canvas = await compose(map, options);
  const type = `image/${options.format ?? 'png'}`;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, options.quality ?? 0.92),
  );
  if (!blob) throw new Error('[gcl] Image encoding failed');
  return blob;
}

/** Hand a `Blob` to the browser as a download. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke after the click has been processed; revoking synchronously can
  // cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface RecordAnimationOptions extends Omit<CaptureOptions, 'format' | 'quality'>, EncodeGifOptions {
  /** Number of frames to record. */
  frameCount: number;
  /**
   * Put the map into frame `index` — advance the timeline, swap the raster.
   * Resolve once the host has applied it; the recorder then waits for the map
   * to go idle before capturing.
   */
  setFrame: (index: number) => void | Promise<void>;
  /** Scale the frames down before encoding; GIFs grow fast. Default `1`. */
  scale?: number;
  /** Progress callback, `0..1`. */
  onProgress?: (fraction: number) => void;
  /** Abort the recording. */
  signal?: AbortSignal;
}

/**
 * Step through an animation, capture every frame and encode an animated GIF.
 *
 * ```ts
 * const gif = await recordMapAnimation(map, {
 *   frameCount: frames.length,
 *   setFrame: (i) => new Promise((done) => { setIndex(i); requestAnimationFrame(() => done()); }),
 *   delayMs: 400,
 *   scale: 0.6,
 * });
 * downloadBlob(gif, 'rainfall.gif');
 * ```
 */
export async function recordMapAnimation(
  map: MapLibreMap,
  options: RecordAnimationOptions,
): Promise<Blob> {
  const { frameCount, setFrame, scale = 1, onProgress, signal, delayMs, loop, dither, ...capture } = options;
  const frames: GifFrame[] = [];
  for (let index = 0; index < frameCount; index++) {
    if (signal?.aborted) throw new DOMException('Recording aborted', 'AbortError');
    await setFrame(index);
    const canvas = await compose(map, { ...capture, format: 'png' });
    const width = Math.max(1, Math.round(canvas.width * scale));
    const height = Math.max(1, Math.round(canvas.height * scale));
    const scaled = document.createElement('canvas');
    scaled.width = width;
    scaled.height = height;
    const context = scaled.getContext('2d');
    if (!context) throw new Error('[gcl] 2D canvas unavailable');
    context.drawImage(canvas, 0, 0, width, height);
    frames.push({ data: context.getImageData(0, 0, width, height).data, width, height });
    onProgress?.((index + 1) / frameCount);
  }
  const bytes = encodeGif(frames, {
    ...(delayMs != null ? { delayMs } : {}),
    ...(loop != null ? { loop } : {}),
    ...(dither != null ? { dither } : {}),
  });
  return new Blob([bytes as BlobPart], { type: 'image/gif' });
}
