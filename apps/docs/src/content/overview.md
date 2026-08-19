A set of React packages for building map visualisations. Each one does a single
thing, receives all of its data through props, and can be installed on its own
or composed with the others.

There is no application in here. No routes, no store, no API client, no
authentication, no dashboard. A host application owns data retrieval and
business logic; these packages own rendering.

## Where this came from

The library was extracted from a weather operations console that had six
near-identical map components — one each for thunderstorm probability, humidity,
surface wind, rainfall, convective rainfall and non-convective rainfall.
Together they came to roughly 213 KB of source.

They differed in exactly two ways: **which data** and **which colour ramp**.
Everything else — the presigned-URL fetch, the GeoTIFF decode, the colourisation
loop, the double-buffered image swap, the hover wiring — was copy-paste with the
variable names changed.

So the refactor asked one question of every line: *is this a rendering
capability, or an application decision?* Rendering capabilities became packages.
Application decisions became props.

```text
OLD   Component → API client → Redux → decode → colourise → draw
NEW   Host app  → fetch/decode (yours) → props → [library] colourise → draw
```

Six components became one `RasterLayer` whose differences are two props.

## The packages

| Package | Responsibility |
| --- | --- |
| [`map-container`](/docs/map-container) | MapLibre map, camera, and the React context layers attach to |
| [`raster-layer`](/docs/raster-layer) | Generic raster visualisation with zero-blink frame updates |
| [`vector-layer`](/docs/vector-layer) | Generic GeoJSON layer for every geometry type |
| [`wind-particle-layer`](/docs/wind-particle-layer) | GPU-animated flow particles (deck.gl + WeatherLayers GL) |
| [`geo-legend`](/docs/geo-legend) | Continuous and classed legends |
| [`geo-hover`](/docs/geo-hover) | Feature picking, raster probing, portalled readout card |
| [`timeline-control`](/docs/timeline-control) | Frame playback for animated layers |
| [`map-controls`](/docs/map-controls) | Zoom, reset, fullscreen, opacity, basemap |
| [`deck-overlay`](/docs/deck-overlay) | Bridges deck.gl layers onto a MapLibre map |
| [`raster-utils`](/docs/raster-utils) | Raster maths: stats, ramps, colourisation, sampling, GeoTIFF |
| [`geo-utils`](/docs/geo-utils) | Bounds, geodesy, GeoJSON helpers — zero dependencies |
| [`ui`](/docs/ui) | Shared primitives and the one stylesheet |

## What it is built on

MapLibre GL for the map and vector rendering. deck.gl and WeatherLayers GL for
GPU particle animation. `geotiff` for Cloud-Optimised GeoTIFF decoding, loaded
lazily and only if you use it. `chroma-js` for colour interpolation. Radix for
the accessible parts of the UI primitives.

All of the heavy ones are **peer dependencies**, so there is exactly one copy in
your application and the library never dictates a version bump.

## What it deliberately is not

- **Not a mapping framework.** It does not wrap or hide MapLibre. You can always
  reach the raw instance with `useMap()` and do whatever you want.
- **Not a data layer.** Nothing fetches, caches, retries or authenticates.
  Where a generic GIS component legitimately takes a URL — a Cloud-Optimised
  GeoTIFF — you supply a URL your application has already authorised.
- **Not a design system.** The UI package exists to make a legend and a timeline
  look like they belong together, not to style your application.

## Where to go next

- [Installation](/docs/installation) — what to install and why the peers matter
- [Quick Start](/docs/quick-start) — a working map in about twenty lines
- [Design Principles](/docs/principles) — the rules that decide what gets a package
- [Runtime Flow](/docs/runtime-flow) — what actually happens on mount and on a timeline step
