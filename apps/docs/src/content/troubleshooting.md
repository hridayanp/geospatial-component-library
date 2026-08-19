Symptom to cause, for the failures that actually happen. Most map bugs are silent
— no exception, no build error — so the fastest route is matching the symptom.

## The map is blank

**Nothing renders at all, no errors.**

The container has no height. `MapContainer` fills its parent, and a parent with
`height: auto` collapses to zero.

```tsx
<div style={{ height: 520 }}>
  <MapContainer />
</div>
```

**The map is there but empty.** That is correct: `mapStyle` defaults to a blank
background and makes no network request. Pass a style:

```tsx
<MapContainer mapStyle={createRasterStyle('https://tile.example.com/{z}/{x}/{y}.png', {
  attribution: '© Example',
})} />
```

**Missing MapLibre CSS** — controls and attribution look unstyled:

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
```

## Layers never appear

Check, in order:

1. **Is the layer inside `<MapContainer>`?** It attaches through context.
   `useMap()` throws outside one, deliberately.
2. **Two copies of MapLibre.** `npm ls maplibre-gl` should print one version. Two
   means `map instanceof Map` fails across the boundary and nothing attaches —
   with no error. Usually a nested `node_modules` from installing inside a
   package, or a missing `external` entry in `tsup.config.ts`.
3. **Is `data` actually non-null?** `null` renders nothing by design.
4. **Bounds order.** `[west, south, east, north]`, not `[south, west, north, east]`.

## Everything disappears when I change the basemap

`setStyle` discards every source and layer added on top of it. Library layers
re-attach automatically; anything you added by hand must list `styleVersion` in
its effect dependencies:

```tsx
const { map, ready, styleVersion } = useMap();
useEffect(() => { /* addSource, addLayer */ }, [map, ready, styleVersion]);
```

If library layers also vanish, `BasemapSwitcher` probably has `applyToMap` on
while the host is also passing `mapStyle` — two writers fighting. Turn
`applyToMap` off.

## The raster is in the wrong place

| Symptom | Cause |
| --- | --- |
| Vertically mirrored | Rows are south-first; they must be north-first |
| Offset by half a cell | `bounds` given as outer pixel centres, not image edges |
| Completely elsewhere | Bounds order, or a non-WGS84 GeoTIFF (no reprojection) |
| Squashed or stretched | `width`/`height` do not match the array length |

## The raster blinks on every timeline step

- `doubleBuffered` is `false`. It defaults to `true`.
- Or the frames have **different dimensions**, which forces a full source
  replacement.
- Or a custom style re-enables `raster-fade-duration`, which fights the manual
  buffer flip.

## The animation pulses — colours change meaning every frame

No explicit `min`/`max`, so each frame self-scales to its own range.

```tsx
<RasterLayer data={frames[i]} min={0} max={120} />
```

This is the most common animation mistake.

## Scrubbing is slow

- Supply `frameKey`. Without it, nothing caches.
- Prefetch the next frame with `preloadRasterFrame` — retrieval and prefetching
  are the host's job.
- Lower `smoothFactor`; its cost is quadratic.
- Decode COG overviews rather than full resolution
  (`resolution: 'overview'`, the default).
- For very large grids, colourise in a worker with
  [`raster-utils`](/docs/raster-utils) and pass `{ kind: 'image' }`.

## Particles flow the wrong way

`directionConvention`. Meteorological data reports where wind comes **from**
(the default); drift and current data usually report where it is **going**.

```tsx
data={{ kind: 'points', data: geojson, directionConvention: 'towards' }}
```

## No particles at all

1. **WebGL2 is required.** There is no fallback. Check
   `document.createElement('canvas').getContext('webgl2')`.
2. **Alpha must be a hard 255** in the UV texture. WeatherLayers treats anything
   less as missing data. Anti-aliasing or premultiplied alpha in an external
   encoding pipeline is the usual cause.
3. `particleCount` is 0, or `maxZoom` is below the current zoom.
4. Two copies of `@deck.gl/core` — `npm ls @deck.gl/core`.

## Particles restart on every timeline step

Consecutive fields have different dimensions, so the GPU cross-fade cannot run
and the texture is replaced outright. Resample to a consistent grid, or accept
the reset.

## Hover is janky

`layerIds` is unscoped. `queryRenderedFeatures` runs on every pointer move and
walks every rendered layer, including the whole basemap.

```tsx
<GeoHover layerIds={['sites-hit']} />
```

## Small points are hard to hover

```tsx
<VectorLayer id="sites" data={points} hitRadius={14} />
<GeoHover layerIds={['sites-hit']} />
```

`hitRadius` adds an invisible wider target without changing what is drawn. Note
the `-hit` suffix on the layer id.

## The tooltip is clipped

It is rendered inside the map container, and something above it has
`overflow: hidden`. `GeoHoverCard` and every `ui` popover portal to
`document.body` for exactly this reason — use them rather than rolling your own
absolutely-positioned element.

## The map is not draggable over an overlay

The overlay container must be `pointer-events: none`, with controls opting back
in. `MapControlBar` and `GeoLegendStack` already do this; a custom absolutely
positioned wrapper will not.

## The canvas is the wrong size

`MapContainer` runs a `ResizeObserver`, so this should not happen — unless the
resize is a CSS transition, in which case the observer fires mid-animation. Call
`ref.current?.resize()` after the transition completes.

## Everything is unstyled

```ts
import '@hridayanp/ui/styles.css';
```

Once, anywhere in the app. Required by every package that renders UI: `ui`,
`geo-legend`, `geo-hover`, `timeline-control`, `map-controls`.

## Colours are wrong in dark mode

With no `data-gcl-theme` attribute, the library follows `prefers-color-scheme`.
Set it explicitly to override:

```html
<div data-gcl-theme="dark">…</div>
```

## Build and tooling

| Error | Fix |
| --- | --- |
| `Unable to find package manager binary` | Root `package.json` must have `"packageManager": "npm@10.9.7"` |
| `Cannot find module '@hridayanp/…'` | `npm install` from the **root**, not inside a package |
| `Missing devEngines.packageManager` | Turbo 2.10 requires the `packageManager` field; do not remove it |
| Changes not picked up | Turbo cache — `npx turbo run build --force` |
| Port 6006 in use | `lsof -ti:6006 \| xargs kill` |
| Wrong package resolved in dev | An unanchored Vite alias — regexes must be `^…$` |
| Storybook: `Control of type color only supports string` | An expression-valued prop hit the global colour matcher; set an explicit `argType` |

## Publishing

| Symptom | Cause |
| --- | --- |
| `src/` in the tarball | `files` is wrong — it must be `["dist", "README.md"]` |
| Consumer cannot import a submodule | Correct. `exports` seals the package; export it from `index.ts` instead |
| Consumer gets two MapLibres | A peer missing from `tsup`'s `external`, or listed as a `dependency` |
| `402 Payment Required` | Missing `--access public` on a scoped package |

## Still stuck

- [Invariants](/docs/invariants) — what breaks when a core assumption is violated.
- Open the same case in Storybook. If it works there and not in your app, the
  difference is your data, your bundler or a duplicate dependency — the component
  is fine.
- `npm ls react maplibre-gl @deck.gl/core` should print exactly one version of
  each. That single command explains a surprising share of silent failures.
