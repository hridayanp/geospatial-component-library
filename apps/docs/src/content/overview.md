A component library for building interactive geospatial visualisations in React.
Twenty-six packages divide the problem into rendering primitives — a map surface,
raster and vector layers, GPU flow-field animation, cartographic overlays — and
the analytical operations those primitives exist to present, each independently
installable and composable with the rest.

## Architectural position

The library occupies the **presentation tier** of a geospatial application. It
accepts georeferenced data through explicit component interfaces and produces
rendered map output; data acquisition, transformation, authorisation and
persistence remain the responsibility of the host application.

```text
Host application                    This library
─────────────────────────────       ─────────────────────────────
retrieval and authorisation
domain transformation          →    normalisation and validation
caching and scheduling              colourisation and encoding
application state                   layer and source lifecycle
                                    GPU rendering and interaction
                               ←    view state, interaction events
```

That boundary is what makes a single `RasterLayer` serviceable for
precipitation accumulation, land-surface temperature and probability-of-exceedance
alike: the component's contract is a georeferenced grid and a colour ramp, not a
domain concept.

## Provenance

The library was consolidated from a weather-operations console containing six
near-identical map components — one each for convective probability, humidity,
surface wind, total precipitation, convective precipitation and non-convective
precipitation — totalling roughly 213 KB of source.

The components differed in exactly two respects: the band they rendered and the
colour ramp they applied. The remainder — retrieval, GeoTIFF decoding, the
colourisation loop, the double-buffered image swap, hover wiring — was duplicated
with identifiers renamed.

The consolidation applied one test to every line: *does this express a rendering
capability, or an application decision?* Rendering capabilities became packages.
Application decisions became props. Six components reduced to one `RasterLayer`
whose variation is two props.

## Package inventory

| Package | Responsibility |
| --- | --- |
| [`map-container`](/docs/map-container) | MapLibre GL map instance, view state, and the React context layers attach to |
| [`raster-layer`](/docs/raster-layer) | Georeferenced raster rendering with double-buffered frame transitions |
| [`vector-layer`](/docs/vector-layer) | GeoJSON rendering across all geometry types with data-driven symbology |
| [`wind-particle-layer`](/docs/wind-particle-layer) | GPU flow-field particle advection on deck.gl and WeatherLayers GL |
| [`geo-legend`](/docs/geo-legend) | Continuous and classified legends for map symbology |
| [`geo-hover`](/docs/geo-hover) | Feature picking, raster value probing, and a portalled readout card |
| [`timeline-control`](/docs/timeline-control) | Temporal frame sequencing and playback |
| [`map-controls`](/docs/map-controls) | View-state controls: zoom, reset, fullscreen, opacity, basemap selection |
| [`deck-overlay`](/docs/deck-overlay) | deck.gl interoperability layer for the MapLibre render pass |
| [`raster-utils`](/docs/raster-utils) | Raster statistics, colour ramps, colourisation, sampling, GeoTIFF decoding |
| [`geo-utils`](/docs/geo-utils) | Extent algebra, geodesy, GeoJSON traversal. No runtime dependencies |
| [`ui`](/docs/ui) | Shared interface primitives and the library stylesheet |

Four further packages address comparison and analysis. They render nothing of
their own: each produces `RasterData`, GeoJSON or SVG that the layer packages
above already know how to draw.

| Package | Responsibility |
| --- | --- |
| [`map-compare`](/docs/map-compare) | Synchronised swipe comparison and small multiples |
| [`classified-raster`](/docs/classified-raster) | Categorical symbology, latitude-weighted areas, change accounting |
| [`hotspot-analysis`](/docs/hotspot-analysis) | Getis-Ord Gi\* clustering and kernel density estimation |
| [`geo-charts`](/docs/geo-charts) | Trend projection, class composition, transition matrices |

Ten further packages cover meteorological layers, interaction and charts. Each
follows the same contract — data in through props, events out through
callbacks — and none fetches anything the host did not hand it.

| Package | Responsibility |
| --- | --- |
| [`contour-layer`](/docs/contour-layer) | Isolines traced from a raster with marching squares, drawn and labelled |
| [`wind-barb-layer`](/docs/wind-barb-layer) | WMO wind barbs and direction arrows, native MapLibre, no deck.gl |
| [`data-tile-layer`](/docs/data-tile-layer) | Value-encoded data tiles coloured in the browser, A − B difference, exact sampling |
| [`heatmap-layer`](/docs/heatmap-layer) | GPU point-density heatmap with weighting and a hand-over to points |
| [`map-draw`](/docs/map-draw) | Drawing, editing and geodesic measurement on terra-draw |
| [`map-markers`](/docs/map-markers) | React markers and popups, and a click-to-pick point selector |
| [`map-widgets`](/docs/map-widgets) | Scale bar, cursor coordinates, north arrow, overview inset, place search, ramp picker, loading overlay |
| [`map-export`](/docs/map-export) | PNG, JPEG and animated GIF export, no runtime dependencies |
| [`met-charts`](/docs/met-charts) | Skew-T, hodograph, wind rose, meteogram, profile, cross-section, verification scatter |
| [`geo-inputs`](/docs/geo-inputs) | Latitude/longitude field for every notation, and a bounding-box editor |

## Rendering stack

| Concern | Technology |
| --- | --- |
| Map surface, tiling, vector rendering | MapLibre GL JS 4 or 5 |
| GPU particle advection | deck.gl 9 and WeatherLayers GL |
| Cloud-Optimised GeoTIFF decoding | `geotiff` (optional, lazily imported) |
| Colour interpolation | `chroma-js` |
| Accessible interface primitives | Radix UI |

Every shared runtime is declared as a **peer dependency**. A single instance of
React, MapLibre GL and deck.gl is therefore resolved per application, and the
library never dictates a major-version upgrade.

## Coordinate reference systems

All coordinates crossing the public API are geographic WGS84 (EPSG:4326),
expressed as `[longitude, latitude]` in decimal degrees. Extents are
`[west, south, east, north]`, matching the GeoJSON `bbox` convention and
MapLibre's own ordering.

Rendering is performed by MapLibre in Web Mercator (EPSG:3857); MapLibre 5 also
supports a globe projection, selectable through the `projection` prop on
`MapContainer`. **No reprojection is performed by this library** — data supplied
in a projected CRS must be transformed upstream. See
[`geo-utils`](/docs/geo-utils#coordinate-conventions) for the full set of
conventions.

## Scope boundaries

**The library composes MapLibre; it does not abstract it.** The underlying map
instance is reachable through `useMap()` or the `MapContainer` imperative
handle, and any MapLibre capability the library does not surface remains
directly available.

**Data access is an application responsibility.** Where a component legitimately
accepts a resource locator — a Cloud-Optimised GeoTIFF URL — the caller supplies
one the application has already authorised. Credential lifecycle, retry policy
and caching strategy belong to the host.

**`@hridayanp/ui` is a support package, not a design system.** Its purpose is
visual coherence between a legend, a timeline and a control bar; it does not
attempt to style the surrounding application.

## Continue

- [Installation](/docs/installation) — packages, peer dependencies, and the stylesheet
- [Quick Start](/docs/quick-start) — a rendering map in approximately twenty lines
- [Design Principles](/docs/principles) — the criteria that determine package boundaries
- [Runtime Flow](/docs/runtime-flow) — mount, frame transition, and style reload sequences
