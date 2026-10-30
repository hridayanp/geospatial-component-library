## Purpose

`wind-barb-layer` draws WMO wind barbs, or direction arrows, from a gridded
`u`/`v` field or from point observations — as a plain MapLibre symbol layer,
with no deck.gl.

```bash
npm install @hridayanp/wind-barb-layer @hridayanp/map-container maplibre-gl react
```

```tsx
<WindBarbLayer data={{ kind: 'field', u, v, width, height, bounds }} unit="m/s" maxBarbs={600} />
```

## Data

The layer accepts the same two shapes as
[`wind-particle-layer`](/docs/wind-particle-layer), structurally — one object
can drive particles and barbs at once — without importing that package:

| `kind` | Fields |
| --- | --- |
| `'field'` | `u`, `v` (eastward, northward), `width`, `height`, `bounds`, `noData?` — row 0 is north |
| `'points'` | `data` (GeoJSON), `speedProperty?`, `directionProperty?`, `directionConvention?` |

Point properties default to the common spellings (`speed`, `wind_speed_kt`,
`ws`…; `direction`, `wind_dir_deg`, `dir`…). Directions may be degrees or
compass names. `unit` (`'kt'`, `'m/s'`, `'km/h'`, `'mph'`) converts speeds to
knots, the unit barbs are drawn in.

Grids are decimated evenly to about `maxBarbs` symbols (default 1500), or to
every `stride`-th cell. Barbs are read one at a time; a barb per cell is an
unreadable mat.

## Convention

- Speeds round to the nearest 5 kt.
- Pennant 50 kt, full feather 10 kt, half feather 5 kt.
- A lone half feather is set one space in from the tip, so it cannot read as a
  short shaft with a full feather.
- Calm (rounds to 0) is an open circle.
- The shaft points to where the wind blows **from**.
- Feathers sit on the left of the shaft in the northern hemisphere and mirror in
  the southern; `hemisphere="auto"` (default) chooses per barb by latitude.

`barbComponents(speedKt)` returns the counts for any speed.

## Rendering

Icons are generated in the browser the first time MapLibre asks for one
(`styleimagemissing`), so only the speeds present are drawn. Each is encoded as
a **signed distance field** (TinySDF convention: radius 8, cutoff 0.25), so one
image per speed serves any `color`, any `colorStops` and a halo — a bitmap would
need an image per colour. Rotation is aligned to the map, so barbs keep their
bearing as the map turns.

MapLibre's collision detection hides overlapping barbs unless `allowOverlap`,
which keeps a zoomed-out view readable.

## Props

| Prop | Type | Default |
| --- | --- | --- |
| `data` | `WindBarbData \| null` | — |
| `mode` | `'barb' \| 'arrow'` | `'barb'` |
| `unit` | `WindSpeedUnit` | `'kt'` |
| `maxBarbs` / `stride` | `number` | `1500` / derived |
| `color` | `string` | `'#e2e8f0'` |
| `colorStops` | `[knots, colour][]` | — |
| `size` | `number` | `1` (26 px shaft) |
| `arrowScale` / `arrowSpeedRange` | `[number, number]` | `[0.5, 1.2]` / `[0, 50]` |
| `haloColor` / `haloWidth` | | `'rgba(11,18,32,0.85)'` / `1` |
| `opacity` | `number` | `1` |
| `hemisphere` | `'auto' \| 'north' \| 'south'` | `'auto'` |
| `allowOverlap` | `boolean` | `false` |
| `id`, `visible`, `beforeId`, `minZoom`, `maxZoom` | | |

## Utilities

`extractWindBarbs(data, options)` resolves any input into
`{ lng, lat, speedKt, direction }` samples without rendering — useful for a table
of the same observations. `createBarbImage(speed, hemisphere)` and
`createArrowImage()` return the SDF images.
