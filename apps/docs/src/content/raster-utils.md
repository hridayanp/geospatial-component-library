## Purpose

`raster-utils` is the computational half of raster visualisation: band
statistics, colour-ramp resolution, colourisation, value sampling and
GeoTIFF/COG decoding.

It contains no React and no map dependency. Every export is a function over
plain data.

```bash
npm install @hridayanp/raster-utils
```

`geotiff` is an **optional** peer, imported dynamically. Install it only when
decoding GeoTIFFs in the browser:

```bash
npm install geotiff
```

## Why it is a separate package

Because everything here is a pure function over typed arrays, it executes in a
**web worker**, is testable without a browser, and is reusable by a renderer
unrelated to this library.

Keeping it outside the React packages makes moving colourisation off the main
thread a small, local change:

```ts
// worker.ts
import { rasterToImageData } from '@hridayanp/raster-utils';

self.onmessage = (e) => {
  const image = rasterToImageData(e.data.raster, e.data.options);
  self.postMessage(image, [image.pixels.buffer]);
};
```

```tsx
// component
const { url, bounds } = await colouriseInWorker(raster, options);
<RasterLayer data={{ kind: 'image', url, bounds }} />
```

## Data model

```ts
interface RasterData {
  data: RasterArray;                  // row-major, northern row first
  width: number;
  height: number;
  bounds: Bounds;                     // [west, south, east, north], image EDGES
  noData?: number | null;
  unit?: string;
}
```

`RasterArray` covers every typed-array shape a decoded band realistically
arrives in — `Float32Array`, `Float64Array`, the signed and unsigned integer
arrays, and `number[]`.

Two conventions govern every function in the package:

- **Northern row first.** Index `0` is the top-left cell, matching image space
  and GeoTIFF row ordering. A grid assembled south-first renders vertically
  mirrored.
- **`bounds` describes image edges**, not the centres of the outer cells. A
  10 × 10 grid at 1° resolution spans 10°, not 9°.

Cells equal to `noData`, and any `NaN`, are excluded from statistics and
rendered fully transparent.

## Colourisation

```ts
import {
  rasterToImageData,   // → ColorizedRaster { pixels, width, height, bounds, domain }
  rasterToDataUrl,     // → { url, bounds, domain }   (requires a DOM)
  rasterToBitmap,      // → ImageBitmap               (worker-compatible)
  drawColorizedRaster, // ColorizedRaster → HTMLCanvasElement
} from '@hridayanp/raster-utils';

const { url, bounds, domain } = rasterToDataUrl(raster, {
  colorScale: ['#0b2545', '#f4d35e', '#c1121f'],
  min: 0,
  max: 100,
  smoothFactor: 6,
  smoothEdges: true,
});
```

`rasterToDataUrl` requires a DOM; in a worker use `rasterToImageData` with
`rasterToBitmap`.

### `ColorizeOptions`

| Option | Default | Effect |
| --- | --- | --- |
| `colorScale` | — (required) | Colours, or `[value, colour]` stops |
| `min` / `max` | the raster's own range | Explicit value domain |
| `opacity` | `1` | Global alpha multiplier |
| `smoothFactor` | `1` | Output pixels synthesised per source cell |
| `smoothEdges` | `false` | Additional pass that only reduces alpha |
| `alphaFade` | `[0.03, 0.09]` | Normalised band over which alpha ramps in; `null` disables |
| `maxDimension` | `1024` | Hard cap on the longest output edge |
| `clipBelow` / `clipAbove` | — | Values outside the range render transparent |

### Interpolate values, then apply colour

Model grids are coarse relative to display resolution. Rendering one output
pixel per source cell and blurring the result still reads as a soft mosaic,
because colour was assigned before the blur was applied.

The pipeline therefore bilinearly interpolates the **raw band values** between
neighbouring cells first, and maps only the interpolated value through the ramp.
The resulting gradient represents a gradient in the data rather than a smear in
the image.

### The 256-entry lookup table

Colour libraries are expensive per invocation — parsing, interpolation in a
perceptual colour space, clamping. Calling one per output pixel on a
1024 × 1024 image is over a million invocations.

The ramp is instead evaluated `DEFAULT_LUT_SIZE` (256) times into a flat
`Uint8Array`, and each pixel becomes an index lookup:

```ts
const index = Math.round(normalised * 255);
r = lut[index * 3];
g = lut[index * 3 + 1];
b = lut[index * 3 + 2];
```

This is the largest single cost reduction in the render path, and 256 steps sit
below the perceptual discrimination threshold for a continuous ramp.

### Alpha and coverage edges

A hard alpha cutoff at the bottom of the domain produces a visible contour where
nothing meaningful changes. `alphaFade` applies a `smoothstep` ramp across a
normalised band instead, so near-threshold values dissolve rather than
terminate.

Separately, `smoothEdges` feathers the **coverage boundary** — the ragged
outline of the valid-data region. Without it, a raster displays its own
rectangular data extent as a crisp edge, which reads as a rendering artefact
rather than as a data boundary.

The feather can only ever reduce alpha (`min(centre, feathered)`), so it cannot
make transparent NoData regions partially opaque.

## Colour ramps

```ts
import {
  buildColorLut,
  colorAt,
  colorScaleColors,
  colorScaleToCss,
  resolveColorScale,
  sampleColorScale,
  toRgba,
  DEFAULT_LUT_SIZE,
} from '@hridayanp/raster-utils';

resolveColorScale(input);              // ColorScaleInput → ColorScale
colorAt(['#000', '#fff'], 0.5);        // colour at a normalised position
colorScaleToCss(scale);                // → 'linear-gradient(…)'
toRgba('#38bdf8', 0.8);                // → [r, g, b, a]
```

A `ColorScaleInput` is an array of colours (distributed evenly), an array of
`[position, colour]` stops, or a fully resolved `ColorScale`:

```ts
interface ColorScale {
  stops: Array<[position: number, color: string]>;  // positions normalised to 0..1
  mode: 'continuous' | 'discrete';
  interpolation: 'rgb' | 'lab' | 'lch' | 'hsl';
}
```

`mode: 'discrete'` snaps to the nearest stop **below** the value, producing
classified bands rather than a gradient. This should agree with the `mode`
supplied to [`geo-legend`](/docs/geo-legend#rendering-model); a classified
raster keyed with a gradient misrepresents the data.

## Statistics and normalisation

```ts
import {
  computeRasterStats,
  isValidValue,
  normalizeRaster,
  normalizeValue,
  resolveDomain,
  smoothstep,
} from '@hridayanp/raster-utils';

computeRasterStats(raster.data, raster.noData);
// { min, max, mean, validCount, totalCount }
```

`mean` is `null` when no valid cells exist. A fully empty band resolves to a
`0..1` domain rather than `[Infinity, -Infinity]`, so downstream normalisation
remains finite instead of producing `NaN` pixels.

## Sampling

```ts
import {
  sampleRaster,
  sampleRasterAt,
  lngLatToRasterXY,
  rasterXYToLngLat,
} from '@hridayanp/raster-utils';

sampleRaster(raster, [92, 25.5], 'bilinear');
// { value, column, row }

lngLatToRasterXY(bounds, width, height, [92, 25.5]);  // fractional grid coordinates
rasterXYToLngLat(bounds, width, height, col, row);    // cell CENTRE coordinate
```

`'nearest'` returns the exact cell value — correct for categorical data and for
readouts where an actual measurement is expected. `'bilinear'` interpolates the
four surrounding cells, matching what the smoothed rendering displays.

Positions outside the extent, and cells holding NoData, return `value: null`
rather than raising. Bilinear sampling skips NoData neighbours rather than
averaging the sentinel, which would otherwise pull results toward `-9999`.

## GeoTIFF and Cloud-Optimised GeoTIFF

```ts
import { decodeGeoTIFF, decodeGeoTIFFBands } from '@hridayanp/raster-utils';

const raster = await decodeGeoTIFF(signedUrl, { resolution: 'overview' });
const [u, v] = await decodeGeoTIFFBands(buffer, [0, 1]);
```

| Option | Default | Behaviour |
| --- | --- | --- |
| `band` | `0` | Zero-based band index |
| `resolution` | `'overview'` | `'overview'`, `'full'`, or an explicit image index |
| `noData` | the file's `GDAL_NODATA` tag, falling back to `-9999` | Sentinel override |
| `unit` | — | Unit label carried onto the returned `RasterData` |
| `readOptions` | — | Passed through to `geotiff`'s reader, e.g. for custom fetch headers |

With a URL, `geotiff` issues **HTTP range requests**, so a Cloud-Optimised
GeoTIFF transfers only the bytes constituting the requested overview level.
Defaulting to the smallest overview converts a multi-megabyte full-resolution
decode into a few hundred kilobytes — the largest single lever when scrubbing a
temporal sequence, where a frame is decoded every few hundred milliseconds.

Extents are derived from the file's `ModelTiepoint` and `ModelPixelScale` tags.

> **Warning:** The library performs the decode; it does not determine how the
> URL was authorised. Supply a URL the application has already authorised, or an
> `ArrayBuffer` it fetched. Credential lifecycle, refresh and retry policy
> remain with the host, by design — see
> [Design Principles](/docs/principles).

## Geospatial considerations

`decodeGeoTIFF` reads the georeferencing tags as recorded and performs **no
reprojection**. A file in a projected CRS yields an extent in that CRS's units,
which will not register correctly against a WGS84 map.

Two remedies:

- Warp the source to EPSG:4326 upstream, in the processing pipeline.
- Use the `cog://` protocol registered by
  [`map-container`](/docs/map-container#optional-protocols) and let MapLibre
  handle tiling and placement, accepting that the colour ramp is then the
  file's own rather than the application's.

Rotated or sheared georeferencing (a non-axis-aligned `ModelTransformation`) is
not supported; the decoder assumes an axis-aligned pixel grid.
