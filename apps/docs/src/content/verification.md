Four checks, in increasing order of what they can catch. The last one is the only
one that proves a map actually renders.

```bash
npm run typecheck        # does it compile?
npm run build            # does it bundle, with correct types?
npm run build-storybook  # does the whole app build?
node smoke.mjs           # does it actually render in a browser?
```

## 1. Typecheck

```bash
npm run typecheck
```

`tsc --noEmit` across every workspace, in dependency order. Expect **15 tasks**
— twelve packages plus two apps plus the root.

`dependsOn: ["^build"]` means a package's dependencies are built first, so
`raster-layer` type-checks against the real generated `.d.ts` of `geo-utils`,
not its source. That catches a class of error that checking source-to-source
hides: a type that is exported internally but not from `index.ts`, or a type
that does not survive declaration bundling.

The base config is `strict`, plus `noUncheckedIndexedAccess` — which is why
array access in this codebase is guarded rather than asserted.

## 2. Build

```bash
npm run build
```

Expect **15 tasks**: twelve `tsup` builds, Storybook, the docs site, and the root
passthrough.

Per package this produces `dist/index.js` (ESM), `dist/index.cjs` (CJS),
`dist/index.d.ts` and source maps.

What it catches that typecheck does not:

- A dependency missing from `tsup`'s `external` array — the build succeeds but
  silently inlines MapLibre, and a consumer gets two copies.
- A circular import between packages, which Turbo reports as a cycle in the task
  graph.
- A type that cannot be bundled into a single declaration file.

Check bundle contents when something looks wrong:

```bash
ls -la packages/raster-layer/dist
grep -c "maplibre" packages/raster-layer/dist/index.js   # should be import lines only
```

### Cache

Turbo hashes each task's declared `inputs`. A no-op rebuild replays from cache
and prints `FULL TURBO`. If a change seems ignored, the input globs are the place
to look — anything outside `src/**`, `tsup.config.ts`, `tsconfig.json` and
`package.json` is not part of the hash.

```bash
npx turbo run build --force
```

## 3. Build Storybook

```bash
npm run build-storybook
```

Writes `apps/storybook/storybook-static`. This is both a check — every story
compiles, every import resolves — and the input to the next step.

The docs site's own build copies this directory into `apps/docs/dist/storybook`,
so a full production build runs Storybook first. See
[Build System](/docs/build-system).

## 4. The smoke test

```bash
node smoke.mjs
```

This is the check that matters.

A type-check proves the code compiles. It does not prove that a MapLibre map
initialises, that deck.gl obtains a WebGL context, that an image source accepts
a data URL, or that a layer attaches without throwing. Every one of those is a
runtime concern, and every one of them has broken in this codebase at some point
while `tsc` was perfectly happy.

`smoke.mjs` serves the built Storybook over a local HTTP server, opens each story
in headless Chromium, and fails on **any** uncaught exception, page error or
React warning.

```text
✓ geospatial-map-container--basic
✓ geospatial-raster-layer--basic
✓ geospatial-wind-particle-layer--basic
…
22/22 stories rendered clean
```

### Configuring it

Two paths near the top are environment-specific:

```js
const { chromium } = require('/path/to/playwright/index.js');
// and, in the launch options
executablePath: '/path/to/chromium'
```

Change them to your own Playwright installation, or replace both with a plain
`import { chromium } from 'playwright'` after `npm i -D playwright`.

WebGL in headless Chromium runs through SwiftShader — software rendering. Slow,
but it exercises the real code path, which is the point.

### Why warnings fail the run

React warnings in a map codebase are almost never cosmetic. "Cannot update a
component while rendering a different component" and "Can't perform a React state
update on an unmounted component" both mean an effect is firing against a map
that is being torn down — which in production shows up as a layer that fails to
re-attach after a basemap swap.

Treating them as failures is how those get caught before they become
intermittent.

### What it caught, historically

Two real examples, both of which passed typecheck:

- **`Unable to perform style diff: Style is not done loading`** — the style-sync
  effect called `setStyle` with the same style the constructor had already used.
  Fixed with a ref that short-circuits a redundant call.
- **`Control of type color only supports string, received 'other'`** —
  Storybook's global `color` matcher auto-assigned colour pickers to props whose
  values are MapLibre expressions or `[r,g,b,a]` tuples. Fixed by removing the
  matcher and setting explicit `argTypes`.

## Manual checks worth doing

Automation does not cover everything visual:

- **Zero-blink transitions.** Play a raster timeline. Any flash between frames
  means double buffering is not working — see
  [`raster-layer`](/docs/raster-layer#why-two-buffers).
- **Basemap swap.** Change the basemap with layers mounted. Everything must
  re-attach.
- **Resize.** Drag a split pane, collapse a panel. The canvas must follow.
- **Both themes.** Toggle `data-gcl-theme` between light and dark.
- **Keyboard.** Tab to a slider and a popover; Radix handles this, but a wrapper
  can break it.
- **Strict Mode.** Development runs effects twice. Protocol registration and
  layer attachment must be idempotent.

## Before a release

```bash
npm run clean
npm install
npm run build
npm run typecheck
npm run build-storybook
node smoke.mjs
npm pack --workspace @hridayanp/raster-layer --dry-run
```

The clean install matters: it is the only way to catch a dependency that
resolves locally because something else happens to hoist it.

## No unit tests yet

There are none, and that is a real gap rather than a decision.

The place to start is [`geo-utils`](/docs/geo-utils) and
[`raster-utils`](/docs/raster-utils) — pure functions over plain data, no React,
no DOM, no browser. Bounds maths, compass parsing, UV conversion, statistics and
sampling are all directly testable, and they are the code most other packages
depend on.

The React packages need a browser to mean anything, so they are better served by
the smoke test than by a jsdom harness that stubs out WebGL.
