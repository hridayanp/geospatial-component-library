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
  // Every peer and every workspace dependency. An omitted entry is inlined,
  // which is how a consumer ends up with a second copy of a shared runtime.
  external: [
    'react',
    'maplibre-gl',
    '@hridayanp/map-container',
    '@hridayanp/ui',
  ],
});
