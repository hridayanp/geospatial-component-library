Twenty-six packages arranged as a directed acyclic graph rooted at `geo-utils`, with
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
                       ├──── geo-legend ─────┤
                       |                     |
                       └──── map-compare ────┘
```

The analysis packages sit off the render path entirely:

```text
        geo-utils ──┬── classified-raster
                    |            │
        raster-utils┘   hotspot-analysis

        ui ──────────── geo-charts
```

`classified-raster` and `hotspot-analysis` depend on `geo-utils` and
`raster-utils` and nothing else — no React, no MapLibre. `geo-charts` depends
only on `ui`. None of the three imports a layer package, and no layer package
imports them: the analysis packages emit `RasterData` and GeoJSON, and the
existing layers render it.

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
| `map-compare` | `geo-utils`, `map-container`, `ui` | `react`, `maplibre-gl` |
| `classified-raster` | `geo-utils`, `raster-utils` | — |
| `hotspot-analysis` | `geo-utils`, `raster-utils` | — |
| `geo-charts` | `ui` | `react` |
| `contour-layer` | `geo-utils`, `raster-utils`, `map-container` | `react`, `maplibre-gl` |
| `wind-barb-layer` | `geo-utils`, `map-container` | `react`, `maplibre-gl` |
| `data-tile-layer` | `raster-utils`, `map-container` | `react`, `maplibre-gl` |
| `heatmap-layer` | `geo-utils`, `raster-utils`, `map-container` | `react`, `maplibre-gl` |
| `map-draw` | `geo-utils`, `map-container`, `ui`, `terra-draw`, `terra-draw-maplibre-gl-adapter` | `react`, `maplibre-gl` |
| `map-markers` | `geo-utils`, `map-container`, `ui` | `react`, `react-dom`, `maplibre-gl` |
| `map-widgets` | `geo-inputs`, `geo-utils`, `raster-utils`, `map-container`, `ui` | `react`, `maplibre-gl` |
| `map-export` | `map-container`, `ui` | `react`, `maplibre-gl` |
| `met-charts` | `geo-charts`, `geo-utils`, `raster-utils`, `ui` | `react` |
| `geo-inputs` | `geo-utils`, `ui` | `react` |

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

### Analysis packages render nothing

`classified-raster` and `hotspot-analysis` produce colourised images, class
statistics and scored features — all of which a map must eventually draw. Giving
either its own layer component would duplicate the source, layer and
double-buffering logic that `raster-layer` and `vector-layer` already own, and
would put a second implementation of the frame swap into the library.

They therefore return `RasterData`, data URLs and GeoJSON in exactly the shapes
the existing layers accept, and depend on no React and no MapLibre. The
consequences are worth stating: both run unchanged in a web worker, both are
testable without a browser, and the invariant that no layer package depends on
another layer package survives the addition.

`geo-charts` is the mirror image — it renders, but only SVG, and it holds no
coordinates. It depends on `ui` for the shared tokens and nothing else, so a
report containing a composition chart pulls in neither MapLibre nor deck.gl.

`met-charts` extends `geo-charts` rather than duplicating it: every
meteorological chart is drawn inside the same `ChartFrame`, so the table view,
legend and tokens are one implementation. `geo-inputs` has no map dependency at
all; `map-widgets` depends on it for coordinate formatting, which keeps one
parser and one formatter in the library.

The new layer packages — `contour-layer`, `wind-barb-layer`, `data-tile-layer`,
`heatmap-layer` — each depend on `map-container` and never on one another, so
the sibling-independence invariant holds. `wind-barb-layer` accepts the same
`{ kind: 'field' }` and `{ kind: 'points' }` shapes as `wind-particle-layer`
structurally, without importing it, and so needs no deck.gl. `map-draw` is the
only new package with a heavy third-party dependency (terra-draw), which is the
reason it is its own package.

## Build ordering

Turborepo derives task order from each package's `dependencies` field; no
ordering is configured:

```text
geo-utils ──┬─→ raster-utils ──→ raster-layer ──→ (docs, storybook)
            ├─→ map-container ─→ vector-layer, map-compare
            ├─→ …               deck-overlay ──→ wind-particle-layer
            └─→ raster-utils ──→ classified-raster, hotspot-analysis
ui ─────────────────────────────→ geo-legend, timeline-control, map-controls,
                                  geo-charts ──→ met-charts
map-container ──────────────────→ contour-layer, wind-barb-layer, data-tile-layer,
                                  heatmap-layer, map-draw, map-markers,
                                  map-export, map-widgets (after geo-inputs)
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
