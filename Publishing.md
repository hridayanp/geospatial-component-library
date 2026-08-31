# Publishing to npm

This guide provides a comprehensive, step-by-step manual for building, verifying, versioning, and publishing the **Geospatial Component Library** (`@hridayanp/*` packages) to the **npm registry**.

---

## Table of Contents

1. [Monorepo Architecture & Package Overview](#1-monorepo-architecture--package-overview)
2. [Prerequisites & npm Setup](#2-prerequisites--npm-setup)
3. [Pre-Release Verification & Quality Assurance](#3-pre-release-verification--quality-assurance)
4. [Publishing Options](#4-publishing-options)
   - [Method A: Workspace Batch Publishing (Recommended)](#method-a-workspace-batch-publishing-recommended)
   - [Method B: Topological / Step-by-Step Publishing (First Release)](#method-b-topological--step-by-step-publishing-first-release)
   - [Method C: Publishing an Individual Package](#method-c-publishing-an-individual-package)
5. [Release Lifecycle & Version Bumping](#5-release-lifecycle--version-bumping)
6. [CI/CD Automated Publishing via GitHub Actions](#6-cicd-automated-publishing-via-github-actions)
7. [Post-Publish Verification](#7-post-publish-verification)
8. [Troubleshooting & Common Publishing Errors](#8-troubleshooting--common-publishing-errors)
9. [Publishing Under a Different npm Scope](#9-publishing-under-a-different-npm-scope)

---

## 1. Monorepo Architecture & Package Overview

This repository is an **npm workspaces** monorepo managed with **Turborepo** (`turbo`). It produces **12 standalone, modular packages** under the `@hridayanp/*` scope:

| Package | Purpose | Dependencies within Monorepo |
| :--- | :--- | :--- |
| [`@hridayanp/geo-utils`](./packages/geo-utils) | Geodesy, bounding boxes, GeoJSON utilities *(zero external dependencies)* | None |
| [`@hridayanp/raster-utils`](./packages/raster-utils) | Raster statistics, palettes, colour sampling, GeoTIFF decoders | `@hridayanp/geo-utils` |
| [`@hridayanp/ui`](./packages/ui) | Shared headless primitives (Radix) & core design token stylesheet | None |
| [`@hridayanp/map-container`](./packages/map-container) | MapLibre base container & React context provider | `@hridayanp/geo-utils` |
| [`@hridayanp/deck-overlay`](./packages/deck-overlay) | Interleaved deck.gl MapboxOverlay bridge | `@hridayanp/map-container` |
| [`@hridayanp/map-controls`](./packages/map-controls) | Zoom, reset view, fullscreen, opacity, basemap selector | `@hridayanp/map-container`, `@hridayanp/ui` |
| [`@hridayanp/geo-legend`](./packages/geo-legend) | Continuous and discrete colour ramps / legends | `@hridayanp/ui` |
| [`@hridayanp/timeline-control`](./packages/timeline-control) | Interactive timeline scrubber and frame animation playback | `@hridayanp/ui` |
| [`@hridayanp/raster-layer`](./packages/raster-layer) | Zero-blink Canvas/WebGL raster map layer | `@hridayanp/geo-utils`, `@hridayanp/map-container`, `@hridayanp/raster-utils` |
| [`@hridayanp/vector-layer`](./packages/vector-layer) | High-performance GeoJSON vector layer | `@hridayanp/geo-utils`, `@hridayanp/map-container` |
| [`@hridayanp/geo-hover`](./packages/geo-hover) | Interactive raster and feature probing overlay card | `@hridayanp/geo-utils`, `@hridayanp/map-container`, `@hridayanp/ui` |
| [`@hridayanp/wind-particle-layer`](./packages/wind-particle-layer) | GPU particle flow layer (deck.gl + WeatherLayers GL) | `@hridayanp/deck-overlay`, `@hridayanp/geo-utils`, `@hridayanp/map-container` |

### Internal vs. External Package Configuration

- **`apps/docs` & `apps/storybook`**: Configured with `"private": true`. npm will **automatically skip** them during `npm publish --workspaces`.
- **`files` allowlist**: Each package explicitly specifies `"files": ["dist", "README.md"]`. Source code, tests, and configuration files are never leaked into the registry tarball.
- **Dual module output**: Built using `tsup` to emit:
  - `dist/index.js` (ES Modules)
  - `dist/index.cjs` (CommonJS)
  - `dist/index.d.ts` (TypeScript ESM Declarations)
  - `dist/index.d.cts` (TypeScript CJS Declarations)
  - `dist/styles.css` (for `@hridayanp/ui`)
- **Peer Dependencies**: React (`^18.2.0 || ^19.0.0`), MapLibre (`^4.0.0 || ^5.0.0`), and deck.gl (`^9.0.0`) are declared as `peerDependencies`. They are never bundled, preventing dual-instance runtime issues.

---

## 2. Prerequisites & npm Setup

### 2.1 Toolchain Requirements

Ensure you are using Node.js 20+ and npm 10+:

```bash
node -v   # Expected: v20.x or higher
npm -v    # Expected: 10.x or higher
```

### 2.2 npm Account & Scope Setup

1. **Create an account** on [npmjs.com](https://www.npmjs.com/) if you do not have one.
2. **Verify your npm username/organization**:
   - If publishing under `@hridayanp/*`, your npm account username must be `hridayanp` or you must belong to an npm Organization named `hridayanp`.
   - If you wish to publish under a different scope, refer to [Section 9: Publishing Under a Different npm Scope](#9-publishing-under-a-different-npm-scope).
3. **Log in to npm from your terminal**:
   ```bash
   npm login
   ```
   Follow the web authentication prompt or enter your credentials and 2FA (One-Time Password).
4. **Confirm authentication**:
   ```bash
   npm whoami
   ```
   *(This should output your active npm username).*

---

## 3. Pre-Release Verification & Quality Assurance

Before publishing any artifacts to npm, perform the full local build and verification pipeline:

### Step 1: Clean and install dependencies

```bash
npm run clean
npm install
```

### Step 2: Build all packages and applications

```bash
npm run build
```

This invokes Turborepo to build all 12 packages via `tsup`, then compiles Storybook and the Documentation site.

### Step 3: Run strict TypeScript type checks

```bash
npm run typecheck
```

### Step 4: Run the automated smoke test suite

Ensure headless Chromium verification passes across all visual components:

```bash
# Renders 22 Storybook stories in headless Chromium, asserting no WebGL or React errors
node smoke.mjs

# Renders the docs home page and verifies all 28 documentation routes
node smoke-docs.mjs
```

### Step 5: Inspect the tarball contents (Dry Run)

Inspect what will actually be uploaded for any package:

```bash
npm pack --workspace @hridayanp/map-container --dry-run
```

Verify that only `dist/` and `README.md` are included, and no `src/`, `tsconfig.json`, or `.turbo/` cache files are present.

---

## 4. Publishing Options

### Method A: Workspace Batch Publishing (Recommended)

Because every package already has `"publishConfig": { "access": "public" }` defined and internal dependencies use semver ranges (`^0.1.0`), you can publish all 12 packages in one command:

1. **Perform a dry run first**:
   ```bash
   npm publish --workspaces --access public --dry-run
   ```
   Review the terminal output to ensure all 12 packages are packed without errors and both `apps/*` are skipped.

2. **Publish live to npm**:
   ```bash
   npm publish --workspaces --access public
   ```
   *(Or use the root shortcut script: `npm run release:publish`)*

---

### Method B: Topological / Step-by-Step Publishing (First Release)

When publishing to npm for the very first time, publishing packages in dependency order ensures no race conditions occur if consumers or automated bots attempt immediate installation:

#### Tier 1: Base Utilities & Design System
```bash
npm publish --workspace @hridayanp/geo-utils --access public
npm publish --workspace @hridayanp/raster-utils --access public
npm publish --workspace @hridayanp/ui --access public
```

#### Tier 2: Core Map Container
```bash
npm publish --workspace @hridayanp/map-container --access public
```

#### Tier 3: Bridges & UI Overlays
```bash
npm publish --workspace @hridayanp/deck-overlay --access public
npm publish --workspace @hridayanp/map-controls --access public
npm publish --workspace @hridayanp/geo-legend --access public
npm publish --workspace @hridayanp/timeline-control --access public
```

#### Tier 4: Visualization Layers & Probing
```bash
npm publish --workspace @hridayanp/raster-layer --access public
npm publish --workspace @hridayanp/vector-layer --access public
npm publish --workspace @hridayanp/geo-hover --access public
npm publish --workspace @hridayanp/wind-particle-layer --access public
```

---

### Method C: Publishing an Individual Package

If you make a change to a single package and want to publish only that package:

```bash
# 1. Build the specific package
npm run build --workspace @hridayanp/geo-utils

# 2. Publish the package
npm publish --workspace @hridayanp/geo-utils --access public
```

---

## 5. Release Lifecycle & Version Bumping

The packages currently follow **lockstep versioning** (moving together under the same version number).

### 5.1 Determining Version Bumps (Semantic Versioning)

- **Patch release (`0.1.0` → `0.1.1`)**: Backward-compatible bug fixes and non-breaking refinements.
- **Minor release (`0.1.0` → `0.2.0`)**: In `0.x` semver, minor releases can include breaking API changes or substantial new features.
- **Major release (`0.x` → `1.0.0`)**: Production-ready, stable API contracts.

### 5.2 Release Sequence

1. **Ensure your git working directory is clean**:
   ```bash
   git status
   ```

2. **Bump versions across all workspaces**:
   ```bash
   # For a patch release:
   npm version patch --workspaces --no-git-tag-version

   # OR for a minor release:
   npm version minor --workspaces --no-git-tag-version
   ```

3. **Update inter-package dependencies (if minor or major changed)**:
   If the minor or major version changed, update internal dependency references in `packages/*/package.json` (e.g., `"@hridayanp/geo-utils": "^0.2.0"`).

4. **Rebuild and verify**:
   ```bash
   npm run build && npm run typecheck
   node smoke.mjs
   ```

5. **Commit, Tag, and Push**:
   ```bash
   git add .
   git commit -m "release: v0.2.0"
   git tag v0.2.0
   git push origin main --tags
   ```

6. **Publish**:
   ```bash
   npm publish --workspaces --access public
   ```

---

## 6. CI/CD Automated Publishing via GitHub Actions

To automate publishing on git tag creation or GitHub Releases:

### Step 1: Create an npm Automation Token

1. Go to **[npmjs.com](https://www.npmjs.com/)** → **Access Tokens** → **Generate New Token**.
2. Select **Granular Access Token** or **Automation Token** (with `Read and write` access to your scope).
3. Copy the token.

### Step 2: Add Secret to GitHub

In your GitHub repository:
- Go to **Settings** → **Secrets and variables** → **Actions**.
- Click **New repository secret**.
- Name: `NPM_TOKEN`.
- Value: *[Paste your npm token]*.

### Step 3: Create GitHub Actions Workflow

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write # Required for npm provenance

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Build packages
        run: npm run build

      - name: Run Typecheck & Smoke Tests
        run: |
          npm run typecheck
          node smoke.mjs
          node smoke-docs.mjs

      - name: Publish all packages to npm
        run: npm publish --workspaces --access public --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 7. Post-Publish Verification

### 7.1 Verify Registry Metadata

Verify that the packages are accessible on npm:

```bash
npm view @hridayanp/map-container
npm view @hridayanp/raster-layer version
npm view @hridayanp/wind-particle-layer peerDependencies
```

Or view on the web:
`https://www.npmjs.com/package/@hridayanp/map-container`

### 7.2 Test Clean Installation in an Isolated Project

Create a temporary project to confirm clean installation and exports resolution:

```bash
mkdir /tmp/test-geo-lib && cd /tmp/test-geo-lib
npm init -y
npm install @hridayanp/map-container @hridayanp/raster-layer @hridayanp/ui maplibre-gl react react-dom

# Test module resolution via Node.js
node -e "console.log('Installed successfully!')"
```

---

## 8. Troubleshooting & Common Publishing Errors

### Error: `403 Forbidden` / `E403`
```
npm error 403 Forbidden - PUT https://registry.npmjs.org/@hridayanp%2fmap-container - You do not have permission to publish
```
- **Cause**: Your logged-in npm user does not have permission to publish under `@hridayanp`.
- **Solution**:
  - Run `npm whoami` to check which account is logged in.
  - If `@hridayanp` is an organization, ensure your account is an owner/member.
  - If `@hridayanp` belongs to someone else, rename the scope (see [Section 9](#9-publishing-under-a-different-npm-scope)).

### Error: `402 Payment Required`
```
npm error 402 Payment Required - Scoped packages are private by default
```
- **Cause**: Scoped packages on npm default to private (which requires a paid organization plan) unless `--access public` is specified.
- **Solution**: Always pass `--access public` or ensure `"publishConfig": { "access": "public" }` is present in `package.json`.

### Error: `Cannot publish over existing version`
```
npm error 403 Forbidden - You cannot publish over the previously published versions: 0.1.0
```
- **Cause**: npm package versions are **immutable**. Once a version is published, it cannot be replaced or re-published with changes.
- **Solution**: Bump the version number using `npm version patch --workspaces --no-git-tag-version` and rebuild before publishing.

### Deprecating a Defective Release
If a version with a bug was published, do not unpublish (which breaks downstream projects). Instead, deprecate it and publish a patch:

```bash
npm deprecate @hridayanp/raster-layer@0.1.1 "Bug in color scale parser; please upgrade to 0.1.2"
```

---

## 9. Publishing Under a Different npm Scope

If you want to publish under your own npm username or company scope (e.g. `@my-org/*` or `@my-username/*`), rename all occurrences across the repository:

1. **Perform a global string replacement**:
   Search and replace `@hridayanp/` with `@<your-scope>/` across all files:
   - Root `package.json` and `README.md`
   - `packages/*/package.json` and package source files
   - `apps/docs/` and `apps/storybook/` (Vite aliases and content files)

2. **Quick replacement script (macOS/Linux)**:
   ```bash
   # Replace NEW_SCOPE with your npm username or org (without the @ symbol)
   NEW_SCOPE="my-username"
   
   find . -type f \( -name "*.json" -o -name "*.ts" -o -name "*.tsx" -o -name "*.md" \) \
     -not -path "*/node_modules/*" \
     -not -path "*/dist/*" \
     -not -path "*/.git/*" \
     -exec sed -i '' "s/@hridayanp/@$NEW_SCOPE/g" {} +
   ```

3. **Re-install, build, and publish**:
   ```bash
   npm install
   npm run build
   npm publish --workspaces --access public
   ```
