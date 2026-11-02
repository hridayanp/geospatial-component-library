# @hridayanp/map-export

Export a MapLibre map as PNG, JPEG or an animated GIF — no runtime dependencies, no preserveDrawingBuffer.

## Installation

```bash
npm install @hridayanp/map-export @hridayanp/map-container maplibre-gl react
```


This package renders UI, so import the stylesheet once anywhere in your app:

```ts
import '@hridayanp/ui/styles.css';
```

Every colour, radius and font is a CSS custom property — override the variables
to retheme, and set `data-gcl-theme="light"` or `"dark"` on any ancestor to
switch modes.

## Usage

```tsx
<MapControlBar>
  <MapExportControl
    filename="rainfall"
    title="Rainfall · 30 Oct 2026 06Z"
    attribution="© OpenStreetMap contributors"
    animation={{ frameCount: frames.length, setFrame: showFrame }}
  />
</MapControlBar>
```

## Notes

- The canvas is copied inside a render callback, so the map needs no
  `preserveDrawingBuffer`.
- Only what MapLibre draws is captured; `title`, `attribution` and `decorate`
  compose onto the image.
- Tiles without CORS headers taint the canvas and make export impossible; that
  is reported through `onError`.
- GIFs use a fixed 252-colour palette (no frame-to-frame shimmer) with ordered
  dithering.

## Exports

| Export | Notes |
| --- | --- |
| `MapExportControl` | Button for `MapControlBar` |
| `captureMap`, `recordMapAnimation` | Still and animation as `Blob`s |
| `waitForMapIdle`, `readMapCanvas`, `downloadBlob` | Building blocks |
| `encodeGif` | The encoder, usable on any RGBA frames |
