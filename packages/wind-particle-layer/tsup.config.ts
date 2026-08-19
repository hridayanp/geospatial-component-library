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
  external: ['react', 'maplibre-gl', '@deck.gl/core', '@deck.gl/extensions', '@deck.gl/layers', '@deck.gl/mapbox', 'weatherlayers-gl', '@hridayanp/deck-overlay', '@hridayanp/geo-utils', '@hridayanp/map-container'],
});
