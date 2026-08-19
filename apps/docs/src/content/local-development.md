The workspace uses npm workspaces with Turborepo. Dependencies are installed
once at the root; there is no per-package install step.

## Installation

```bash
npm install
```

Run this from the **repository root**, not from inside a package.

npm workspaces installs every package's dependencies into a single root
`node_modules` and symlinks the twelve `@hridayanp/*` packages to one another. A
change in `geo-utils` is visible to `raster-layer` immediately, with no build, no
publish and no link step.

> **Warning:** Running `npm install` inside a package directory creates a nested
> `node_modules` that shadows the hoisted resolution, producing two React
> instances in one module graph. If this has occurred, delete the nested
> directory and reinstall from the root.

## Commands

```bash
npm run dev              # docs site on :3000 and Storybook on :6006
npm run dev:docs         # docs site only
npm run dev:storybook    # Storybook only
npm run dev:packages     # tsup --watch across the twelve packages

npm run build            # every workspace, in dependency order
npm run typecheck        # tsc --noEmit across every workspace
npm run clean            # remove dist/, storybook-static/ and .turbo/
```

`npm start` is an alias for `npm run dev`.

## The two applications

`npm run dev` starts two Vite servers in parallel through Turborepo:

| Port | Application | Serves |
| --- | --- | --- |
| `3000` | `apps/docs` | This documentation site |
| `6006` | `apps/storybook` | Interactive component examples |

In development they are distinct origins, so the **Open Storybook** action and
every live-example link resolve to `http://localhost:6006`. In a production
build they are one origin — see [Build System](/docs/build-system).

Override the target when Storybook runs on a different port:

```bash
VITE_STORYBOOK_URL=http://localhost:7007 npm run dev:docs
```

## Source aliasing

Both applications alias `@hridayanp/*` directly to package **source**:

```ts
// apps/docs/vite.config.ts
const sourceAlias = (name: string) => ({
  find: new RegExp(`^@hridayanp/${name}$`),
  replacement: join(packages, name, 'src/index.ts'),
});
```

Vite therefore compiles the TypeScript source on demand. Editing
`packages/raster-layer/src/RasterLayer.tsx` updates both applications through
hot module replacement with no intervening build.

`npm run dev:packages` runs `tsup --watch` and is required only when testing the
**built output** — verifying the `exports` map, inspecting generated
declarations, or linking a package into an external project.

> **Note:** The alias patterns are anchored with `^…$` deliberately. An
> unanchored `@hridayanp/map-container` pattern also matches
> `@hridayanp/map-controls`, resolving the wrong package and producing a
> misleading "export not found" diagnostic.

## Development cycle

1. Edit a file under `packages/*/src`.
2. Both development servers reload.
3. Add or update a story in `apps/storybook/stories` for new behaviour.
4. Update the corresponding page in `apps/docs/src/content` when the public
   contract changes.
5. Run `npm run typecheck` before committing.

Storybook is the appropriate environment for iterating on a component: it
renders one component in isolation with every prop exposed as a control, which
is faster than navigating the documentation site to reach a given state.

## Turborepo

`turbo.json` declares the task graph. It provides two properties:

**Ordering.** `build` declares `dependsOn: ["^build"]`, so `geo-utils` builds
before `map-container`, which builds before `raster-layer`. No sequencing is
maintained by hand.

**Caching.** Task outputs are hashed against their declared `inputs`. Re-running
`npm run build` with no changes replays from cache in under a second and reports
`FULL TURBO`.

When a build appears to ignore a change, the input globs are the place to look:
a file outside the declared globs is not part of the hash.

```bash
npx turbo run build --force        # bypass the cache
npm run clean && npm run build     # full rebuild
```

## Adding a dependency

```bash
npm install chroma-js --workspace @hridayanp/raster-utils
npm install -D vitest --workspace @hridayanp/map-container
npm install -D typescript                       # root-level tooling
```

Always pass `--workspace`; never edit a package's `node_modules` directly.

Before adding a dependency to a package, review the rules in
[Dependency Graph](/docs/dependency-graph). Shared runtimes — React, MapLibre,
deck.gl, WeatherLayers — belong in `peerDependencies`, and must additionally be
listed in `tsup.config.ts`'s `external` array.

## Node version

Node 20 or later, declared in `engines`. Node 18 lacks APIs required by Vite 6
and Storybook 9.

```bash
node --version
```

## Common failures

| Symptom | Cause |
| --- | --- |
| `Unable to find package manager binary` | Missing or incorrect `packageManager` field; it must read `npm@10.9.7` |
| Blank map with no diagnostics | Duplicate React or MapLibre resolution, usually a nested `node_modules` |
| `Cannot find module '@hridayanp/…'` | `npm install` was not run at the root |
| Port 6006 already bound | A prior Storybook process: `lsof -ti:6006 \| xargs kill` |
| Changes not reflected in a build | Turborepo cache; run with `--force` |
| Wrong package resolved in development | An unanchored Vite alias pattern |

Further detail in [Troubleshooting](/docs/troubleshooting).
