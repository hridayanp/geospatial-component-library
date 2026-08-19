import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const packages = resolve(here, '../../packages');

/**
 * Resolve `@hridayanp/*` to package source, exactly as the Storybook app does.
 *
 * The docs site renders live components on the overview page, so aliasing to
 * source means an edit inside any package's `src` directory hot-reloads here
 * too — and it removes the need to build the packages before running the docs.
 *
 * The pattern is anchored so `@hridayanp/ui/styles.css` is not swallowed by the
 * `@hridayanp/ui` entry; a prefix match would rewrite it into a path inside
 * index.ts.
 */
const sourceAlias = (name: string) => ({
  find: new RegExp(`^@hridayanp/${name}$`),
  replacement: join(packages, name, 'src/index.ts'),
});

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    strictPort: false,
  },
  preview: {
    port: 3001,
  },
  resolve: {
    alias: [
      {
        find: '@hridayanp/ui/styles.css',
        replacement: join(packages, 'ui/src/styles.css'),
      },
      sourceAlias('geo-utils'),
      sourceAlias('raster-utils'),
      sourceAlias('ui'),
      sourceAlias('map-container'),
      sourceAlias('deck-overlay'),
      sourceAlias('raster-layer'),
      sourceAlias('vector-layer'),
      sourceAlias('wind-particle-layer'),
      sourceAlias('geo-legend'),
      sourceAlias('geo-hover'),
      sourceAlias('timeline-control'),
      sourceAlias('map-controls'),
    ],
  },
  build: {
    outDir: 'dist',
    // Storybook is copied into dist/storybook afterwards; never wipe it by
    // accident on a rebuild — the copy step runs after this anyway.
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
});
