The twelve `@hridayanp/*` packages are built to be published independently to
npm. This is what ships, how versions relate, and how to verify a release before
it becomes permanent.

## What ships

Each package declares exactly what goes in the tarball:

```jsonc
{
  "files": ["dist", "README.md"],
  "sideEffects": false,
  "publishConfig": { "access": "public" }
}
```

Nothing else — no `src`, no `tsconfig.json`, no stories, no test fixtures.
`.npmignore` is deliberately absent; an allowlist cannot leak a file you forgot
to exclude.

`sideEffects: false` tells a bundler that importing a module and not using its
exports is safe to drop. Importing `@hridayanp/geo-utils` for one function pulls
in one function.

## The exports map

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

`exports` **seals** the package. A consumer cannot reach
`@hridayanp/raster-layer/dist/useRasterImage.js` — only the entry point and
`package.json` resolve.

That is the difference between a public API you can refactor behind and one where
every internal file is somebody's import. `main`/`module`/`types` remain for
tooling that predates `exports`.

`@hridayanp/ui` adds one more subpath, because a stylesheet has to be importable:

```jsonc
"./styles.css": "./dist/styles.css"
```

## Dual output

`tsup` emits three artefacts per package:

| File | Format | For |
| --- | --- | --- |
| `dist/index.js` | ESM | Modern bundlers, `import` |
| `dist/index.cjs` | CJS | Node `require`, older toolchains |
| `dist/index.d.ts` | Types | TypeScript |

Types are bundled by rollup into a single declaration file, so a consumer's
editor resolves one file rather than walking a tree of `.d.ts` fragments.

## Peer dependencies are the contract

React, MapLibre, deck.gl and WeatherLayers are **peers**, never dependencies:

```jsonc
"peerDependencies": {
  "react": "^18.2.0 || ^19.0.0",
  "maplibre-gl": "^4.0.0 || ^5.0.0"
}
```

> **Warning:** This is not a preference. Two copies of React in one bundle break
> hooks. Two copies of MapLibre mean `map instanceof Map` fails across the
> boundary and layers silently never attach. Two copies of `@deck.gl/core`
> produce layers deck refuses to render. Every one of these fails at runtime with
> no build error.

Ranges are deliberately wide so the library does not force a consumer's major
version upgrade. The `@hridayanp/*` cross-dependencies are ordinary
`dependencies`, because npm deduplicates identical versions and there is no
singleton to protect.

`geotiff` is an **optional** peer, imported lazily. Install it only if you decode
GeoTIFFs.

## Versioning

All twelve packages currently move together at `0.1.0`, with caret ranges
between them:

```jsonc
"dependencies": { "@hridayanp/geo-utils": "^0.1.0" }
```

Lockstep is the right default at this stage: the packages were extracted from
one codebase and their internal contracts (bounds order, raster row order,
context shape) still change together. Independent versioning becomes worthwhile
once those contracts are stable and packages genuinely evolve at different rates.

Under semver, `0.x` treats the **minor** as the breaking position — `0.1.x` to
`0.2.0` may break. Say so in the release notes.

## Before you publish

```bash
npm run clean
npm install
npm run build          # 15 tasks
npm run typecheck      # every workspace
npm run build-storybook
node smoke.mjs         # headless render check
```

Then inspect what would actually ship:

```bash
npm pack --workspace @hridayanp/raster-layer --dry-run
```

Read the file list. `src/`, `.storybook/` or a stray fixture in that output means
`files` is wrong.

Verify the tarball resolves from a clean directory:

```bash
npm pack --workspace @hridayanp/geo-utils
mkdir /tmp/verify && cd /tmp/verify && npm init -y
npm install /path/to/hridayanp-geo-utils-0.1.0.tgz
node -e "console.log(Object.keys(require('@hridayanp/geo-utils')))"
```

## Publishing

```bash
npm login
npm publish --workspaces --access public
```

`--access public` is required for a scoped package; without it npm attempts a
private publish and fails on a free account. It is also in each package's
`publishConfig`, so it applies even when publishing one at a time.

Publish order does not matter to npm, but `geo-utils` first, then
`map-container`, then everything else means a consumer never sees a package whose
declared dependency is not yet on the registry.

Dry run the whole set first:

```bash
npm publish --workspaces --dry-run
```

### Releasing a new version

```bash
npm version minor --workspaces --no-git-tag-version
# review the diff, update cross-dependency ranges if the minor moved
git commit -am "release: 0.2.0"
git tag v0.2.0
npm publish --workspaces --access public
git push && git push --tags
```

The apps are `private: true`, so they are skipped automatically.

## After publishing

A consumer installs only what they need:

```bash
npm install @hridayanp/map-container @hridayanp/raster-layer maplibre-gl react react-dom
```

That is the payoff for the dependency discipline: someone who wants a raster
layer does not install deck.gl, WeatherLayers, Radix or `geotiff`. See
[Dependency Graph](/docs/dependency-graph).

## A published version is permanent

npm allows unpublishing only within 72 hours, and only if nothing depends on the
version. Treat `npm publish` as irreversible.

`npm deprecate` is the tool for a bad release:

```bash
npm deprecate @hridayanp/raster-layer@0.1.1 "Broken exports map; use 0.1.2"
```

## Publishing under your own scope

Change the scope in all twelve `package.json` files, in the cross-dependency
names, and in the source aliases in both apps' `vite.config.ts`:

```bash
grep -rl "@hridayanp/" --include="*.json" --include="*.ts" --include="*.tsx" --include="*.md" .
```

The scope appears in package names, dependency keys, import specifiers, the Vite
aliases, and the documentation. All of them have to move together.
