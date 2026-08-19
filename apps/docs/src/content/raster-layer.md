One generic raster layer, driven entirely by props. It is the package that
replaced six near-identical per-variable components.

```bash
npm install @hridayanp/raster-layer @hridayanp/map-container maplibre-gl react
```

## What it replaces

Per-variable raster layers differ only in their data and their colour ramp. Both
are props here, so there is nothing left to specialise:

```tsx
<RasterLayer data={rainfall}    colorScale={blues}  min={0} max={120} />
<RasterLayer data={probability} colorScale={plasma} min={0} max={100} />
<RasterLayer data={temperature} colorScale={rdylbu} min={-10} max={45} />
```

## Data formats

`data` accepts three shapes.

### A numeric grid you already have

```tsx
<RasterLayer
  data={{
    data: values,              // Float32Array | Uint16Array | number[] | …
    width: 110,
    height: 96,
    bounds: [88, 22, 96, 29],  // [west, south, east, north] — image EDGES
    noData: -9999,
    unit: 'mm',
  }}
/>
```

Row-major, **north row first** — matching image space and GeoTIFF row order.
`bounds` describes the image edges, not the outer pixel centres.

### A GeoTIFF or COG to decode in the browser

```tsx
<RasterLayer
  data={{ kind: 'geotiff', source: signedUrl, resolution: 'overview' }}
/>
```

`source` is a URL or an `ArrayBuffer`. With a URL, `geotiff` uses HTTP range
requests, so a Cloud-Optimised GeoTIFF only transfers the overview you asked
for.

The library decodes; **your application decides how the URL was authorised.**
There is no signing, no refresh and no retry policy in here.

Requires the optional peer: `npm install geotiff`.

### An image you coloured elsewhere

```tsx
<RasterLayer data={{ kind: 'image', url, bounds }} />
```

Placed as-is; `colorScale` does not apply. Use this when a server already
rendered the tile, or when you colourised in a worker.

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `data` | — | `null` renders nothing, without unmounting |
| `colorScale` | `['#000','#fff']` | Colours, or `[value, colour]` stops |
| `min` / `max` | frame's own range | **Set these for animations** — see below |
| `opacity` | `1` | |
| `visible` | `true` | `false` keeps cached frames |
| `smoothFactor` | `6` | Output pixels synthesised per source cell |
| `smoothEdges` | `false` | Feathers the coverage boundary |
| `alphaFade` | `[0.03, 0.09]` | Normalised band where alpha ramps in; `null` for a hard edge |
| `clipBelow` / `clipAbove` | — | Values outside render transparent |
| `resampling` | `'linear'` | `'nearest'` preserves hard cell edges for classed data |
| `frameKey` | — | Cache identity; supply it for animated sequences |
| `doubleBuffered` | `true` | See below |
| `beforeId` | — | Draw below an existing layer, e.g. to keep labels legible |
| `cache` | shared LRU | Pass your own `RasterFrameCache` |
| `onFrame` | — | `(info) => void` once a frame is on the map |
| `onLoadingChange` / `onError` | — | |

> **Warning:** Without an explicit `min` and `max`, each frame self-scales to
> its own range. Fine for a single view; misleading across an animation, because
> a quiet frame will use the whole ramp and the sequence appears to pulse.

## Why two buffers

Updating a MapLibre `image` source in place makes it cross-fade over 300 ms by
default. Replacing the source outright unmounts and remounts the layer. Either
way the raster visibly flashes on every timeline step.

So the layer keeps **two image sources permanently mounted** and swaps which one
is opaque:

```tsx
setBuffers(current => ({ ...current, [inactive]: frame }));

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    setBuffers(current => ({ ...current, active: next }));  // flip opacity
  });
});
```

Two frames, not one: the first lets React commit the new source, the second lets
MapLibre finish uploading the texture. Flip sooner and you see a blank buffer.

Combined with `'raster-fade-duration': 0` — disabling MapLibre's own cross-fade,
which fights the manual swap — the result is a hard, flash-free cut.

## Animated sequences

```tsx
import { RasterLayer, preloadRasterFrame } from '@hridayanp/raster-layer';

// Prefetching is the host's job, because retrieval is the host's job.
useEffect(() => {
  const next = frames[index + 1];
  if (!next) return;
  void preloadRasterFrame(next.raster, {
    colorScale: palette,
    min: 0,
    max: 100,
    frameKey: next.id,
  });
}, [index]);

<RasterLayer
  data={frames[index].raster}
  frameKey={frames[index].id}
  colorScale={palette}
  min={0}
  max={100}
/>
```

Frames are cached by `frameKey` in a bounded LRU — 24 entries by default. Each
entry holds a base64 PNG, so an unbounded cache over a long forecast run would
quietly consume hundreds of megabytes.

```ts
import { RasterFrameCache, defaultFrameCache } from '@hridayanp/raster-layer';

const cache = new RasterFrameCache(48);
<RasterLayer cache={cache} … />

defaultFrameCache.clear();   // the shared instance
```

The default instance is shared deliberately: a main map and an inset showing the
same frames decode each frame once between them.

## The hook

```tsx
import { useRasterImage } from '@hridayanp/raster-layer';

const { frame, loading, error, fromCache } = useRasterImage(data, {
  colorScale, min, max, frameKey,
});
// frame: { url, bounds, domain } | null
```

Useful when you want the coloured image for something other than a MapLibre
layer — a canvas export, a thumbnail, a deck.gl `BitmapLayer`.

## Performance

- `smoothFactor` costs CPU **quadratically**. Output is capped at 1024 px on the
  longest edge regardless, so a large grid at a high factor cannot blow up.
- Colourisation runs on the main thread. For very large grids, colourise in a
  worker with [`raster-utils`](/docs/raster-utils) and pass `{ kind: 'image' }`.
- Changing the colour scale invalidates the whole frame cache, necessarily.
- Decodes are cancellable: advancing the timeline while a frame is decoding
  discards the stale result rather than letting it overwrite a newer one.

## Limitations

- One band at a time. Multi-band composites need a layer each, or a pre-composed
  image.
- `{ kind: 'image' }` data is placed as-is; the colour scale does not apply.
- No reprojection. The raster's `bounds` are interpreted as WGS84 and placed on
  the map's projection.
