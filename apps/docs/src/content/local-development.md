Install once at the root, then use the four commands that matter. The workspace
is npm + Turborepo; there is no pnpm, no yarn and no per-package install step.

## One install, at the root

```bash
npm install
```

Run this from the repository root — **not** inside a package.

npm workspaces installs every package's dependencies into a single root
`node_modules` and symlinks the twelve `@hridayanp/*` packages to each other. A
change in `geo-utils` is visible to `raster-layer` immediately, with no build,
no publish and no `npm link`.

Running `npm install` inside `packages/raster-layer` instead creates a nested
`node_modules` that shadows the root one, which is how you end up with two copies
of React and a blank map. If you have done it, delete the nested folder and
re-install from the root.

## The commands

```bash
npm run dev              # docs site on :3000 + Storybook on :6006
npm run dev:docs         # docs only
npm run dev:storybook    # Storybook only
npm run dev:packages     # tsup --watch across the twelve packages

npm run build            # build everything, in dependency order
npm run typecheck        # tsc --noEmit across every workspace
npm run clean            # remove dist/, storybook-static/, .turbo/
```

`npm run start` is an alias for `npm run dev`.

## What `npm run dev` actually runs

Two Vite servers, in parallel, via Turborepo:

| Port | App | Serves |
| --- | --- | --- |
| `3000` | `apps/docs` | This documentation site |
| `6006` | `apps/storybook` | Interactive component examples |

In development they are genuinely separate origins, so the **Open Storybook**
button and every "Live examples" link point at `http://localhost:6006`. In a
production build they are one origin — see [Build System](/docs/build-system).

Override the target if you run Storybook on a different port:

```bash
VITE_STORYBOOK_URL=http://localhost:7007 npm run dev:docs
```

## You do not need `dev:packages`

Both apps alias `@hridayanp/*` **directly to package source**:

```ts
// apps/docs/vite.config.ts
const sourceAlias = (name) => ({
  find: new RegExp(`^@hridayanp/${name}$`),
  replacement: join(packages, name, 'src/index.ts'),
});
```

So Vite compiles the TypeScript source on demand. Editing
`packages/raster-layer/src/RasterLayer.tsx` hot-reloads in both apps with no
build step in between.

`npm run dev:packages` runs `tsup --watch` and is only useful when you are
testing the **built output** — verifying the `exports` map, checking generated
`.d.ts` files, or linking the package into an external project.

> **Note:** The alias regexes are anchored with `^…$` on purpose. An unanchored
> `@hridayanp/map-container` pattern also matches `@hridayanp/map-controls`,
> which resolves the wrong package and produces a confusing "export not found"
> error.

## The development loop

1. Edit a file under `packages/*/src`.
2. Both dev servers hot-reload.
3. Add or update a story in `apps/storybook/src/stories` for anything new.
4. Update the matching page in `apps/docs/src/content` if behaviour changed.
5. `npm run typecheck` before you commit.

Storybook is the place to iterate on a component. It renders one thing in
isolation with every prop as a control, which is faster than clicking through the
docs site to reach the state you care about.

## Turborepo

`turbo.json` describes the task graph. Two things it buys you:

**Ordering.** `build` declares `dependsOn: ["^build"]`, so `geo-utils` builds
before `map-container` builds before `raster-layer`. You never sequence anything
by hand.

**Caching.** Task outputs are hashed against their declared `inputs`. Re-running
`npm run build` with nothing changed replays from cache in under a second and
prints `FULL TURBO`.

If a build seems to ignore your change, the input globs are the place to look —
a file outside `src/**`, `tsup.config.ts`, `tsconfig.json` and `package.json` is
not part of the hash.

```bash
npx turbo run build --force        # bypass the cache
npm run clean && npm run build     # nuclear option
```

## Adding a dependency

```bash
npm install chroma-js --workspace @hridayanp/raster-utils
npm install -D vitest --workspace @hridayanp/map-container
npm install -D typescript                       # root-level tooling
```

Never edit a package's `node_modules` or install without `--workspace`. Before
adding anything to a package, read the dependency rules in
[Dependency Graph](/docs/dependency-graph) — shared runtimes like React,
MapLibre and deck.gl belong in `peerDependencies`, not `dependencies`.

## Node version

Node 20 or newer, declared in `engines`. Node 18 is missing APIs that Vite 6 and
Storybook 9 rely on.

```bash
node --version
```

## Common problems

| Symptom | Cause |
| --- | --- |
| `Unable to find package manager binary` | A stale `packageManager` field, or `npx turbo` outside the root. The field must read `npm@10.9.7` |
| Blank map, no errors | Two copies of React or MapLibre — a nested `node_modules` |
| `Cannot find module '@hridayanp/…'` | `npm install` was not run at the root |
| Port 6006 in use | A previous Storybook is still running: `lsof -ti:6006 \| xargs kill` |
| Changes not picked up | Turbo cache; use `--force` |

More in [Troubleshooting](/docs/troubleshooting).
