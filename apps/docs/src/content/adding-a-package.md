Eight steps from an empty directory to a package that builds, type-checks,
renders in Storybook and appears in this documentation. Nothing is generated;
the structure is small enough to copy.

The fastest starting point is duplicating `packages/vector-layer` and removing
its implementation. The steps below describe what that structure contains.

## 0. Establish that it should be a package

Evaluate the proposal against [Design Principles](/docs/principles) first. A new
package is justified when it introduces a **new heavy dependency** — deck.gl
justified `deck-overlay` — or when the capability is genuinely useful in
isolation.

A variation on existing behaviour is a prop. Six variable-specific raster
components became one `RasterLayer` with a `colorScale` prop, and that
consolidation is the organising idea of the library.

## 1. Directory structure

```text
packages/heatmap-layer/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md
└── src/
    ├── index.ts
    ├── HeatmapLayer.tsx
    └── types.ts
```

## 2. `package.json`

```jsonc
{
  "name": "@hridayanp/heatmap-layer",
  "version": "0.1.0",
  "description": "Kernel density heatmap layer for point observations.",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist .turbo"
  },
  "publishConfig": { "access": "public" },
  "dependencies": {
    "@hridayanp/geo-utils": "^0.1.0",
    "@hridayanp/map-container": "^0.1.0"
  },
  "peerDependencies": {
    "react": "^18.2.0 || ^19.0.0",
    "maplibre-gl": "^4.0.0 || ^5.0.0"
  },
  "devDependencies": {
    "maplibre-gl": "^5.24.0"
  }
}
```

> **Warning:** React, MapLibre, deck.gl and WeatherLayers belong in
> `peerDependencies`, never in `dependencies`. A second resolution of any of
> them in a consumer's bundle fails at runtime with no build diagnostic. Declare
> the same package in `devDependencies` so the local build resolves it.

## 3. `tsconfig.json`

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src"]
}
```

## 4. `tsup.config.ts`

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  target: 'es2022',
  external: [
    'react',
    'react-dom',
    'maplibre-gl',
    '@hridayanp/geo-utils',
    '@hridayanp/map-container',
  ],
});
```

`external` must enumerate **every peer dependency and every workspace
dependency**. An omitted entry causes tsup to inline that module — which is
precisely how a consumer acquires a second copy of MapLibre.

This is the most frequent error when adding a package, and it produces a build
that succeeds and a map that never appears.

## 5. The component

Resolve the map through context, and delegate reconciliation to
`useMapSourceLayers`:

```tsx
import { useMemo } from 'react';
import { useMapSourceLayers } from '@hridayanp/map-container';
import { toFeatureCollection } from '@hridayanp/geo-utils';
import type { HeatmapLayerProps } from './types';

export function HeatmapLayer({
  id = 'gcl-heatmap',
  data,
  radius = 30,
  intensity = 1,
  visible = true,
  beforeId,
}: HeatmapLayerProps) {
  const collection = useMemo(() => toFeatureCollection(data), [data]);

  useMapSourceLayers({
    sourceId: `${id}-src`,
    source: visible && collection
      ? { type: 'geojson', data: collection }
      : null,
    layers: [
      {
        id: `${id}-heat`,
        type: 'heatmap',
        paint: {
          'heatmap-radius': radius,
          'heatmap-intensity': intensity,
        },
      },
    ],
    beforeId,
  });

  return null;
}
```

Four properties make this consistent with the rest of the library:

- **Returns `null`.** A map layer is not DOM. Only overlay components render
  elements.
- **`useMapSourceLayers`** handles in-place updates, teardown ordering and
  re-registration after a style reload. Calling `map.addLayer` directly means
  re-implementing all three.
- **`toFeatureCollection`** normalises whichever GeoJSON shape the host holds.
- **`beforeId`** allows a consumer to place the layer beneath basemap labels.

Passing `source: null` is how `visible={false}` detaches without unmounting.

## 6. `src/index.ts`

```ts
export { HeatmapLayer } from './HeatmapLayer';
export type { HeatmapLayerProps } from './types';
```

The `exports` map seals everything else, so this file **is** the public API. Be
deliberate about what leaves it.

## 7. Wire the workspace

```bash
npm install                       # from the root; links the new workspace
npm run build                     # the package appears, in dependency order
npm run typecheck
```

No Turborepo configuration is required: the `packages/*` workspace glob matches
it and `dependsOn: ["^build"]` orders it automatically.

Add source aliases so both applications compile it from source with hot reload:

```ts
// apps/docs/vite.config.ts and apps/storybook/.storybook/main.ts
sourceAlias('heatmap-layer'),
```

Anchored `^…$`, consistent with the others.

## 8. Stories and documentation

**`apps/storybook/stories/HeatmapLayer.stories.tsx`**

```tsx
const meta: Meta<typeof HeatmapLayer> = {
  title: 'Geospatial/Heatmap Layer',
  component: HeatmapLayer,
  tags: ['autodocs'],
  argTypes: {
    // Expression-valued props require an explicit control; Storybook's
    // inference assigns a colour picker and rejects a non-string value.
    color: { control: 'object' },
  },
};
```

Generate story data within the story file. Stories must render offline, and
`smoke.mjs` executes every story in a headless browser with no network access.

**This site.** Add an entry to `PAGES` in `apps/docs/src/site.ts`:

```ts
{
  slug: 'heatmap-layer',
  title: 'heatmap-layer',
  group: 'Packages',
  description: 'Kernel density heatmap rendering for point observations.',
  storybook: 'geospatial-heatmap-layer',
  npm: '@hridayanp/heatmap-layer',
},
```

Then create `apps/docs/src/content/heatmap-layer.md`. The sidebar, search,
previous/next navigation, the install command and the Storybook link are all
derived from that entry; nothing further is wired by hand.

The `storybook` field is the docs identifier Storybook derives from the story
title: lowercased, with non-alphanumeric characters replaced by hyphens.
`Geospatial/Heatmap Layer` becomes `geospatial-heatmap-layer`.

In development the documentation application reports, in the console, any
registered page without a corresponding content file.

## Verification

```bash
npm run build            # builds in dependency order
npm run typecheck
npm run build-storybook
node smoke.mjs           # every story renders without error
node smoke-docs.mjs      # every documentation route renders
npm pack --workspace @hridayanp/heatmap-layer --dry-run
```

The final command should list `dist/` and `README.md` and nothing else.
