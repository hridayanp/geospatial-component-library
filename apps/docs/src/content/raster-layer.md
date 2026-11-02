## Purpose

`RasterLayer` renders a single georeferenced raster band on a MapLibre map,
applying a configurable colour ramp and producing flicker-free transitions
between frames of a temporal sequence.

It is the package that consolidated six variable-specific weather components
into one. Those components differed only in the band they rendered and the ramp
they applied; both are props here, so no domain specialisation remains.

```bash
npm install @hridayanp/raster-layer @hridayanp/map-container maplibre-gl react
```

```tsx
<RasterLayer data={precipitation} colorScale={blues}  min={0}   max={120} />
<RasterLayer data={probability}   colorScale={plasma} min={0}   max={100} />
<RasterLayer data={temperature}   colorScale={rdylbu} min={-10} max={45} />
```

## Responsibilities

| Concern | Owner |
| --- | --- |
| Colourisation of band values into an RGBA image | `RasterLayer` |
| Source and layer lifecycle on the map | `RasterLayer` |
| Frame caching and buffer transitions | `RasterLayer` |
| GeoTIFF decoding, when `kind: 'geotiff'` | `RasterLayer`, via `raster-utils` |
| Retrieval, authorisation, prefetch scheduling | Host application |
| Reprojection to EPSG:4326 | Host application |

## Data model

`data` accepts three input forms, discriminated structurally.

### Georeferenced band

```tsx
<RasterLayer
  data={{
    data: values,              // Float32Array | Uint16Array | number[] | …
    width: 110,
    height: 96,
    bounds: [88, 22, 96, 29],  // [west, south, east, north], EPSG:4326
    noData: -9999,
    unit: 'mm',
  }}
/>
```

Two conventions are load-bearing:

- Values are **row-major with the northern row first**, matching image space and
  GeoTIFF row ordering. A grid assembled south-first renders vertically
  mirrored.
- `bounds` describes the **image edges**, not the centres of the outer cells. A
  10 × 10 grid at 1° resolution spans 10°, not 9°.

Cells equal to `noData`, and any `NaN`, render fully transparent and are
excluded from statistics.

### GeoTIFF or Cloud-Optimised GeoTIFF

```tsx
<RasterLayer
  data={{ kind: 'geotiff', source: signedUrl, resolution: 'overview', band: 0 }}
/>
```

`source` accepts a URL or an `ArrayBuffer`. With a URL, `geotiff` issues HTTP
range requests, so a Cloud-Optimised GeoTIFF transfers only the bytes for the
requested overview level.

| Field | Default | Behaviour |
| --- | --- | --- |
| `band` | `0` | Zero-based band index |
| `resolution` | `'overview'` | `'overview'`, `'full'`, or an explicit image index |
| `noData` | file's `GDAL_NODATA` tag | Overrides the file's own sentinel |

The library performs the decode; **the application determines how the URL was
authorised.** Requires the optional peer: `npm install geotiff`.

### Pre-rendered image

```tsx
<RasterLayer data={{ kind: 'image', url, bounds }} />
```

Placed on the map as supplied; `colorScale` is not applied. Appropriate when a
server has already rendered the tile, or when colourisation was performed in a
worker.

## Rendering model

The layer registers a MapLibre `image` source and a `raster` style layer. Band
values are colourised on the CPU into an RGBA image before upload; the resulting
texture is then sampled by the GPU during rendering.

Colourisation performs bilinear interpolation **in value space**, before the
colour ramp is applied, and maps the interpolated value through a precomputed
256-entry lookup table. The full pipeline is documented in
[`raster-utils`](/docs/raster-utils#colourisation).

### Double buffering

Updating a MapLibre `image` source in place initiates a 300 ms cross-fade by
default; replacing the source outright unmounts and remounts the style layer.
Both produce a visible discontinuity on every frame change.

The layer therefore maintains **two image sources permanently registered** and
inverts which one is opaque:

```tsx
setBuffers(current => ({ ...current, [inactive]: frame }));

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    setBuffers(current => ({ ...current, active: next }));  // invert opacity
  });
});
```

Two animation frames, not one: the first allows React to commit the new source,
the second allows MapLibre to complete the texture upload. Inverting earlier
exposes an unpopulated buffer.

Combined with `'raster-fade-duration': 0`, which disables MapLibre's own
cross-fade, the result is a hard cut with no intermediate blend.

Set `doubleBuffered={false}` to opt out; the layer then updates a single source
in place.

## Configuration

| Prop | Type | Default | Behaviour |
| --- | --- | --- | --- |
| `data` | `RasterLayerData \| null` | — | `null` renders nothing without unmounting |
| `id` | `string` | `'gcl-raster'` | Source and layer identifiers derive from this |
| `colorScale` | `ColorScaleInput` | `['#000000', '#ffffff']` | Colours, or `[value, colour]` stops |
| `min` / `max` | `number` | the frame's own range | See the warning below |
| `opacity` | `number` | `1` | Layer opacity |
| `visible` | `boolean` | `true` | `false` detaches the source but retains cached frames |
| `smoothFactor` | `number` | `6` | Output pixels synthesised per source cell |
| `smoothEdges` | `boolean` | `false` | Feathers the coverage boundary |
| `alphaFade` | `[number, number] \| null` | `[0.03, 0.09]` | Normalised band over which alpha ramps in; `null` for a hard edge |
| `clipBelow` / `clipAbove` | `number` | — | Values outside the range render transparent |
| `resampling` | `'linear' \| 'nearest'` | `'linear'` | GPU sampling; `'nearest'` preserves hard cell edges for classified data |
| `frameKey` | `string` | — | Cache identity; required for efficient temporal sequences |
| `doubleBuffered` | `boolean` | `true` | See above |
| `beforeId` | `string` | — | Registers the layer below an existing style layer |
| `cache` | `RasterFrameCache` | shared LRU | Supply an instance to control retention |
| `onFrame` | `(info: RasterFrameInfo) => void` | — | Fired once a frame is placed on the map |
| `onLoadingChange` | `(loading: boolean) => void` | — | Decode start and completion |
| `onError` | `(error: Error) => void` | — | Decode or colourisation failure |

`RasterFrameInfo` reports `{ bounds, domain, cached, durationMs }`.

> **Warning:** Without explicit `min` and `max`, each frame is normalised
> against its own value range. This is correct for a single static view and
> misleading across a temporal sequence: a low-magnitude frame consumes the full
> ramp, the sequence appears to pulse, and colour ceases to be comparable
> between frames.

## Temporal sequences

```tsx
import { RasterLayer, preloadRasterFrame } from '@hridayanp/raster-layer';

// Prefetching is a host responsibility, because retrieval is a host
// responsibility.
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

Frames are retained by `frameKey` in a bounded least-recently-used cache — 24
entries by default. Each entry holds a base64-encoded PNG, so an unbounded cache
over a long forecast run would consume hundreds of megabytes.

```ts
import { RasterFrameCache, defaultFrameCache } from '@hridayanp/raster-layer';

const cache = new RasterFrameCache(48);
<RasterLayer cache={cache} … />

defaultFrameCache.clear();
defaultFrameCache.resize(64);
```

The default instance is shared deliberately: a primary map and an inset showing
the same sequence colourise each frame once between them.

Decodes are cancellable. Advancing the sequence while a frame is decoding
discards the superseded result rather than allowing it to overwrite a newer
frame.

## The colourisation hook

```tsx
import { useRasterImage } from '@hridayanp/raster-layer';

const { frame, loading, error, fromCache } = useRasterImage(data, {
  colorScale, min, max, frameKey,
});
// frame: { url, bounds, domain } | null
```

Useful when the colourised image is required for something other than a MapLibre
layer — a canvas export, a thumbnail, or a deck.gl `BitmapLayer`.

## Performance considerations

- `smoothFactor` costs CPU **quadratically**. Output is capped at 1024 px on the
  longest edge regardless, so a large grid at a high factor cannot produce an
  unbounded canvas.
- Colourisation executes on the main thread. For large grids, colourise in a
  worker using [`raster-utils`](/docs/raster-utils) and supply the result as
  `{ kind: 'image' }`.
- Changing `colorScale` invalidates every cached frame, necessarily — the cache
  key incorporates the full style configuration.
- Decoding a COG overview rather than full resolution is the largest single
  lever when scrubbing a sequence.
- Prefer `visible={false}` to conditional unmounting for a frequently toggled
  layer; cached frames are retained.

## Geospatial considerations

- `bounds` is interpreted as EPSG:4326 and placed on the map's projection. **No
  reprojection is performed.** A raster in a projected CRS must be warped
  upstream, or streamed through the `cog://` protocol registered by
  [`map-container`](/docs/map-container#optional-protocols).
- One band is rendered at a time. Multi-band composites require one layer per
  band, or a pre-composed image.
- `{ kind: 'image' }` input is placed as supplied; the colour ramp does not
  apply.
- Extents crossing the antimeridian are not normalised by the layer.
