Twelve packages, arranged as a directed acyclic graph with no edges between
siblings.

## The graph

```text
                    geo-utils          (zero dependencies)
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

## Dependencies in full

| Package | Depends on | Peer dependencies |
| --- | --- | --- |
| `geo-utils` | — | — |
| `raster-utils` | `geo-utils`, `chroma-js` | `geotiff` (optional) |
| `ui` | Radix primitives | React |
| `map-container` | `geo-utils` | React, MapLibre, `pmtiles`* , COG protocol* |
| `deck-overlay` | `map-container` | React, MapLibre, deck.gl core + mapbox |
| `raster-layer` | `geo-utils`, `raster-utils`, `map-container` | React, MapLibre |
| `vector-layer` | `geo-utils`, `map-container` | React, MapLibre |
| `wind-particle-layer` | `geo-utils`, `map-container`, `deck-overlay` | React, MapLibre, deck.gl ×3, WeatherLayers |
| `geo-legend` | `ui` | React |
| `geo-hover` | `geo-utils`, `raster-utils`, `map-container`, `ui` | React, React DOM, MapLibre |
| `timeline-control` | `ui` | React |
| `map-controls` | `geo-utils`, `map-container`, `ui` | React, MapLibre |

\* optional

## The three rules that hold

### 1. `geo-utils` depends on nothing

No React, no MapLibre, no Turf, no geometry library. It is the only package
every other one depends on, which is exactly why it has to stay weightless.

It is also usable outside this library entirely — in a Node service, a web
worker, or a host that is not React.

### 2. No layer depends on another layer

`raster-layer` does not know `wind-particle-layer` exists. They share
`map-container` and nothing else.

This is what makes the packages genuinely independent: you can install one, and
a change to another cannot break it.

### 3. The heavy runtimes are peers, never dependencies

React, MapLibre, deck.gl and WeatherLayers appear only in `peerDependencies`.
There is one copy in the consuming application, and everything shares it.

> **Warning:** This is also why running `npm install` **inside** a package
> breaks the workspace. It creates a nested `node_modules` that shadows the
> hoisted copies, and you end up with two Reacts in one tree — `Invalid hook
> call`, or hooks silently returning null. Always install from the root.

## Why `deck-overlay` is its own package

It is the only place in the library that knows about deck.gl. Keeping it
separate means `raster-layer` and `vector-layer` never drag a WebGL rendering
engine into a bundle that has no use for one.

`wind-particle-layer` depends on it. Nothing else does.

## Why `geo-legend` duplicates a little colour code

`geo-legend` has its own 90-line `colorScale.ts` rather than importing
`raster-utils`. That is deliberate.

A legend needs a CSS gradient and a list of swatches. Importing `raster-utils`
would pull `chroma-js` and the GeoTIFF decoder into a bundle that may contain no
raster at all. Ninety lines of duplication is cheaper than that dependency.

The same reasoning does **not** apply to `raster-layer`, which genuinely needs
the full colourisation pipeline.

## How Turbo uses this

Build order is derived from the `dependencies` field, not configured:

```text
geo-utils ──┬─→ raster-utils ──→ raster-layer ──→ (docs, storybook)
            ├─→ map-container ─→ vector-layer
            └─→ …               deck-overlay ──→ wind-particle-layer
ui ─────────────────────────────→ geo-legend, timeline-control, map-controls
```

Adding a package with correct `dependencies` slots it into the graph
automatically. There is no order list to update.

## Verifying the graph

```bash
npm ls @hridayanp/geo-utils        # who depends on it
npx turbo run build --graph        # Turbo's resolved task graph
```

If a layer package ever appears in another layer package's dependencies, the
boundary is wrong — see [Design Principles](/docs/principles).
