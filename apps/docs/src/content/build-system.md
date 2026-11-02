Turborepo orchestrates the task graph, tsup compiles each package, and the
`exports` map defines the published surface.

## Task graph

```jsonc
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**", "stories/**", ".storybook/**", "scripts/**",
        "index.html", "tsup.config.ts", "vite.config.ts",
        "tsconfig.json", "package.json"
      ],
      "outputs": ["dist/**", "storybook-static/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "stories/**", ".storybook/**",
                 "vite.config.ts", "tsconfig.json", "package.json"]
    },
    "dev":   { "cache": false, "persistent": true },
    "clean": { "cache": false }
  }
}
```

`^build` resolves ordering from each package's `dependencies` field. No build
list is maintained; a package with correctly declared dependencies is inserted
into the graph automatically.

`inputs` and `outputs` drive content-addressed caching. A task whose declared
inputs are unchanged replays from cache in tens of milliseconds and reports
`FULL TURBO`. A source change rebuilds that package and its dependents, and
nothing else.

> **Warning:** The input globs must enumerate every file that affects a task's
> output. The applications keep stories in `stories/`, Storybook configuration
> in `.storybook/`, and build scripts in `scripts/` — none of which are matched
> by `src/**`. An omitted glob produces a cache hit on stale output.

## Package compilation

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

> **Warning:** `external` must enumerate **every peer dependency and every
> workspace dependency**. An omitted entry causes tsup to inline that module —
> which would publish four copies of the compass table, and would void the
> single-instance guarantee for React, MapLibre or deck.gl.

`dts: true` runs a separate rollup pass that flattens the type graph into one
declaration file, so a consumer resolves a single `.d.ts` rather than traversing
internal declaration fragments.

`splitting: false` because a single-entry library has nothing meaningful to
split, and chunking would complicate the published layout without benefit.

## Published artefacts

```text
packages/raster-layer/dist/
├── index.js         ES module
├── index.js.map
├── index.cjs        CommonJS
├── index.cjs.map
├── index.d.ts       declarations for the ESM entry
└── index.d.cts      declarations for the CJS entry
```

`@hridayanp/ui` performs one additional step, because tsup does not copy CSS:

```jsonc
"build": "tsup && cp src/styles.css dist/styles.css"
```

## Exports map

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

Three declarations carry the contract:

**`exports` defines the resolvable surface.** A consumer may import the package
entry point and `package.json`, and nothing else. Internal modules are not
addressable, so an internal refactor cannot break a consumer. `main`, `module`
and `types` remain for tooling that predates conditional exports.

**`sideEffects: false`** permits a bundler to eliminate unreferenced exports.
Importing only `RasterLayer` does not retain `preloadRasterFrame` or
`RasterFrameCache`. `@hridayanp/ui` declares `["*.css"]` instead, so its
stylesheet survives tree-shaking.

**`files`** excludes `src/`, configuration and fixtures from the tarball. Verify
with `npm pack --dry-run`.

## Workspace version ranges

Internal dependencies use plain semver ranges rather than a workspace protocol:

```jsonc
"dependencies": {
  "@hridayanp/geo-utils": "^0.1.0",
  "@hridayanp/map-container": "^0.1.0"
}
```

npm symlinks a workspace package whenever its version satisfies the declared
range, so development resolves locally while the published manifest is already
correct. No pack-time rewriting occurs; the manifest on disk is the manifest on
the registry.

## Documentation build

`apps/docs` declares `@hridayanp/storybook` as a development dependency solely
to establish Turborepo ordering between the two. Its build then runs:

```jsonc
"build": "vite build && node scripts/embed-storybook.mjs"
```

The script copies `apps/storybook/storybook-static` into
`apps/docs/dist/storybook`, producing one deployable directory:

```text
apps/docs/dist/
├── index.html          the documentation site
├── assets/
└── storybook/          the Storybook build
    ├── index.html
    └── assets/
```

A single origin, requiring no reverse proxy and no cross-origin configuration.
`storybookBase()` in `src/site.ts` resolves to `http://localhost:6006` in
development and `/storybook` in a production build, overridable through
`VITE_STORYBOOK_URL` when the two are deployed to separate origins.

## Source aliasing in the applications

Both applications alias `@hridayanp/*` to package **source** rather than to
`dist`:

```ts
const sourceAlias = (name: string) => ({
  find: new RegExp(`^@hridayanp/${name}$`),
  replacement: join(packages, name, 'src/index.ts'),
});
```

A source edit therefore propagates to both applications through hot module
replacement, and neither requires a prior build.

> **Note:** The pattern is anchored with `^…$` deliberately. A prefix match
> would capture `@hridayanp/ui/styles.css` and rewrite it into a path inside
> `index.ts`; a separate explicit alias resolves the stylesheet. Unanchored
> patterns also cause `@hridayanp/map-container` to match
> `@hridayanp/map-controls`.

Consumers are unaffected — they resolve the built entry points declared in each
`package.json`.

## Commands

| Command | Effect |
| --- | --- |
| `npm run build` | All workspaces, dependency-ordered and cached |
| `npm run typecheck` | `tsc --noEmit` across every workspace, against emitted declarations |
| `npm run build --workspace @hridayanp/raster-layer` | A single package |
| `npx turbo run build --force` | Bypass the cache |
| `npx turbo run build --graph` | Print the resolved task graph |
| `npm run clean` | Remove `dist/`, `.turbo/` and `storybook-static/` |
