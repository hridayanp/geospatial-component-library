Install only the packages you use. Every package declares the heavy runtimes as
peer dependencies, so nothing gets bundled twice.

## The common case

A map with a raster layer:

```bash
npm install @hridayanp/map-container @hridayanp/raster-layer \
  maplibre-gl react react-dom
```

Add layers as you need them:

```bash
npm install @hridayanp/vector-layer
npm install @hridayanp/geo-legend @hridayanp/geo-hover
npm install @hridayanp/timeline-control @hridayanp/map-controls
```

## Wind particles need more

The particle layer runs on deck.gl and WeatherLayers GL, so it brings the
largest peer set in the library:

```bash
npm install @hridayanp/wind-particle-layer @hridayanp/map-container \
  maplibre-gl weatherlayers-gl \
  @deck.gl/core @deck.gl/mapbox @deck.gl/extensions @deck.gl/layers
```

`@deck.gl/layers` is required by `weatherlayers-gl` itself, not by this library
directly — but npm will warn about the missing peer if you leave it out.

## Optional peers

These are only needed for specific features, and are imported lazily so you
never pay for them otherwise:

| Package | Needed for |
| --- | --- |
| `geotiff` | `decodeGeoTIFF()`, and `<RasterLayer data={{ kind: 'geotiff' }}>` |
| `pmtiles` | `registerPMTilesProtocol()` and `pmtiles://` sources |
| `@geomatico/maplibre-cog-protocol` | `registerCOGProtocol()` and `cog://` sources |

```bash
npm install geotiff          # only if you decode COGs in the browser
```

Call a feature without its peer and you get a clear thrown message naming the
package to install — not a module-not-found stack trace.

## The stylesheet

Any package that renders UI — legend, hover card, timeline, controls — needs one
stylesheet, imported **once** anywhere in your application:

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
import '@hridayanp/ui/styles.css';
```

Layer packages (`raster-layer`, `vector-layer`, `wind-particle-layer`) render
nothing to the DOM and need no CSS at all.

> **Note:** The stylesheet is plain CSS with a `gcl-` class namespace and CSS
> custom properties. There is no Tailwind, no PostCSS plugin and no runtime
> style injection — and the library physically cannot leak styles into your own
> components. See [Theming](/docs/theming).

## Requirements

- **React 18.2+ or 19.** Both are supported by every package's peer range.
- **MapLibre 4 or 5.** Version-specific behaviour (the `preserveDrawingBuffer`
  option, `setProjection`) is handled defensively.
- **WebGL2**, for the wind particle layer specifically. There is no canvas
  fallback; everything else works on WebGL1.
- **A bundler that reads `exports`.** Vite, webpack 5, Rollup, esbuild, Parcel 2
  and Next.js all do.

## Module formats

Every package ships ESM and CJS with matching type declarations:

```text
dist/index.js      ESM
dist/index.cjs     CJS
dist/index.d.ts    types for ESM
dist/index.d.cts   types for CJS
```

`sideEffects: false` is declared on all packages except `ui` (which declares
`["*.css"]`), so a bundler can drop anything you do not import.

## Verifying the install

```bash
npm ls react          # exactly one entry
npm ls maplibre-gl    # exactly one entry
```

Two copies of either is the single most common cause of a broken map — see
[Invariants](/docs/invariants).
