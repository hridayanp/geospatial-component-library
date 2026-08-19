Eight steps from empty folder to a package that builds, type-checks, renders in
Storybook and appears in these docs. Nothing is generated — the shape is small
enough to copy.

The fastest start is copying `packages/vector-layer` and deleting its
implementation. Everything below explains what you are copying.

## 1. The folder

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
  "description": "Density heatmap layer for point data.",
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

> **Warning:** React, MapLibre, deck.gl and WeatherLayers go in
> `peerDependencies` — never `dependencies`. A second copy of any of them in a
> consumer's bundle fails at runtime with no build error. Add the same package to
> `devDependencies` so your own build can resolve it.

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
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: [
    'react',
    'react-dom',
    'maplibre-gl',
    '@hridayanp/geo-utils',
    '@hridayanp/map-container',
  ],
});
```

`external` must list **every** peer and every `@hridayanp/*` dependency. A missing
entry inlines that package into your bundle — which is exactly how a consumer
ends up with two copies of MapLibre.

This is the most common mistake when adding a package, and it produces a build
that succeeds and a map that never appears.

## 5. The component

Attach through the context, and let `useMapSourceLayers` do the reconciliation:

```tsx
import { useMapSourceLayers } from '@hridayanp/map-container';
import { toFeatureCollection } from '@hridayanp/geo-utils';

export function HeatmapLayer({
  id = 'gcl-heatmap',
  data,
  radius = 30,
  intensity = 1,
  beforeId,
}: HeatmapLayerProps) {
  const collection = useMemo(() => toFeatureCollection(data), [data]);

  useMapSourceLayers({
    sourceId: `${id}-src`,
    source: { type: 'geojson', data: collection },
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

Four things that make it behave like the rest of the library:

- **Returns `null`.** A map layer is not DOM. Only overlays render elements.
- **`useMapSourceLayers`** handles in-place updates, teardown order and
  re-attaching after a basemap swap. Calling `map.addLayer` yourself means
  re-implementing all three.
- **`toFeatureCollection`** normalises whatever GeoJSON shape the host has.
- **`beforeId`** so a consumer can place it under labels.

Read [Design Principles](/docs/principles) before you add a prop. The rule that
matters most: no fetching, no auth, no application state.

## 6. `src/index.ts`

```ts
export { HeatmapLayer } from './HeatmapLayer';
export type { HeatmapLayerProps } from './types';
```

The `exports` map seals everything else, so this file **is** the public API. Be
deliberate about what leaves it.

## 7. Wire it up

```bash
npm install                       # from the root — links the new workspace
npm run build                     # should include your package, in order
npm run typecheck
```

No Turborepo configuration is needed; the workspace glob `packages/*` picks it
up and `dependsOn: ["^build"]` orders it automatically.

Add source aliases so both apps compile it from `src` with hot reload:

```ts
// apps/docs/vite.config.ts and apps/storybook/.storybook/main.ts
sourceAlias('heatmap-layer'),
```

Anchored `^…$`, like the others — an unanchored `map-container` pattern also
matches `map-controls`.

## 8. Stories and docs

**`apps/storybook/src/stories/HeatmapLayer.stories.tsx`**

```tsx
const meta: Meta<typeof HeatmapLayer> = {
  title: 'Geospatial/Heatmap Layer',
  component: HeatmapLayer,
  tags: ['autodocs'],
  argTypes: {
    // Expression-valued props need an explicit control, or Storybook
    // infers a colour picker and throws on a non-string value.
    color: { control: 'object' },
  },
};
```

Generate story data in the story file. Never fetch — Storybook must render
offline, and `smoke.mjs` runs every story in a headless browser with no network.

**This site.** Add an entry to `PAGES` in `apps/docs/src/site.ts`:

```ts
{
  slug: 'heatmap-layer',
  title: 'heatmap-layer',
  group: 'Packages',
  description: 'Density heatmap layer for point data.',
  storybook: 'geospatial-heatmap-layer',
  npm: '@hridayanp/heatmap-layer',
},
```

Then create `apps/docs/src/content/heatmap-layer.md`. The sidebar, search,
prev/next navigation, the `npm install` block and the "Live examples in
Storybook" button all derive from that registry entry — nothing else to wire.

The `storybook` field is the docs id Storybook derives from the story title:
lowercase, non-alphanumerics to hyphens. `Geospatial/Heatmap Layer` →
`geospatial-heatmap-layer`.

In development the docs app warns in the console about any registered page with
no content file.

## Verify

```bash
npm run build            # your package builds, in dependency order
npm run typecheck
npm run build-storybook
node smoke.mjs           # every story renders clean
npm pack --workspace @hridayanp/heatmap-layer --dry-run
```

The last one should list `dist/` and `README.md` and nothing else.

## Does it need to be a package?

Before any of this — a new package is justified when it introduces a **new heavy
dependency** (deck.gl earned `deck-overlay`), or when it is genuinely useful on
its own.

A variation on existing behaviour is a prop. Six per-variable raster components
became one `RasterLayer` with a `colorScale` prop, and that consolidation is the
core idea of this library.
