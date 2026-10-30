## Purpose

`data-tile-layer` renders a tiled data field — model output, a reanalysis, an
elevation model — delivered as **value-encoded** image tiles, and colours it in
the browser.

```bash
npm install @hridayanp/data-tile-layer @hridayanp/map-container maplibre-gl react
```

```tsx
<DataTileLayer
  tiles="https://tiles.example.internal/t2m/2026103000/f012/{z}/{x}/{y}.png"
  encoding={{ format: 'uint16', scale: 0.01, offset: -100 }}
  colorScale={palette}
  min={-10}
  max={45}
  frameKey="t2m-2026103000-f012"
/>
```

## Why tiles carry numbers

A pre-coloured tile fixes the ramp at the server and loses the value: changing
the ramp means re-rendering every tile, and hover can only guess a value back
from a colour. A value-encoded tile is decoded **once** into a `Float32Array`
and cached. Changing `colorScale`, `min` or `max` recolours from the cache with
no new requests, and the value under the pointer is exact.

## Encoding contract

| `format` | Decoding |
| --- | --- |
| `'uint16'` (default) | `raw = R × 256 + G`, then `value = raw × scale + offset` |
| `'uint8'` | `raw = R`, then `value = raw × scale + offset` |
| `'terrarium'` | `R × 256 + G + B / 256 − 32768` |
| `'terrain-rgb'` | `−10000 + (R × 65536 + G × 256 + B) × 0.1` |

Alpha `0` is always NoData; `noData` additionally names a raw integer that means
NoData. `decodeTilePixels` and its inverse `encodeTileValues` are exported, so a
tile pipeline can be tested against exactly the numbers the layer will see.
Images are decoded with `premultiplyAlpha: 'none'` and
`colorSpaceConversion: 'none'`; without those flags a browser may silently
change the encoded bytes.

## Where tiles come from

| Prop | Behaviour |
| --- | --- |
| `tiles` | `{z}/{x}/{y}` template(s), fetched with `fetch`. 404 and 204 mean "no tile". Supply a URL the host has already authorised — the layer holds no credentials and no retry policy |
| `loadTile` | `({ z, x, y }, signal) => Promise<…>`. Takes precedence. Resolve `ImageData`, `ImageBitmap`, an image, a `Blob`, an `ArrayBuffer`, decoded `{ values, width, height }`, or `null` |

Use `loadTile` for an authenticated endpoint, a worker, or tiles generated
client-side. Returning decoded values skips image decoding entirely.

## Difference

```tsx
<DataTileLayer
  loadTile={runA}
  subtract={{ loadTile: runB }}
  colorScale={divergingRamp}
  min={-5}
  max={5}
/>
```

`subtract` takes a second source with its own `tiles`, `loadTile` and `encoding`;
the layer renders `A − B` cell by cell. A tile missing from either side renders
empty.

## Range and caching

`min` and `max` are **required**. A single raster has a global minimum; a tiled
field does not, and per-tile scaling would make every tile edge a colour seam.

Decoded tiles are held in an LRU cache per source (`cacheSize`, default 256).
The cache is cleared when `frameKey` changes — pass the run and lead time — or,
without `frameKey`, when `tiles`, `loadTile`, `subtract` or `encoding` change
identity. **Memoise `loadTile`** if you do not pass `frameKey`.

## Sampling

`onHoverValue` reports `{ lngLat, value, tileZoom, point }` from the decoded
cache as the pointer moves, and `null` on leave. Through a ref,
`sample(lngLat)` reads the same cache imperatively and `reload()` drops it.
Sampling never triggers a request; a position no loaded tile covers returns
`null`.

## Props

| Prop | Type | Default |
| --- | --- | --- |
| `tiles` / `loadTile` / `encoding` | see above | — / — / `{ format: 'uint16' }` |
| `colorScale` | `ColorScaleInput` | — (required) |
| `min` / `max` | `number` | — (required) |
| `clipBelow` / `clipAbove` | `number` | — |
| `subtract` | `DataTileSourceInput \| null` | — |
| `frameKey` | `string` | — |
| `tileSize` | `number` | `256` |
| `minZoom` / `maxZoom` | `number` | `0` / `10` |
| `bounds` / `attribution` | | — |
| `resampling` | `'nearest' \| 'linear'` | `'linear'` |
| `opacity` | `number` | `1` |
| `cacheSize` | `number` | `256` |
| `onHoverValue` / `onError` | | — |
| `id`, `visible`, `beforeId` | | |

## How it works

Each mounted layer registers its own MapLibre protocol. The raster source points
at `gcl-data-…://{z}/{x}/{y}`; the protocol handler loads (or reuses) the decoded
values, colourises them through the same `rasterToImageData` path as
`RasterLayer`, and returns a PNG. A restyle points the live source at a new
cache-busting URL with `setTiles`, so the source is never removed and re-added.
