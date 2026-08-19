Turborepo orchestrates, tsup compiles, and the `exports` map seals the result.

## The task graph

```jsonc
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsup.config.ts", "tsconfig.json", "package.json"],
      "outputs": ["dist/**", "storybook-static/**"]
    },
    "typecheck": { "dependsOn": ["^build"], "inputs": ["src/**", "tsconfig.json"] },
    "dev":       { "cache": false, "persistent": true },
    "clean":     { "cache": false }
  }
}
```

`^build` reads each package's `dependencies` to derive order. You never maintain
a build list — adding a package with correct dependencies slots it in.

`inputs` and `outputs` drive content-addressed caching. Change a README and
Turbo replays the cached build in about 50 ms and prints `>>> FULL TURBO`.
Change a source file and it rebuilds that package and everything downstream of
it, and nothing else.

## Per-package tsup config

```ts
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
  external: ['react', 'maplibre-gl', '@hridayanp/geo-utils', /* … */],
});
```

> **Warning:** `external` must list **every peer and every workspace
> dependency**. Miss one and tsup inlines it — you would ship four copies of the
> compass table, and the shared-instance guarantee for React or MapLibre would
> be gone.

`dts: true` runs a separate rollup pass that flattens all the types into one
`.d.ts`, so a consumer gets a single declaration file rather than a tree of
internal ones.

`splitting: false` because a library entry point with one module has nothing to
split, and chunks would only complicate the published layout.

## What ships

```text
packages/raster-layer/dist/
├── index.js         ESM
├── index.js.map
├── index.cjs        CJS
├── index.cjs.map
├── index.d.ts       types for the ESM entry
└── index.d.cts      types for the CJS entry
```

`@hridayanp/ui` has one extra step, because tsup does not copy CSS:

```jsonc
"build": "tsup && cp src/styles.css dist/styles.css"
```

## The exports map

```jsonc
{
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
  "files": ["dist", "README.md"]
}
```

Three things are doing work here:

**`exports` seals the package.** A consumer can import `@hridayanp/raster-layer`
and nothing else. No one can reach into `dist/internal/whatever` and then break
when you refactor. `main`, `module` and `types` remain for tooling that predates
`exports`.

**`sideEffects: false`** is what lets a bundler drop unused exports. Importing
only `RasterLayer` does not pull in `preloadRasterFrame` or `RasterFrameCache`.
`ui` declares `["*.css"]` instead, so its stylesheet survives tree-shaking.

**`files`** keeps `src/`, configs and tests out of the tarball. Verify with
`npm publish --dry-run`.

## Workspace dependency ranges

Local dependencies are plain semver, not `workspace:*`:

```jsonc
"dependencies": {
  "@hridayanp/geo-utils": "^0.1.0",
  "@hridayanp/map-container": "^0.1.0"
}
```

npm symlinks a workspace whenever its version satisfies the range, so
development links locally — and a published manifest is **already correct** with
no pack-time rewriting. What is on disk is what goes to the registry.

## The docs build

`apps/docs` declares `@hridayanp/storybook` as a dependency purely so Turbo
orders the two correctly. Its build then does:

```jsonc
"build": "vite build && node scripts/embed-storybook.mjs"
```

The script copies `apps/storybook/storybook-static` into `apps/docs/dist/storybook`,
producing one deployable directory:

```text
apps/docs/dist/
├── index.html          the documentation site
├── assets/
└── storybook/          the full Storybook build
    ├── index.html
    └── assets/
```

One origin, no proxy, no CORS. `storybookBase()` in `src/site.ts` resolves to
`http://localhost:6006` in development and `/storybook` in a build, overridable
with `VITE_STORYBOOK_URL` if you deploy them separately.

## Source aliasing in the apps

Both apps alias `@hridayanp/*` to package **source** rather than `dist`:

```ts
const sourceAlias = (name: string) => ({
  find: new RegExp(`^@hridayanp/${name}$`),
  replacement: join(packages, name, 'src/index.ts'),
});
```

So editing `packages/raster-layer/src/RasterLayer.tsx` hot-reloads both apps
instantly, and neither needs a build first.

> **Note:** The pattern is anchored with `^…$` on purpose. A prefix match would
> swallow `@hridayanp/ui/styles.css` and rewrite it into a path *inside*
> `index.ts`. There is a separate explicit alias for the stylesheet.

Consumers are unaffected — they resolve the built entry points from
`package.json`.

## Commands

| Command | Effect |
| --- | --- |
| `npm run build` | All 14 workspaces, dependency-ordered, cached |
| `npm run typecheck` | `tsc --noEmit` everywhere, against emitted `.d.ts` |
| `npm run build --workspace @hridayanp/raster-layer` | One package |
| `npx turbo run build --force` | Ignore the cache |
| `npx turbo run build --graph` | Print the resolved task graph |
| `npm run clean` | Remove `dist/`, `.turbo/`, `storybook-static/` |
