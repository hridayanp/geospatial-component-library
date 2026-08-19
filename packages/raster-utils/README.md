# @hridayanp/raster-utils

Raster processing with no React and no map: statistics, colour ramps,
colourisation, value sampling and GeoTIFF/COG decoding.

## Installation

```bash
npm install @hridayanp/raster-utils
```


`geotiff` is an **optional** peer dependency, loaded lazily. Install it only if
you call `decodeGeoTIFF`:

```bash
npm install geotiff
```

## Why this is a separate package

Everything here is a plain function over plain data. That means it runs in a web
worker, unit-tests without a browser, and can be reused by a renderer that has
nothing to do with this library. Keeping it out of the React packages is what
makes offloading colourisation to a worker a five-line change rather than a
rewrite.

## Data format

```ts
interface RasterData {
  data: Float32Array | Uint16Array | number[] | ...;  // row-major, north first
  width: number;
  height: number;
  bounds: [west, south, east, north];                  // image edges, not centres
  noData?: number | null;
  unit?: string;
}
```

## Colourisation

```ts
import { rasterToImageData, rasterToDataUrl, rasterToBitmap } from '@hridayanp/raster-utils';

const { url, bounds, domain } = rasterToDataUrl(raster, {
  colorScale: ['#0b2545', '#f4d35e', '#c1121f'],
  min: 0,
  max: 100,
  smoothFactor: 6,
  smoothEdges: true,
});
```

### How it works, and why

Model grids are coarse. Drawing one output pixel per source cell and then
blurring the *coloured* result still reads as hard patchy blocks, because the
colour was locked in before the blur ran.

So the raw **numeric values** are bilinearly interpolated between neighbouring
cells first, and only then mapped through the colour ramp — via a precomputed
256-entry LUT, because calling a colour library once per megapixel is the single
biggest cost in the render path.

Alpha gets the same treatment: a smooth ramp near the bottom of the range rather
than a hard cutoff, and a partial-coverage fade at the ragged edge of the valid
region, so the raster dissolves into transparency instead of showing a
rectangular outline.

| Option | Default | Effect |
| --- | --- | --- |
| `smoothFactor` | `1` | Output pixels synthesised per source cell |
| `smoothEdges` | `false` | Extra Gaussian pass that only reduces alpha |
| `alphaFade` | `[0.03, 0.09]` | Normalised band where alpha ramps in; `null` disables |
| `maxDimension` | `1024` | Hard cap on the longest output edge |
| `clipBelow` / `clipAbove` | — | Values outside render transparent |

`smoothFactor` costs CPU quadratically. The `maxDimension` cap is what stops a
large grid and a high factor from producing a multi-megapixel canvas.

## Colour ramps

```ts
import {
  buildColorLut,
  colorAt,
  colorScaleToCss,
  resolveColorScale,
  sampleColorScale,
} from '@hridayanp/raster-utils';
```

A ramp is an array of colours (spread evenly) or explicit `[value, colour]`
stops. `mode: 'discrete'` snaps to the nearest stop below the value, producing
classed bands rather than a gradient.

## Statistics and sampling

```ts
import { computeRasterStats, sampleRaster, normalizeRaster } from '@hridayanp/raster-utils';

computeRasterStats(raster.data, raster.noData);   // min, max, mean, validCount
sampleRaster(raster, [92, 25.5], 'bilinear');     // { value, column, row }
```

NoData and `NaN` are excluded everywhere. A fully-empty band falls back to a
`0..1` range rather than `Infinity`, so downstream normalisation stays finite.
Sampling off the edge returns `value: null` instead of throwing — hovering off
the data is normal.

## GeoTIFF and COG

```ts
import { decodeGeoTIFF, decodeGeoTIFFBands } from '@hridayanp/raster-utils';

const raster = await decodeGeoTIFF(signedUrl, { resolution: 'overview' });
const [u, v] = await decodeGeoTIFFBands(buffer, [0, 1]);
```

With a URL, `geotiff` uses HTTP range requests, so a Cloud-Optimised GeoTIFF
only transfers the overview you asked for. Reading the smallest overview by
default turns a multi-megabyte decode into a few hundred kilobytes — the single
biggest lever when scrubbing a time series.

**The library decodes; it never decides how the URL was authorised.** Pass a
URL your application has already signed, or an `ArrayBuffer` you fetched.

## Documentation

Interactive examples for every prop live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
