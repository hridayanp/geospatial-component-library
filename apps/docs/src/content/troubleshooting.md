Symptom to cause, for the failures that occur in practice. Most map defects are
silent — no exception, no build diagnostic — so matching the symptom is the
fastest route.

## The map renders nothing

**No output at all, and no errors.** The container has no resolved height.
`MapContainer` fills its parent, and a parent with `height: auto` collapses to
zero.

```tsx
<div style={{ height: 520 }}>
  <MapContainer center={[92, 25.5]} zoom={6} />
</div>
```

**A uniform background.** This is correct. `mapStyle` defaults to a
background-only style specification and issues no network request. Supply a
basemap:

```tsx
<MapContainer mapStyle={createRasterStyle(tileUrl, { attribution })} />
```

**Controls and attribution appear unstyled.** MapLibre's own stylesheet is
missing:

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
```

## Layers never appear

Check in order:

1. **Is the layer a descendant of `MapContainer`?** Layers resolve the map
   through context. `useMap()` throws outside one, deliberately.
2. **Duplicate MapLibre resolution.** `npm ls maplibre-gl` must report one
   version. Two causes `map instanceof Map` to fail across the boundary and
   nothing attaches, with no error. Usually a nested `node_modules` from
   installing inside a package, or a missing `external` entry in
   `tsup.config.ts`.
3. **Is `data` non-null?** `null` renders nothing by design.
4. **Extent ordering.** `[west, south, east, north]`, not
   `[south, west, north, east]`.

## Every layer disappears on basemap change

`setStyle` discards every source and style layer added on top of it. Library
layers re-register automatically; sources and layers added by the host must list
`styleVersion` in their effect dependencies:

```tsx
const { map, ready, styleVersion } = useMap();
useEffect(() => { /* addSource, addLayer */ }, [map, ready, styleVersion]);
```

If library layers also disappear, `BasemapSwitcher` likely has `applyToMap`
enabled while the host is also passing `mapStyle` — two writers contending for
the same state. Leave `applyToMap` at its default of `false`.

## The raster is placed incorrectly

| Symptom | Cause |
| --- | --- |
| Vertically mirrored | Rows are south-first; they must be north-first |
| Offset by half a cell | `bounds` supplied as outer cell centres rather than image edges |
| Placed elsewhere entirely | Extent ordering, or a non-WGS84 GeoTIFF (no reprojection is performed) |
| Horizontally compressed or stretched | `width`/`height` inconsistent with the array length |

## The raster flashes on every frame change

- `doubleBuffered` is `false`; it defaults to `true`.
- Or consecutive frames have **different dimensions**, forcing a full source
  replacement.
- Or a custom style re-enables `raster-fade-duration`, which competes with the
  manual buffer flip.

## The sequence pulses; colour changes meaning per frame

`min` and `max` are unset, so each frame is normalised against its own range.

```tsx
<RasterLayer data={frames[i]} min={0} max={120} />
```

This is the most frequent error in temporal composition.

## Scrubbing is slow

- Supply `frameKey`. Without it, no frame is cached.
- Prefetch the next frame with `preloadRasterFrame`; retrieval and prefetch are
  host responsibilities.
- Reduce `smoothFactor`; its cost is quadratic.
- Decode COG overviews rather than full resolution (`resolution: 'overview'`, the
  default).
- For large grids, colourise in a worker with
  [`raster-utils`](/docs/raster-utils) and supply `{ kind: 'image' }`.

## The flow field animates in the wrong direction

`directionConvention`. Meteorological data reports the bearing the flow
originates **from** (the default); current and drift data conventionally report
the bearing of travel.

```tsx
data={{ kind: 'points', data: geojson, directionConvention: 'towards' }}
```

## No particles render

1. **WebGL2 is required.** There is no fallback. Verify with
   `document.createElement('canvas').getContext('webgl2')`.
2. **UV texture alpha must be exactly 255.** WeatherLayers treats lower values
   as absent data. Anti-aliasing or premultiplied alpha in an external encoding
   pipeline is the usual cause.
3. `particleCount` is `0`, or `maxZoom` is below the current zoom.
4. Duplicate `@deck.gl/core` resolution — `npm ls @deck.gl/core`.

## Particles restart on every frame change

Consecutive fields have different grid dimensions, so the GPU cross-fade cannot
operate and the texture is replaced outright. Resample to a consistent grid, or
accept the reset.

## Hover interaction is janky

`layerIds` is unscoped. `queryRenderedFeatures` executes on every pointer-move
event and traverses every rendered style layer, including the entire basemap.

```tsx
<GeoHover layerIds={['sites-hit']} />
```

## Small symbols are difficult to acquire

```tsx
<VectorLayer id="sites" data={points} hitRadius={14} />
<GeoHover layerIds={['sites-hit']} />
```

`hitRadius` registers an invisible widened target without altering what is
drawn. Note the `-hit` suffix on the layer identifier.

## The readout card is clipped

It is rendered inside the map container, and an ancestor declares
`overflow: hidden`. `GeoHoverCard` and every `ui` popover portal to
`document.body` for exactly this reason — use them rather than a custom
absolutely positioned element.

## The map cannot be panned over an overlay

The overlay container must declare `pointer-events: none`, with controls opting
back in. `MapControlBar` and `GeoLegendStack` already do; a custom absolutely
positioned wrapper will not.

## The canvas is the wrong size

`MapContainer` runs a `ResizeObserver`, so this should not occur — unless the
resize is a CSS transition, in which case the observer fires mid-animation. Call
`ref.current?.resize()` once the transition completes.

## Everything is unstyled

```ts
import '@hridayanp/ui/styles.css';
```

Once, anywhere in the application. Required by every package that renders
interface elements: `ui`, `geo-legend`, `geo-hover`, `timeline-control`,
`map-controls`.

## Colours are wrong in dark mode

With no `data-gcl-theme` attribute present, the library resolves the scheme from
`prefers-color-scheme`. Set it explicitly to override:

```html
<div data-gcl-theme="dark">…</div>
```

## Build and tooling

| Diagnostic | Resolution |
| --- | --- |
| `Unable to find package manager binary` | Root `package.json` must declare `"packageManager": "npm@10.9.7"` |
| `Cannot find module '@hridayanp/…'` | Run `npm install` from the **root**, not inside a package |
| `Missing devEngines.packageManager` | Turborepo 2.10 requires the `packageManager` field; do not remove it |
| Changes not reflected | Turborepo cache — `npx turbo run build --force` |
| Port 6006 already bound | `lsof -ti:6006 \| xargs kill` |
| Wrong package resolved in development | An unanchored Vite alias; patterns must be `^…$` |
| Storybook: `Control of type color only supports string` | An expression-valued prop matched the global colour matcher; declare an explicit `argType` |

## Publishing

| Symptom | Cause |
| --- | --- |
| `src/` present in the tarball | `files` is incorrect; it must be `["dist", "README.md"]` |
| A consumer cannot import a submodule | Correct behaviour. `exports` seals the package; re-export from `index.ts` instead |
| A consumer resolves two MapLibre instances | A peer missing from `tsup`'s `external`, or declared as a `dependency` |
| `402 Payment Required` | Missing `--access public` on a scoped package |

## Further diagnosis

- [Invariants](/docs/invariants) — what fails when a core assumption is violated.
- Reproduce the case in Storybook. If it renders there and not in the
  application, the difference is the data, the bundler or a duplicate
  dependency — not the component.
- `npm ls react maplibre-gl @deck.gl/core` must report exactly one version of
  each. That single command explains a substantial share of silent failures.
