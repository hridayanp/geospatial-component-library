The twelve `@hridayanp/*` packages are published independently to npm. This is
the published surface, the versioning model, and the verification sequence
preceding a release.

## Published surface

Each package declares its tarball contents explicitly:

```jsonc
{
  "files": ["dist", "README.md"],
  "sideEffects": false,
  "publishConfig": { "access": "public" }
}
```

Nothing else is included — no `src`, no `tsconfig.json`, no stories, no
fixtures. `.npmignore` is deliberately absent: an allowlist cannot leak a file
that was not explicitly excluded.

`sideEffects: false` informs a bundler that importing a module without
referencing its exports is safe to eliminate. Importing one function from
`@hridayanp/geo-utils` retains one function. `@hridayanp/ui` declares
`["*.css"]` instead, so its stylesheet survives tree-shaking.

## Exports map

```jsonc
{
  "main":    "./dist/index.cjs",
  "module":  "./dist/index.js",
  "types":   "./dist/index.d.ts",
  "exports": {
    ".": {
      "types":   "./dist/index.d.ts",
      "import":  "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./package.json": "./package.json"
  }
}
```

`exports` defines the resolvable surface. A consumer cannot address
`@hridayanp/raster-layer/dist/useRasterImage.js`; only the entry point and
`package.json` resolve.

That is the difference between a public API that can be refactored behind and
one in which every internal module is somebody's import specifier. `main`,
`module` and `types` remain for tooling predating conditional exports.

`@hridayanp/ui` declares one additional subpath, because a stylesheet must be
importable:

```jsonc
"./styles.css": "./dist/styles.css"
```

## Module formats

`tsup` emits four artefacts per package:

| File | Format | Consumer |
| --- | --- | --- |
| `dist/index.js` | ES module | Modern bundlers, `import` |
| `dist/index.cjs` | CommonJS | Node `require`, older toolchains |
| `dist/index.d.ts` | Declarations | TypeScript, ESM resolution |
| `dist/index.d.cts` | Declarations | TypeScript, CJS resolution |

Declarations are flattened by a rollup pass into a single file per format, so a
consumer's editor resolves one declaration rather than traversing a tree of
fragments.

## Peer dependencies as contract

React, MapLibre GL, deck.gl and WeatherLayers GL are peers, never dependencies:

```jsonc
"peerDependencies": {
  "react": "^18.2.0 || ^19.0.0",
  "maplibre-gl": "^4.0.0 || ^5.0.0"
}
```

> **Warning:** This is a correctness requirement rather than a preference. Two
> React instances in one bundle invalidate hooks. Two MapLibre instances cause
> `map instanceof Map` to fail across the boundary, so layers never attach. Two
> `@deck.gl/core` instances produce layers deck refuses to render. Each of these
> fails at runtime with no build diagnostic.

Ranges are deliberately wide so the library does not force a consumer's major
version upgrade. Cross-package `@hridayanp/*` dependencies are ordinary
`dependencies`, because npm deduplicates identical versions and no singleton
requires protection.

`geotiff`, `pmtiles` and `@geomatico/maplibre-cog-protocol` are **optional**
peers, imported dynamically at the point of use.

## Versioning

All twelve packages currently move together at `0.1.0`, with caret ranges
between them:

```jsonc
"dependencies": { "@hridayanp/geo-utils": "^0.1.0" }
```

Lockstep versioning is appropriate at this stage: the packages were extracted
from one codebase and their internal contracts — extent ordering, raster row
ordering, context shape — still evolve together. Independent versioning becomes
worthwhile once those contracts are stable and packages genuinely diverge in
release cadence.

Under semantic versioning, `0.x` treats the **minor** position as breaking:
`0.1.x` to `0.2.0` may introduce incompatibility. State this explicitly in
release notes.

## Pre-release verification

```bash
npm run clean
npm install
npm run build
npm run typecheck
npm run build-storybook
node smoke.mjs
node smoke-docs.mjs
```

The clean install is material: it is the only way to detect a dependency that
resolves locally because something else happens to hoist it.

Then inspect the tarball contents:

```bash
npm pack --workspace @hridayanp/raster-layer --dry-run
```

The presence of `src/`, `.storybook/` or a fixture in that listing indicates an
incorrect `files` declaration.

Verify resolution from a clean directory:

```bash
npm pack --workspace @hridayanp/geo-utils
mkdir /tmp/verify && cd /tmp/verify && npm init -y
npm install /path/to/hridayanp-geo-utils-0.1.0.tgz
node -e "console.log(Object.keys(require('@hridayanp/geo-utils')))"
```

## Publishing

```bash
npm login
npm publish --workspaces --dry-run
npm publish --workspaces --access public
```

`--access public` is required for a scoped package; without it npm attempts a
private publish. It is additionally declared in each package's `publishConfig`,
so it applies when publishing individually.

Publish order is immaterial to the registry, but publishing `geo-utils` first,
then `map-container`, then the remainder ensures a consumer never encounters a
package whose declared dependency is not yet resolvable.

The applications are `private: true` and are skipped automatically.

### Releasing a version

```bash
npm version minor --workspaces --no-git-tag-version
# review the diff; update cross-package ranges if the minor position moved
git commit -am "release: 0.2.0"
git tag v0.2.0
npm publish --workspaces --access public
git push && git push --tags
```

## Consumer installation

A consumer installs only what the application requires:

```bash
npm install @hridayanp/map-container @hridayanp/raster-layer \
  maplibre-gl react react-dom
```

This is the return on the dependency discipline: an application rendering a
raster layer does not acquire deck.gl, WeatherLayers, Radix or `geotiff`. See
[Dependency Graph](/docs/dependency-graph).

## Immutability of published versions

npm permits unpublishing only within 72 hours, and only when no package depends
on the version. Treat `npm publish` as irreversible.

`npm deprecate` is the remedy for a defective release:

```bash
npm deprecate @hridayanp/raster-layer@0.1.1 "Incorrect exports map; use 0.1.2"
```

## Republishing under a different scope

The scope appears in package names, cross-package dependency keys, import
specifiers, the Vite aliases in both applications, and the documentation. All
occurrences must change together:

```bash
grep -rl "@hridayanp/" \
  --include="*.json" --include="*.ts" --include="*.tsx" --include="*.md" .
```
