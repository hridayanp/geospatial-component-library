Raster processing with no React and no map: statistics, colour ramps,
colourisation, value sampling and GeoTIFF/COG decoding.

```bash
npm install @hridayanp/raster-utils
```

`geotiff` is an **optional** peer, loaded lazily. Install it only if you call
`decodeGeoTIFF`:

```bash
npm install geotiff
```

## Why it is a separate package

Everything here is a plain function over plain data. No hooks, no context, no
DOM.

That means it runs in a **web worker**, unit-tests without a browser, and can be
reused by a renderer that has nothing to do with this library. Keeping it out of
the React packages is what makes "colourise off the main thread" a five-line
change rather than a rewrite:

```ts
// worker.ts
import { rasterToDataUrl } from '@hridayanp/raster-utils';

self.onmessage = (e) => {
  self.postMessage(rasterToDataUrl(e.data.raster, e.data.options));
};
```

```tsx
// component
const { url, bounds } = await colouriseInWorker(raster, options);
<RasterLayer data={{ kind: 'image', url, bounds }} />
```

## The data format

```ts
interface RasterData {
  data: Float32Array | Uint16Array | number[] | …;   // row-major, north row first
  width: number;
  height: number;
  bounds: [west, south, east, north];                 // image EDGES, not centres
  noData?: number | null;
  unit?: string;
}
```

Two conventions worth internalising, because everything downstream assumes them:

- **North row first.** Index `0` is the top-left cell — matching image space and
  GeoTIFF row order. A grid built south-first renders vertically mirrored.
- **`bounds` are the image edges.** Not the centres of the outer cells. A 10×10
  grid on a 1° step spans 10°, not 9°.

## Colourisation

```ts
import {
  rasterToImageData,   // → ImageData
  rasterToDataUrl,     // → { url, bounds, domain }
  rasterToBitmap,      // → ImageBitmap (worker-friendly)
} from '@hridayanp/raster-utils';

const { url, bounds, domain } = rasterToDataUrl(raster, {
  colorScale: ['#0b2545', '#f4d35e', '#c1121f'],
  min: 0,
  max: 100,
  smoothFactor: 6,
  smoothEdges: true,
});
```

| Option | Default | Effect |
| --- | --- | --- |
| `colorScale` | `['#000','#fff']` | Colours, or `[value, colour]` stops |
| `min` / `max` | data range | Explicit domain |
| `mode` | `'continuous'` | `'discrete'` snaps to the stop below |
| `smoothFactor` | `1` | Output pixels synthesised per source cell |
| `smoothEdges` | `false` | Extra pass that only reduces alpha |
| `alphaFade` | `[0.03, 0.09]` | Normalised band where alpha ramps in; `null` disables |
| `clipBelow` / `clipAbove` | — | Values outside render transparent |
| `globalAlpha` | `1` | Multiplies the whole image |
| `maxDimension` | `1024` | Hard cap on the longest output edge |

### Interpolate values, then colour — not the reverse

Model grids are coarse. The obvious approach — one output pixel per source cell,
then blur the result — still reads as hard patchy blocks, because the colour was
locked in **before** the blur ran. Blurring a mosaic gives you a soft mosaic.

So the raw **numeric values** are bilinearly interpolated between neighbouring
cells first, and only the interpolated value is mapped through the ramp. The
gradient you see is a gradient in the data, not a smudge in the image.

### The 256-entry LUT

Colour libraries are expensive per call — parsing, interpolating in Lab space,
clamping. Calling one once per output pixel on a 1024×1024 image is a million
calls.

The ramp is instead evaluated **256 times** into a flat `Uint8Array`, and every
pixel becomes an index lookup:

```ts
const index = Math.round(normalised * 255);
r = lut[index * 3];
g = lut[index * 3 + 1];
b = lut[index * 3 + 2];
```

This is the single biggest cost reduction in the render path, and 256 steps is
below the discrimination threshold for a continuous ramp anyway.

### Alpha, and why the edges matter

A hard alpha cutoff at the bottom of the range produces a visible contour where
nothing meaningful changes. `alphaFade` gives a `smoothstep` ramp across a
normalised band instead, so near-zero values dissolve rather than terminate.

Separately, `smoothEdges` feathers the **coverage** boundary — the ragged
outline of the valid region. Without it a raster shows its own rectangular data
extent as a crisp edge, which reads as a rendering artefact.

The feather can only ever **reduce** alpha (`min(centre, feathered)`), so it can
never make transparent NoData areas partly opaque.

## Colour ramps

```ts
import {
  buildColorLut,
  colorAt,
  colorScaleToCss,
  resolveColorScale,
  sampleColorScale,
  PALETTES,
} from '@hridayanp/raster-utils';

colorAt(['#000', '#fff'], 0.5);                  // '#7f7f7f'
colorScaleToCss(PALETTES.heat);                  // 'linear-gradient(...)'
resolveColorScale(PALETTES.heat, 0, 100);        // [[0,'#…'], … ] normalised stops
```

A ramp is an array of colours (spread evenly across the domain) or explicit
`[value, colour]` stops. `mode: 'discrete'` snaps to the nearest stop **below**
the value, producing classed bands rather than a gradient.

## Statistics and sampling

```ts
import {
  computeRasterStats,
  sampleRaster,
  normalizeRaster,
} from '@hridayanp/raster-utils';

computeRasterStats(raster.data, raster.noData);
// { min, max, mean, validCount }

sampleRaster(raster, [92, 25.5], 'bilinear');
// { value, column, row }
```

NoData and `NaN` are excluded everywhere. Three behaviours worth knowing:

- A fully empty band falls back to a `0..1` range rather than
  `[Infinity, -Infinity]`, so downstream normalisation stays finite instead of
  producing `NaN` pixels.
- Sampling outside the bounds returns `value: null` rather than throwing —
  hovering off the data is completely normal, not an error.
- `'bilinear'` sampling skips NoData neighbours rather than averaging the
  sentinel in, which would drag values toward `-9999`.

## GeoTIFF and COG

```ts
import { decodeGeoTIFF, decodeGeoTIFFBands } from '@hridayanp/raster-utils';

const raster = await decodeGeoTIFF(signedUrl, { resolution: 'overview' });
const [u, v] = await decodeGeoTIFFBands(buffer, [0, 1]);
```

| `resolution` | Reads |
| --- | --- |
| `'overview'` (default) | The smallest overview level present |
| `'full'` | Full resolution |
| a number | The overview closest to that width |

With a URL, `geotiff` uses **HTTP range requests**, so a Cloud-Optimised GeoTIFF
transfers only the bytes for the level you asked for. Defaulting to the smallest
overview turns a multi-megabyte decode into a few hundred kilobytes — the single
biggest lever when scrubbing a time series, where you decode a frame every few
hundred milliseconds.

Bounds come from the file's `ModelTiepoint`/`ModelPixelScale` tags, and the
NoData value from `GDAL_NODATA` when present.

> **Warning:** The library decodes; it never decides how the URL was authorised.
> Pass a URL your application has already signed, or an `ArrayBuffer` you
> fetched. There is no credential handling, refresh or retry policy in here — by
> design, per [Design Principles](/docs/principles).

## Non-WGS84 files

`decodeGeoTIFF` reads the georeferencing tags as-is and does **not** reproject.
A file in a projected CRS yields bounds in that CRS's units, which will not sit
correctly on a WGS84 map.

Reproject upstream, or use the `cog://` protocol from
[`map-container`](/docs/map-container#optional-protocols) and let MapLibre
handle placement.
