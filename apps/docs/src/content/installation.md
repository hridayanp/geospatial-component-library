Packages are installed individually. Shared runtimes are declared as peer
dependencies so that exactly one instance of each is resolved per application.

## Baseline installation

A map surface with a raster layer:

```bash
npm install @hridayanp/map-container @hridayanp/raster-layer \
  maplibre-gl react react-dom
```

Additional capabilities are additive:

```bash
npm install @hridayanp/vector-layer
npm install @hridayanp/geo-legend @hridayanp/geo-hover
npm install @hridayanp/timeline-control @hridayanp/map-controls
```

## Flow-field visualisation

`wind-particle-layer` renders through deck.gl and WeatherLayers GL and therefore
declares the largest peer set in the library:

```bash
npm install @hridayanp/wind-particle-layer @hridayanp/map-container \
  maplibre-gl weatherlayers-gl \
  @deck.gl/core @deck.gl/mapbox @deck.gl/extensions @deck.gl/layers
```

`@deck.gl/layers` is a requirement of `weatherlayers-gl` rather than of this
library, but it must be present for the dependency graph to resolve without
warnings.

## Peer dependency matrix

| Package | Required peers | Optional peers |
| --- | --- | --- |
| `geo-utils` | — | — |
| `raster-utils` | — | `geotiff` |
| `ui` | `react`, `react-dom` | — |
| `map-container` | `react`, `react-dom`, `maplibre-gl` | `pmtiles`, `@geomatico/maplibre-cog-protocol` |
| `raster-layer` | `react`, `maplibre-gl` | — |
| `vector-layer` | `react`, `maplibre-gl` | — |
| `geo-legend` | `react` | — |
| `timeline-control` | `react` | — |
| `map-controls` | `react`, `maplibre-gl` | — |
| `geo-hover` | `react`, `react-dom`, `maplibre-gl` | — |
| `deck-overlay` | `react`, `maplibre-gl`, `@deck.gl/core`, `@deck.gl/mapbox` | — |
| `wind-particle-layer` | `react`, `maplibre-gl`, `weatherlayers-gl`, `@deck.gl/core`, `@deck.gl/mapbox`, `@deck.gl/extensions`, `@deck.gl/layers` | — |

Optional peers are imported dynamically at the point of use and are required
only for the corresponding capability:

| Package | Enables |
| --- | --- |
| `geotiff` | `decodeGeoTIFF()`, `decodeGeoTIFFBands()`, and `<RasterLayer data={{ kind: 'geotiff' }}>` |
| `pmtiles` | `registerPMTilesProtocol()` and `pmtiles://` sources |
| `@geomatico/maplibre-cog-protocol` | `registerCOGProtocol()` and `cog://` sources |

```bash
npm install geotiff          # only when decoding COGs in the browser
```

Invoking a capability without its optional peer raises a diagnostic error naming
the package to install, rather than a module-resolution failure.

## Stylesheet

Packages that render interface elements — `ui`, `geo-legend`, `geo-hover`,
`timeline-control`, `map-controls` — depend on a single stylesheet, imported
once at the application entry point:

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
import '@hridayanp/ui/styles.css';
```

Layer packages (`raster-layer`, `vector-layer`, `wind-particle-layer`) render no
DOM and require no stylesheet.

> **Note:** The stylesheet is plain CSS scoped to a `gcl-` class namespace and
> parameterised entirely through CSS custom properties. No build configuration,
> preprocessor or runtime style injection is required, and the namespace
> prevents bidirectional style leakage with application styles. See
> [Theming](/docs/theming).

## Runtime requirements

| Requirement | Detail |
| --- | --- |
| React | 18.2 or 19; both are within every package's peer range |
| MapLibre GL JS | 4 or 5. Version-dependent behaviour (`preserveDrawingBuffer` placement, `setProjection`) is handled defensively |
| WebGL2 | Required by `wind-particle-layer`; the remainder of the library renders on WebGL1 |
| Bundler | Must honour the `exports` field: Vite, webpack 5, Rollup, esbuild, Parcel 2 and Next.js all qualify |

## Distributed artefacts

Each package publishes dual module formats with matching declarations:

```text
dist/index.js      ES module
dist/index.cjs     CommonJS
dist/index.d.ts    Type declarations (ESM resolution)
dist/index.d.cts   Type declarations (CJS resolution)
```

`sideEffects: false` is declared on every package except `@hridayanp/ui`, which
declares `["*.css"]` so that its stylesheet survives tree-shaking. Unused
exports are therefore eliminated by any bundler that performs
dead-code analysis.

## Verifying dependency resolution

```bash
npm ls react
npm ls maplibre-gl
npm ls @deck.gl/core
```

Each command must report exactly one resolved version. Duplicate instances of
these runtimes are the most frequent cause of a non-rendering map and fail
silently at runtime — see [Invariants](/docs/invariants).
