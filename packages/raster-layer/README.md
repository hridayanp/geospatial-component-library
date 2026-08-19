# @hridayanp/raster-layer

A generic, props-driven raster visualisation layer.

## Installation

```bash
npm install @hridayanp/raster-layer @hridayanp/map-container maplibre-gl react
```


## What it replaces

Per-variable raster layers — temperature, rainfall, probability, pressure —
differ only in their data and their colour ramp. Both are props here, so there
is nothing left to specialise. One component covers all of them.

## Usage

```tsx
<MapContainer center={[92, 25.5]} zoom={6}>
  <RasterLayer
    data={raster}
    colorScale={['#0b2545', '#f4d35e', '#c1121f']}
    min={0}
    max={100}
    opacity={0.8}
  />
</MapContainer>
```

## Data formats

```tsx
// 1. A numeric grid you already have
<RasterLayer data={{ data, width, height, bounds, noData: -9999 }} />

// 2. A GeoTIFF or COG to decode in the browser
<RasterLayer data={{ kind: 'geotiff', source: signedUrl, resolution: 'overview' }} />

// 3. An image you coloured elsewhere
<RasterLayer data={{ kind: 'image', url, bounds }} />
```

The library decodes; your application decides how a URL was authorised. There
is no API client, no signing and no retry policy in here.

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `data` | — | `null` renders nothing, without unmounting |
| `colorScale` | `['#000', '#fff']` | Colours, or `[value, colour]` stops |
| `min` / `max` | frame's own range | **Set these for animations** — otherwise each frame self-scales and colours stop being comparable |
| `opacity` | `1` | |
| `visible` | `true` | `false` keeps cached frames |
| `smoothFactor` | `6` | Output pixels per source cell |
| `smoothEdges` | `false` | Feathers the coverage boundary |
| `resampling` | `'linear'` | `'nearest'` preserves hard cell edges for classed data |
| `frameKey` | — | Cache identity; supply it for animated sequences |
| `beforeId` | — | Draw below an existing layer, e.g. to keep labels legible |
| `doubleBuffered` | `true` | See below |
| `onFrame` / `onLoadingChange` / `onError` | — | |

## Why two buffers

Updating a MapLibre `image` source in place makes it cross-fade over 300ms by
default; replacing the source outright unmounts and remounts the layer. Either
way the raster visibly flashes on every timeline step.

So the layer keeps two image sources permanently mounted and swaps which one is
opaque, after waiting two animation frames for the incoming texture to upload.
The result is a hard, blink-free cut between frames.

## Animated sequences

```tsx
import { RasterLayer, preloadRasterFrame } from '@hridayanp/raster-layer';

// Prefetching is the host's job, because retrieval is the host's job.
useEffect(() => {
  const next = frames[index + 1];
  if (next) void preloadRasterFrame(next.raster, { colorScale, min: 0, max: 100, frameKey: next.id });
}, [index]);

<RasterLayer data={frames[index].raster} frameKey={frames[index].id} min={0} max={100} />
```

Frames are cached by `frameKey` in a bounded LRU (24 entries by default —
every entry holds a PNG, so an unbounded cache over a long run would quietly
consume hundreds of megabytes). Pass your own `RasterFrameCache` to control
size and lifetime.

## Performance

- `smoothFactor` costs CPU quadratically; output is capped at 1024px per edge.
- Colourisation runs on the main thread. For very large grids, colourise in a
  worker with `@hridayanp/raster-utils` and pass `{ kind: 'image' }`.
- Changing the colour scale invalidates the frame cache, by necessity.

## Limitations

- One band at a time. Multi-band composites need a layer each, or a
  pre-composed image.
- `{ kind: 'image' }` data is placed as-is; `colorScale` does not apply to it.

## Documentation

Interactive examples for every prop live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
