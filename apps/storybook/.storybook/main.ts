import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';

const here = dirname(fileURLToPath(import.meta.url));
const packages = resolve(here, '../../../packages');

/**
 * Alias every `@hridayanp/*` import to the package's TypeScript source.
 *
 * Stories then hot-reload on a source edit instead of requiring a rebuild,
 * and clicking through to a definition lands in real code rather than a
 * bundled `.d.ts`. Consumers still resolve the built entry points from
 * `package.json`; this alias only applies inside the docs site.
 */
const sourceAlias = (name: string) => ({
  // Anchored so `@hridayanp/ui/styles.css` is not swallowed by the `@hridayanp/ui`
  // entry — a prefix match would rewrite it into a path inside index.ts.
  find: new RegExp(`^@hridayanp/${name}$`),
  replacement: join(packages, name, 'src/index.ts'),
});

const config: StorybookConfig = {
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    // Read prop documentation straight from the TypeScript types, so the
    // Controls table stays in sync with the components automatically.
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop) =>
        prop.parent ? !/node_modules\/(?!.*@hridayanp)/.test(prop.parent.fileName) : true,
    },
  },
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    resolve: {
      ...viteConfig.resolve,
      alias: [
        ...(Array.isArray(viteConfig.resolve?.alias)
          ? viteConfig.resolve.alias
          : []),
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
  }),
};

export default config;
