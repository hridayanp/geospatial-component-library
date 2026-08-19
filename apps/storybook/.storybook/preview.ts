import type { Preview } from '@storybook/react-vite';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@hridayanp/ui/styles.css';
import './preview.css';

const preview: Preview = {
  parameters: {
    controls: {
      // No colour matcher: several props in this library accept a MapLibre
      // expression or an [r, g, b, a] tuple as well as a CSS colour, and a
      // colour picker would misreport both. Controls are declared per story.
      matchers: { date: /Date$/i },
      expanded: true,
    },
    options: {
      // Capability first, page-shaped groupings never — this is a component
      // library, and the sidebar should read like one.
      storySort: {
        order: [
          'Introduction',
          'Geospatial',
          ['Map Container', 'Raster Layer', 'Vector Layer', 'Wind Particle Layer'],
          'Overlays',
          'Utilities',
          'Composition Examples',
        ],
      },
    },
    docs: { toc: true },
    a11y: { test: 'todo' },
  },
  tags: ['autodocs'],
  globalTypes: {
    theme: {
      description: 'Library colour theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'dark' },
  decorators: [
    (Story, context) => {
      // Every colour in the library is a CSS variable keyed off this
      // attribute, so one line retheme the whole docs site.
      document.documentElement.setAttribute(
        'data-gcl-theme',
        String(context.globals['theme'] ?? 'dark'),
      );
      return Story();
    },
  ],
};

export default preview;
