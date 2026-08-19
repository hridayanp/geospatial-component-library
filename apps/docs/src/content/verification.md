Four verification stages, ordered by what each can detect. The last two are the
only ones that establish that a map actually renders.

```bash
npm run typecheck        # does it compile?
npm run build            # does it bundle, with coherent declarations?
npm run build-storybook  # does the full application build?
node smoke.mjs           # does it render in a browser?
node smoke-docs.mjs      # does the documentation render?
```

## 1. Type checking

```bash
npm run typecheck
```

`tsc --noEmit` across every workspace, in dependency order.

`dependsOn: ["^build"]` means a package's dependencies are built first, so
`raster-layer` is checked against the **emitted declarations** of `geo-utils`
rather than its source. This detects a class of defect that source-to-source
checking conceals: a type exported internally but absent from `index.ts`, or a
type that does not survive declaration bundling.

The base configuration is `strict`, with `noUnusedLocals`, `noUnusedParameters`,
`noImplicitOverride`, `isolatedModules` and `verbatimModuleSyntax`.

## 2. Build

```bash
npm run build
```

Every workspace: twelve `tsup` builds plus the two applications, dependency
ordered and cached.

Per package this emits `dist/index.js` (ESM), `dist/index.cjs` (CJS),
`dist/index.d.ts`, `dist/index.d.cts` and source maps.

What the build detects that type checking does not:

- A dependency omitted from `tsup`'s `external` array. The build succeeds and
  silently inlines MapLibre, so a consumer resolves two copies.
- A circular import between packages, reported by Turborepo as a cycle in the
  task graph.
- A type that cannot be flattened into a single declaration file.

Inspect bundle contents when something appears wrong:

```bash
ls -la packages/raster-layer/dist
grep -c "maplibre" packages/raster-layer/dist/index.js   # import statements only
```

### Cache behaviour

Turborepo hashes each task against its declared `inputs`. A no-op rebuild
replays from cache and reports `FULL TURBO`. When a change appears to be
ignored, the input globs are the place to look — a file outside the declared
globs is not part of the hash.

```bash
npx turbo run build --force
```

## 3. Storybook build

```bash
npm run build-storybook
```

Emits `apps/storybook/storybook-static`. This is both a verification — every
story compiles and every import resolves — and the input to the next stage.

The documentation build copies this directory into `apps/docs/dist/storybook`,
so a full production build necessarily runs Storybook first. See
[Build System](/docs/build-system).

## 4. Headless render verification

```bash
node smoke.mjs        # 22 Storybook stories
node smoke-docs.mjs   # the landing page and every documentation route
```

These are the stages that matter.

Static type checking establishes that the code compiles. It does not establish
that a MapLibre map initialises, that deck.gl acquires a WebGL2 context, that an
image source accepts a data URL, or that a layer attaches without throwing.
Every one of those is a runtime property, and every one has failed in this
codebase at some point while `tsc` reported success.

Each script serves the built output over a local HTTP server, opens every route
in headless Chromium, and fails on **any** uncaught exception, page error or
React warning. `smoke-docs.mjs` additionally fails on a registered page whose
article body renders empty, which is how a missing content file presents.

```text
✓ geospatial-map-container--basic
✓ geospatial-raster-layer--basic
✓ geospatial-wind-particle-layer--basic
…
22/22 stories rendered cleanly
```

### Environment configuration

Two paths near the top of each script are environment-specific:

```js
const PLAYWRIGHT = '/path/to/playwright/index.js';
const CHROME     = '/path/to/chromium';
```

Adjust them to a local Playwright installation, or replace the `require` with
`import { chromium } from 'playwright'` after `npm i -D playwright`.

WebGL in headless Chromium is served by SwiftShader — software rasterisation.
It is slow, but it exercises the real code path, which is the objective.

### Why warnings fail the run

React warnings in a map codebase are rarely cosmetic. "Cannot update a component
while rendering a different component" and "Can't perform a React state update
on an unmounted component" both indicate an effect firing against a map that is
being torn down — which in production presents as a layer failing to re-register
after a style reload.

Treating warnings as failures is how those defects are caught before they become
intermittent.

### Defects previously caught

Two examples, both of which passed type checking:

- **`Unable to perform style diff: Style is not done loading`** — the style
  synchronisation effect called `setStyle` with the same specification the
  constructor had already applied. Resolved with a ref that short-circuits the
  redundant call.
- **`Control of type color only supports string, received 'other'`** —
  Storybook's global colour matcher assigned colour pickers to props whose
  values are MapLibre expressions or `[r, g, b, a]` tuples. Resolved by removing
  the matcher and declaring explicit `argTypes`.

## Manual verification

Automation does not cover perceptual behaviour:

- **Frame transitions.** Play a raster sequence. Any visible flash indicates
  double buffering is not operating — see
  [`raster-layer`](/docs/raster-layer#double-buffering).
- **Style reload.** Change the basemap with layers mounted. Every layer must
  re-register.
- **Resize.** Drag a split pane, collapse a panel. The canvas must follow.
- **Both colour schemes.** Toggle `data-gcl-theme` between light and dark.
- **Keyboard interaction.** Tab to a slider and a popover. Radix handles this,
  but a wrapper can break it.
- **Strict Mode.** Development invokes effects twice. Protocol registration and
  layer attachment must be idempotent.

## Pre-release sequence

```bash
npm run clean
npm install
npm run build
npm run typecheck
npm run build-storybook
node smoke.mjs
node smoke-docs.mjs
npm pack --workspace @hridayanp/raster-layer --dry-run
```

The clean install is material: it is the only way to detect a dependency that
resolves locally because something else happens to hoist it.

## Unit test coverage

There is currently none, which is a genuine gap rather than a decision.

The appropriate starting point is [`geo-utils`](/docs/geo-utils) and
[`raster-utils`](/docs/raster-utils): pure functions over plain data, with no
React, no DOM and no browser. Extent algebra, compass parsing, UV conversion,
statistics and sampling are all directly testable, and they are the code the
remaining packages depend on most heavily.

The React packages require a browser to be meaningful, and are therefore better
served by headless render verification than by a jsdom harness that stubs out
WebGL.
