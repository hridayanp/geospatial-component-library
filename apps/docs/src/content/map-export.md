## Purpose

`map-export` exports what a MapLibre map shows: PNG, JPEG or WebP stills with an
optional title, attribution and custom decorations, and animated GIFs recorded
frame by frame.

```bash
npm install @hridayanp/map-export @hridayanp/map-container maplibre-gl react
```

```tsx
<MapControlBar>
  <MapExportControl
    filename="rainfall-2026-10-30"
    title="Rainfall · 30 Oct 2026 06Z"
    attribution="© OpenStreetMap contributors"
    animation={{ frameCount: frames.length, setFrame: showFrame }}
  />
</MapControlBar>
```

The package has **no runtime dependencies**: the GIF encoder is built in.

## No `preserveDrawingBuffer`

WebGL clears its drawing buffer after compositing, which is why map screenshots
usually require creating the map with `preserveDrawingBuffer` — a memory cost
paid for the map's whole life to support an occasional export. `readMapCanvas`
instead requests one render and copies the canvas **inside that render
callback**, while the frame is still in the buffer. Any `MapContainer` can be
exported without opting in up front.

## What is captured

Only what MapLibre draws. HTML overlays — legends, panels, the timeline — are
not part of the WebGL canvas. Three options compose onto the export:

| Option | Effect |
| --- | --- |
| `title` | A band across the top with the title |
| `attribution` | Small credit text in the bottom-right corner |
| `decorate(context, { width, height, pixelRatio })` | Draw anything else with the 2D canvas API — a legend, a valid time |
| `background` | Fill behind the map; white by default for JPEG, which has no transparency |

> **Warning:** tiles served without CORS headers taint the canvas, after which
> the browser refuses any export. That is a browser security rule; it surfaces
> as a rejected promise and through `onError`.

## Functions

| Function | Purpose |
| --- | --- |
| `captureMap(map, options)` | A still as a `Blob` |
| `recordMapAnimation(map, options)` | Step through frames and return an animated GIF `Blob` |
| `waitForMapIdle(map, timeoutMs)` | Resolve once tiles have loaded and the map has rendered |
| `readMapCanvas(map)` | The current frame copied into a 2D canvas |
| `downloadBlob(blob, filename)` | Hand a blob to the browser as a download |
| `encodeGif(frames, options)` | Encode RGBA frames as an animated GIF |

`captureMap` waits for the map to go idle first (`waitForIdle`, default on, up
to `idleTimeoutMs`), so an export never catches half-loaded tiles.

## Animated GIF

```ts
const gif = await recordMapAnimation(map, {
  frameCount: frames.length,
  setFrame: (i) => new Promise((done) => { setIndex(i); requestAnimationFrame(() => done()); }),
  delayMs: 400,
  scale: 0.6,
  onProgress: setProgress,
});
```

The recorder calls `setFrame(i)`, waits for the map to go idle, captures, and
repeats. `scale` shrinks frames before encoding — GIFs grow quickly.

The encoder quantises onto a **fixed** 6 × 7 × 6 colour cube (252 colours). A
fixed palette is identical in every frame, so an animation never shimmers as
each frame picks different colours, and it costs one lookup per pixel rather
than a clustering pass. Ordered (Bayer) dithering hides banding on smooth ramps;
pixels with alpha below 128 become transparent.

## `MapExportControl`

| Prop | Type | Default |
| --- | --- | --- |
| `formats` | `ImageFormat[]` | `['png', 'jpeg']` |
| `animation` | `{ frameCount, setFrame, delayMs?, scale? }` | — |
| `filename` | `string` | `'map'` |
| `onExport` | `(blob, filename) => void` | download |
| `onError` | `(error) => void` | console |
| `title`, `attribution`, `decorate`, `background`, `quality` | | see above |

Pass `onExport` to receive the blob instead of downloading it — for an upload,
a report attachment or a preview.
