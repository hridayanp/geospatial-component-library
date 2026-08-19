# Geospatial Component Library

A modular, API-independent React component library for map visualisation,
published as `@hridayanp/*` packages.

Each package does one thing, receives all of its data through props, and can be
installed on its own or composed with the others.

There is no application in here. No routes, no store, no API client, no
authentication, no dashboard. A host application owns data retrieval and
business logic; these packages own rendering.

---

## Packages

| Package | Responsibility |
| --- | --- |
| [`@hridayanp/map-container`](packages/map-container) | MapLibre map, camera, and the React context layers attach to |
| [`@hridayanp/raster-layer`](packages/raster-layer) | Generic raster visualisation with zero-blink frame updates |
| [`@hridayanp/vector-layer`](packages/vector-layer) | Generic GeoJSON layer for every geometry type |
| [`@hridayanp/wind-particle-layer`](packages/wind-particle-layer) | GPU-animated flow particles (deck.gl + WeatherLayers GL) |
| [`@hridayanp/geo-legend`](packages/geo-legend) | Continuous and classed legends |
| [`@hridayanp/geo-hover`](packages/geo-hover) | Feature picking, raster probing, portalled readout card |
| [`@hridayanp/timeline-control`](packages/timeline-control) | Frame playback for animated layers |
| [`@hridayanp/map-controls`](packages/map-controls) | Zoom, reset view, fullscreen, opacity, basemap |
| [`@hridayanp/deck-overlay`](packages/deck-overlay) | Bridges deck.gl layers onto a MapLibre map |
| [`@hridayanp/raster-utils`](packages/raster-utils) | Raster maths: stats, ramps, colourisation, sampling, GeoTIFF |
| [`@hridayanp/geo-utils`](packages/geo-utils) | Bounds, geodesy, GeoJSON helpers — zero dependencies |
| [`@hridayanp/ui`](packages/ui) | Shared primitives and the one stylesheet |

---

## Quick start

```bash
npm install @hridayanp/map-container @hridayanp/raster-layer maplibre-gl react react-dom
```

```tsx
import 'maplibre-gl/dist/maplibre-gl.css';
import '@hridayanp/ui/styles.css';

import { MapContainer } from '@hridayanp/map-container';
import { RasterLayer } from '@hridayanp/raster-layer';
import { VectorLayer } from '@hridayanp/vector-layer';
import { WindParticleLayer } from '@hridayanp/wind-particle-layer';
import { GeoLegend } from '@hridayanp/geo-legend';
import { GeoHover } from '@hridayanp/geo-hover';
import { TimelineControl } from '@hridayanp/timeline-control';
import { MapControlBar, ZoomControl } from '@hridayanp/map-controls';

<MapContainer center={[92, 25.5]} zoom={6} style={{ height: 520 }}>
  <RasterLayer data={raster} colorScale={palette} min={0} max={100} opacity={0.8} />
  <VectorLayer data={boundaries} fill={false} stroke="#94a3b8" />
  <WindParticleLayer data={{ kind: 'field', u, v, width, height, bounds }} />

  <GeoLegend title="Intensity" colorScale={palette} min={0} max={100} placement="bottom-right" />
  <TimelineControl frames={frames} index={index} onIndexChange={setIndex} placement="bottom-center" />
  <MapControlBar><ZoomControl /></MapControlBar>
  <GeoHover raster={raster} unit="mm" />
</MapContainer>
```

Layers attach themselves through the map context, so composition is nothing more
than nesting.

---

## Architecture

```
Host application
  → supplies data and configuration through props
        ↓
  @hridayanp/map-container
        ↓
  ├── @hridayanp/raster-layer ──── @hridayanp/raster-utils
  ├── @hridayanp/vector-layer
  ├── @hridayanp/wind-particle-layer ── @hridayanp/deck-overlay
  ├── @hridayanp/geo-hover
  ├── @hridayanp/geo-legend
  ├── @hridayanp/map-controls
  └── @hridayanp/timeline-control
                 ↑
        @hridayanp/geo-utils  ·  @hridayanp/ui
```

Principles the codebase actually holds to:

- **Props in, callbacks out.** No component fetches, transforms or retrieves
  business data. Where a generic GIS component legitimately takes a URL (a
  Cloud-Optimised GeoTIFF), the host supplies a URL it has already authorised —
  the library owns no auth, no signing and no retry policy.
- **No application state.** No Redux, no persisted store, no `localStorage`, no
  URL state. React context appears in exactly one place: `map-container`, so
  layers can find the map they are inside.
- **One capability per package.** A raster layer does not require the wind
  layer. A legend works with no map at all.
- **Generalise, don't rename.** Per-variable layers were consolidated into one
  generic layer whose differences are props, not into a dozen renamed
  components.
- **Peer dependencies for the heavy things.** React, MapLibre, deck.gl and
  WeatherLayers are never bundled into a package.

---

## Development

```bash
npm install
npm run dev          # docs site on :3000 + Storybook on :6006 — the dev loop
npm run build        # tsup: ESM + CJS + .d.ts for every package, then both apps
npm run typecheck    # tsc --noEmit, strict, across the workspace
```

`npm run dev` starts both applications in parallel:

| Port | App | What it is |
| --- | --- | --- |
| `3000` | `apps/docs` | The documentation site — architecture, guides, per-package reference |
| `6006` | `apps/storybook` | Interactive examples with live controls |

Run them individually with `npm run dev:docs` and `npm run dev:storybook`. The
docs site links across to Storybook: `/storybook` redirects to the Storybook
landing page, and each package page has a button through to its stories.

`npm run dev:packages` runs `tsup --watch` across all twelve packages, for when
you are consuming them from a separate project. You do not need it for normal
development — both apps alias `@hridayanp/*` to package source.

The workspace is npm workspaces + Turborepo. Each package builds independently
with `tsup` and is publishable on its own.

Turbo requires the `packageManager` field in the root `package.json` to know
which binary to invoke — it is set to npm. Removing it produces
`Could not resolve workspace`.

Both apps alias `@hridayanp/*` to package **source**, so an edit under
`packages/<name>/src` hot-reloads in each of them rather than requiring a
rebuild, and neither app needs the packages built first. Consumers still resolve
the built entry points declared in each `package.json`.

To work on one package in isolation:

```bash
npm run dev --workspace @hridayanp/raster-layer      # tsup --watch
npm run build --workspace @hridayanp/raster-layer
```

### Verifying a change

```bash
npm run build && npm run typecheck
node smoke.mjs         # renders 22 Storybook stories in headless Chromium
node smoke-docs.mjs    # renders the home page and all 28 doc routes
```

Both smoke tests exist because a type-check proves the code compiles — not that
a MapLibre map initialises, that deck.gl gets a WebGL context, or that a layer
attaches without throwing. They fail on any uncaught error, page error or React
warning; `smoke-docs.mjs` additionally fails on a registered page whose content
file is missing.

---

## Publishing

```bash
npm run build
npm publish --workspaces --access public
```

`--workspaces` skips `apps/storybook` and `apps/docs`, both `private: true`.

Local workspace dependencies are plain semver ranges (`^0.1.0`), not
`workspace:*`, so a published manifest is already correct — nothing is
rewritten at pack time.

Every package ships ESM, CJS and type declarations, declares its exports map
explicitly, and exposes only its public surface.

---

## Documentation

Documentation is two applications that link into each other.

**`apps/docs` — the written documentation** (`npm run dev:docs`, port 3000).
Twenty-eight pages across five sections: Getting Started, Architecture,
Packages, Guides and Reference. Everything in this README plus repository
anatomy, the dependency graph, runtime flow, the build system, a page per
package, publishing, adding a package, verification, invariants and
troubleshooting. Sidebar navigation, `Cmd`+`K` search, a per-page table of
contents, light and dark themes, and a live map on the home page rendered by the
real packages.

Every page that documents something with stories carries a button through to the
matching Storybook section, and the header has one to Storybook's landing page.
`/storybook` redirects there directly.

**`apps/storybook` — the interactive documentation** (`npm run dev:storybook`,
port 6006). Every public component with live controls, covering basic usage,
each significant prop, edge cases (empty data, NoData rasters, single-frame
timelines) and performance-sensitive configurations. Organised by capability:

```
Geospatial/        Map Container · Raster Layer · Vector Layer · Wind Particle Layer
Overlays/          Geo Legend · Geo Hover · Timeline Control · Map Controls
Utilities/         Raster Utilities · Geo Utilities
Composition Examples/
```

Every value shown in either app is generated in the browser —
`apps/storybook/stories/demo/data.ts` and `apps/docs/src/components/HeroMap.tsx`.
That is deliberate: if the documentation needed a backend, the library would too.

### Building and deploying the docs

```bash
npm run build          # builds every package, Storybook, then the docs site
```

`apps/docs`'s build step copies `apps/storybook/storybook-static` into
`apps/docs/dist/storybook`, so `apps/docs/dist` is a single static directory
serving the documentation at `/` and Storybook at `/storybook` from one origin.
Any static host works; the site needs an SPA fallback to `index.html`.

Deploying them to separate origins instead is one environment variable:

```bash
VITE_STORYBOOK_URL=https://storybook.example.com npm run build:docs
```

### Adding a documentation page

Two steps. Drop a `.md` file in `apps/docs/src/content/`, and add an entry to
`PAGES` in `apps/docs/src/site.ts`. The sidebar, router, search, prev/next
navigation, the `npm install` block and the Storybook link are all derived from
that entry. In development the app warns in the console about any registered
page with no content file.

---

## License

MIT
