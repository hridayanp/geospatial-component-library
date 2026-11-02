## Purpose

`contour-layer` traces isolines through a raster — isobars from pressure,
isotherms from temperature, isohyets from rainfall — and draws them with
MapLibre, thicker and labelled on the index contours.

```bash
npm install @hridayanp/contour-layer @hridayanp/map-container maplibre-gl react
```

```tsx
<MapContainer center={[80, 20]} zoom={4}>
  <ContourLayer data={mslp} interval={4} base={1000} majorEvery={5} />
</MapContainer>
```

The tracing is a pure function, `computeContours`, from `RasterData` to GeoJSON.
The component calls it and hands the result to an ordinary GeoJSON source, so
pan and zoom cost nothing and a new frame replaces the data in place.

## Levels

| Option | Meaning |
| --- | --- |
| `levels` | Explicit values. Wins over everything else — use it for thresholds with meaning |
| `interval` | Spacing in data units, e.g. `4` hPa |
| `base` | A value every contour series passes through. Default `0`; isobars use `1000` |
| `count` | Approximate number of levels when no `interval` is given, rounded to a 1–2–5 step |
| `min` / `max` | Clip the contoured range. Default the raster's own range |

Levels are generated outward from `base`, so they land on round numbers whatever
the data range happens to start at: an `interval` of 4 through 1000 gives
996, 1000, 1004 — never 997.3. Floating-point drift is rounded away so
`0.30000000000000004` never reaches a label.

Every `majorEvery`-th level (default 5), counted from `base`, is flagged
`major: true`. With regular levels that means 1000, 1020, 1040 hPa — not
whichever level happened to come first.

## Geometry

Marching squares runs through **cell centres**. A line therefore never extends
past the outermost data, and a cell with any NoData corner is skipped — a gap
in the data is a gap in the contours, not an invented line across it. Saddle
cells are resolved with the cell-centre average, the standard disambiguation.

Segments are stitched into continuous lines, which are flagged `closed` when
they meet themselves. `smoothing` applies that many Chaikin corner-cutting
passes (default 2), keeping open-line endpoints fixed; `minVertices` (default 3)
drops the scatter of tiny rings a noisy field produces.

## Properties on each feature

| Property | Type | Meaning |
| --- | --- | --- |
| `value` | `number` | The contour value |
| `level` | `number` | Index into the ascending level list |
| `major` | `boolean` | Index contour |
| `closed` | `boolean` | The line forms a ring |
| `label` | `string` | Added by the component, from `formatLabel` |
| `color` | `string` | Added by the component, from `color` or `colorScale` |

## `ContourLayer` props

| Prop | Type | Default |
| --- | --- | --- |
| `data` | `RasterData \| null` | — |
| `levels`, `interval`, `base`, `count`, `min`, `max` | see above | — |
| `smoothing` | `number` | `2` |
| `minVertices` | `number` | `3` |
| `majorEvery` | `number` | `5` |
| `color` | `string` | `'#e2e8f0'` |
| `colorScale` | `ColorScaleInput` | — colours each level by value |
| `width` / `majorWidth` | `number` | `1` / `2` |
| `opacity` | `number` | `0.9` |
| `dasharray` | `number[]` | — |
| `labels` | `boolean` | `true` |
| `labelAll` | `boolean` | `false` — label index contours only |
| `formatLabel` | `(value) => string` | trimmed value |
| `labelSize`, `labelColor`, `labelHaloColor`, `labelFont` | | |
| `id`, `visible`, `beforeId`, `minZoom`, `maxZoom` | | |

## Labels and glyphs

MapLibre can only draw text when the style declares a `glyphs` URL. The
library's blank default style has none, by design — it makes no request the
host did not ask for. On such a style the label sub-layer is simply not added;
the lines still render. The check is repeated after every basemap switch.

## Without a map

```ts
import { computeContours } from '@hridayanp/contour-layer';

const isobars = computeContours(mslp, { interval: 4, base: 1000 });
// → GeoJSON FeatureCollection of LineStrings, ready for VectorLayer, a worker
//   postMessage, or a GeoJSON download.
```

`contourLevels(domain, options)` exposes the level generation on its own.
