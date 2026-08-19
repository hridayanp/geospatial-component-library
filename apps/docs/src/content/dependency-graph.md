Twelve packages arranged as a directed acyclic graph rooted at `geo-utils`, with
no edges between sibling layer packages.

## Structure

```text
                    geo-utils          (no runtime dependencies)
                   /     |     \
        raster-utils     |      \
         /      \        |       \
  raster-layer   \       |        \
        \         \      |         \
         `------ map-container ----- vector-layer
                  /    |    \
        deck-overlay   |     map-controls ── ui
              |        |            |        |
   wind-particle-layer |       geo-hover ────┤
                       |                     |
                       └──── geo-legend ─────┘
```

## Resolved dependencies

| Package | Workspace and third-party dependencies | Peer dependencies |
| --- | --- | --- |
| `geo-utils` | — | — |
| `raster-utils` | `geo-utils`, `chroma-js` | `geotiff` (optional) |
| `ui` | Radix primitives | `react`, `react-dom` |
| `map-container` | `geo-utils` | `react`, `react-dom`, `maplibre-gl`; `pmtiles` and `@geomatico/maplibre-cog-protocol` (optional) |
| `deck-overlay` | `map-container` | `react`, `maplibre-gl`, `@deck.gl/core`, `@deck.gl/mapbox` |
| `raster-layer` | `geo-utils`, `raster-utils`, `map-container` | `react`, `maplibre-gl` |
| `vector-layer` | `geo-utils`, `map-container` | `react`, `maplibre-gl` |
| `wind-particle-layer` | `geo-utils`, `map-container`, `deck-overlay` | `react`, `maplibre-gl`, `weatherlayers-gl`, `@deck.gl/core`, `@deck.gl/mapbox`, `@deck.gl/extensions`, `@deck.gl/layers` |
| `geo-legend` | `ui` | `react` |
| `geo-hover` | `geo-utils`, `raster-utils`, `map-container`, `ui` | `react`, `react-dom`, `maplibre-gl` |
| `timeline-control` | `ui` | `react` |
| `map-controls` | `geo-utils`, `map-container`, `ui` | `react`, `maplibre-gl` |

## Invariants of the graph

### `geo-utils` has no dependencies

No React, no MapLibre, no geometry library. It is the one package every other
package depends on, which is precisely why its weight is constrained.

The consequence is that it is usable outside this library entirely — in a Node
service, a web worker, or a host that is not React. Coordinate conventions,
extent algebra and GeoJSON traversal are therefore shareable between a browser
renderer and a server-side pipeline without duplication.

### No layer package depends on another layer package

`raster-layer` has no knowledge of `wind-particle-layer`. They share
`map-container` and nothing further.

This is what makes the packages independently installable and independently
evolvable: a modification to one cannot affect the rendering behaviour of
another.

### Shared runtimes appear only as peers

React, MapLibre GL, deck.gl and WeatherLayers GL are declared exclusively in
`peerDependencies`. A single instance is resolved by the consuming application
and shared across every package.

> **Warning:** For the same reason, running `npm install` **inside** a package
> directory breaks the workspace. It creates a nested `node_modules` that
> shadows the hoisted resolution, producing two React instances in one module
> graph — `Invalid hook call`, or hooks resolving to null. Install from the
> workspace root.

## Rationale for specific boundaries

### `deck-overlay` as a distinct package

It is the only module in the library that references deck.gl. Isolating it means
`raster-layer` and `vector-layer` never introduce a second WebGL rendering
engine into a bundle that has no use for one.

`wind-particle-layer` depends on it. No other package does.

### Localised colour-ramp logic in `geo-legend`

`geo-legend` implements its own ninety-line ramp resolver rather than importing
`raster-utils`.

A legend requires a CSS gradient and an ordered swatch list. Depending on
`raster-utils` would introduce `chroma-js` and the GeoTIFF decoding path into a
bundle that may contain no raster data at all. The duplication is bounded and
the dependency saving is substantial.

The same reasoning does not apply to `raster-layer`, which requires the full
colourisation pipeline.

## Build ordering

Turborepo derives task order from each package's `dependencies` field; no
ordering is configured:

```text
geo-utils ──┬─→ raster-utils ──→ raster-layer ──→ (docs, storybook)
            ├─→ map-container ─→ vector-layer
            └─→ …               deck-overlay ──→ wind-particle-layer
ui ─────────────────────────────→ geo-legend, timeline-control, map-controls
```

A new package with correctly declared dependencies is inserted into the graph
automatically. There is no ordering list to maintain.

## Inspecting the graph

```bash
npm ls @hridayanp/geo-utils        # resolved dependents
npx turbo run build --graph        # Turborepo's resolved task graph
```

A layer package appearing in another layer package's `dependencies` indicates a
misplaced boundary — see [Design Principles](/docs/principles).
