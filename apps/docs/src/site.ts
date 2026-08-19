/**
 * Site configuration: where Storybook lives, and the full page registry that
 * drives the sidebar, the router, search and prev/next navigation.
 *
 * Adding a page is two steps: drop a `.md` file in `src/content/`, and add an
 * entry here. Everything else is derived.
 */

export const SITE = {
  name: 'Geospatial Component Library',
  shortName: 'geo-components',
  scope: '@hridayanp',
  version: '0.1.0',
  tagline:
    'Twelve independently installable React packages for geospatial visualisation, built on MapLibre GL and deck.gl. Georeferenced data enters through explicit component interfaces; view state and interaction events leave through callbacks.',
  /** Set this once you push the repository somewhere. */
  repository: '',
} as const;

/**
 * Where Storybook is served from.
 *
 * In development the two apps are separate servers, so the docs link across to
 * :6006. In a production build Storybook is copied into `dist/storybook`, so a
 * relative path works and everything is one origin.
 *
 * Override either with `VITE_STORYBOOK_URL` when deploying them apart.
 */
export function storybookBase(): string {
  const override = import.meta.env['VITE_STORYBOOK_URL'];
  if (override) return String(override).replace(/\/$/, '');
  return import.meta.env.DEV ? 'http://localhost:6006' : '/storybook';
}

/** Deep link to a Storybook docs page, e.g. `geospatial-raster-layer`. */
export function storybookDocs(id: string): string {
  return `${storybookBase()}/?path=/docs/${id}--docs`;
}

/** Deep link to a single Storybook story, e.g. `geospatial-raster-layer--basic`. */
export function storybookStory(id: string): string {
  return `${storybookBase()}/?path=/story/${id}`;
}

/** The Storybook landing page — what the header button and /storybook point at. */
export function storybookHome(): string {
  return storybookDocs('introduction');
}

export interface DocPage {
  /** URL slug. The page is served at `/docs/<slug>`. */
  slug: string;
  /** Sidebar label and `<h1>` fallback. */
  title: string;
  /** Sidebar group heading. */
  group: string;
  /** One line under the title, and the search result subtitle. */
  description: string;
  /** Storybook docs id, when this page documents something with stories. */
  storybook?: string;
  /** npm package name, when this page documents a published package. */
  npm?: string;
}

export const GROUPS = [
  'Getting Started',
  'Architecture',
  'Packages',
  'Guides',
  'Reference',
] as const;

export const PAGES: DocPage[] = [
  /* Getting Started ------------------------------------------------------ */
  {
    slug: 'overview',
    title: 'Overview',
    group: 'Getting Started',
    description: 'Architectural position, package inventory, and the boundary this library maintains.',
  },
  {
    slug: 'installation',
    title: 'Installation',
    group: 'Getting Started',
    description: 'Package selection, the peer dependency matrix, and runtime requirements.',
  },
  {
    slug: 'quick-start',
    title: 'Quick Start',
    group: 'Getting Started',
    description: 'A rendering pipeline assembled incrementally, from map surface to value inspection.',
  },
  {
    slug: 'theming',
    title: 'Theming',
    group: 'Getting Started',
    description: 'Design tokens, colour schemes, and the scoped class namespace.',
  },

  /* Architecture --------------------------------------------------------- */
  {
    slug: 'principles',
    title: 'Design Principles',
    group: 'Architecture',
    description: 'The five rules that determine package boundaries and the library–application contract.',
  },
  {
    slug: 'repository-anatomy',
    title: 'Repository Anatomy',
    group: 'Architecture',
    description: 'Workspace layout, configuration files, and the behaviour each one governs.',
  },
  {
    slug: 'dependency-graph',
    title: 'Dependency Graph',
    group: 'Architecture',
    description: 'Resolved dependencies across twelve packages, and the invariants that constrain them.',
  },
  {
    slug: 'runtime-flow',
    title: 'Runtime Flow',
    group: 'Architecture',
    description: 'Mount, temporal frame transition, and style reload, in execution order.',
  },
  {
    slug: 'build-system',
    title: 'Build System',
    group: 'Architecture',
    description: 'Task graph, compilation output, and the published module surface.',
  },

  /* Packages ------------------------------------------------------------- */
  {
    slug: 'map-container',
    title: 'map-container',
    group: 'Packages',
    description: 'Map instance, view state, and the React context every layer resolves.',
    storybook: 'geospatial-map-container',
    npm: '@hridayanp/map-container',
  },
  {
    slug: 'raster-layer',
    title: 'raster-layer',
    group: 'Packages',
    description: 'Georeferenced raster rendering with double-buffered frame transitions.',
    storybook: 'geospatial-raster-layer',
    npm: '@hridayanp/raster-layer',
  },
  {
    slug: 'vector-layer',
    title: 'vector-layer',
    group: 'Packages',
    description: 'GeoJSON rendering across all geometry types with data-driven symbology.',
    storybook: 'geospatial-vector-layer',
    npm: '@hridayanp/vector-layer',
  },
  {
    slug: 'wind-particle-layer',
    title: 'wind-particle-layer',
    group: 'Packages',
    description: 'GPU flow-field particle advection on deck.gl and WeatherLayers GL.',
    storybook: 'geospatial-wind-particle-layer',
    npm: '@hridayanp/wind-particle-layer',
  },
  {
    slug: 'geo-legend',
    title: 'geo-legend',
    group: 'Packages',
    description: 'Continuous and classified symbology keys for any value domain.',
    storybook: 'overlays-geo-legend',
    npm: '@hridayanp/geo-legend',
  },
  {
    slug: 'geo-hover',
    title: 'geo-hover',
    group: 'Packages',
    description: 'Feature picking, raster value probing, and a portalled readout card.',
    storybook: 'overlays-geo-hover',
    npm: '@hridayanp/geo-hover',
  },
  {
    slug: 'timeline-control',
    title: 'timeline-control',
    group: 'Packages',
    description: 'Temporal frame sequencing and playback for animated layers.',
    storybook: 'overlays-timeline-control',
    npm: '@hridayanp/timeline-control',
  },
  {
    slug: 'map-controls',
    title: 'map-controls',
    group: 'Packages',
    description: 'View-state controls: zoom, reset, fullscreen, opacity and basemap selection.',
    storybook: 'overlays-map-controls',
    npm: '@hridayanp/map-controls',
  },
  {
    slug: 'deck-overlay',
    title: 'deck-overlay',
    group: 'Packages',
    description: 'deck.gl interoperability within the MapLibre render pass.',
    npm: '@hridayanp/deck-overlay',
  },
  {
    slug: 'raster-utils',
    title: 'raster-utils',
    group: 'Packages',
    description: 'Band statistics, colour ramps, colourisation, sampling and GeoTIFF decoding.',
    storybook: 'utilities-raster-utilities',
    npm: '@hridayanp/raster-utils',
  },
  {
    slug: 'geo-utils',
    title: 'geo-utils',
    group: 'Packages',
    description: 'Extent algebra, geodesy and GeoJSON traversal. No runtime dependencies.',
    storybook: 'utilities-geo-utilities',
    npm: '@hridayanp/geo-utils',
  },
  {
    slug: 'ui',
    title: 'ui',
    group: 'Packages',
    description: 'Shared interface primitives and the library stylesheet.',
    npm: '@hridayanp/ui',
  },

  /* Guides --------------------------------------------------------------- */
  {
    slug: 'local-development',
    title: 'Local Development',
    group: 'Guides',
    description: 'Workspace installation, the development cycle, and Turborepo behaviour.',
  },
  {
    slug: 'composition',
    title: 'Composing Layers',
    group: 'Guides',
    description: 'Draw order, temporal synchronisation and state ownership across composed layers.',
    storybook: 'composition-examples',
  },
  {
    slug: 'publishing',
    title: 'Publishing to npm',
    group: 'Guides',
    description: 'The published surface, the versioning model, and pre-release verification.',
  },
  {
    slug: 'adding-a-package',
    title: 'Adding a Package',
    group: 'Guides',
    description: 'Eight steps from an empty directory to a published layer package.',
  },
  {
    slug: 'verification',
    title: 'Testing & Verification',
    group: 'Guides',
    description: 'Type checking, build verification, and headless render testing.',
  },

  /* Reference ------------------------------------------------------------ */
  {
    slug: 'invariants',
    title: 'Invariants',
    group: 'Reference',
    description: 'Ten properties the library depends on for correctness, and how each fails.',
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    group: 'Reference',
    description: 'Symptom-to-cause reference for the failures that occur in practice.',
  },
];

export const PAGE_BY_SLUG = new Map(PAGES.map((page) => [page.slug, page]));

/** Pages in sidebar order, used for prev/next footer navigation. */
export const ORDERED_SLUGS = PAGES.map((page) => page.slug);

export function pagesInGroup(group: string): DocPage[] {
  return PAGES.filter((page) => page.group === group);
}

export function neighbours(slug: string): {
  previous: DocPage | null;
  next: DocPage | null;
} {
  const index = ORDERED_SLUGS.indexOf(slug);
  if (index === -1) return { previous: null, next: null };
  const previousSlug = ORDERED_SLUGS[index - 1];
  const nextSlug = ORDERED_SLUGS[index + 1];
  return {
    previous: previousSlug ? (PAGE_BY_SLUG.get(previousSlug) ?? null) : null,
    next: nextSlug ? (PAGE_BY_SLUG.get(nextSlug) ?? null) : null,
  };
}
