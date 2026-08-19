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
    'Twelve independently installable React packages for map visualisation. Props in, callbacks out — no API client, no store, no application assumptions.',
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
    description: 'What this library is, and the one rule it follows.',
  },
  {
    slug: 'installation',
    title: 'Installation',
    group: 'Getting Started',
    description: 'Packages, peer dependencies and the stylesheet.',
  },
  {
    slug: 'quick-start',
    title: 'Quick Start',
    group: 'Getting Started',
    description: 'A working map in about twenty lines.',
  },
  {
    slug: 'theming',
    title: 'Theming',
    group: 'Getting Started',
    description: 'CSS custom properties, light and dark, and the class namespace.',
  },

  /* Architecture --------------------------------------------------------- */
  {
    slug: 'principles',
    title: 'Design Principles',
    group: 'Architecture',
    description: 'The rules that decide what belongs in a package and what does not.',
  },
  {
    slug: 'repository-anatomy',
    title: 'Repository Anatomy',
    group: 'Architecture',
    description: 'Every file at the root, and what it controls.',
  },
  {
    slug: 'dependency-graph',
    title: 'Dependency Graph',
    group: 'Architecture',
    description: 'How the twelve packages relate, and the three rules that hold.',
  },
  {
    slug: 'runtime-flow',
    title: 'Runtime Flow',
    group: 'Architecture',
    description: 'What actually happens from mount to timeline step to basemap swap.',
  },
  {
    slug: 'build-system',
    title: 'Build System',
    group: 'Architecture',
    description: 'Turborepo task graph, tsup output, and the exports map.',
  },

  /* Packages ------------------------------------------------------------- */
  {
    slug: 'map-container',
    title: 'map-container',
    group: 'Packages',
    description: 'The MapLibre map and the context every layer attaches to.',
    storybook: 'geospatial-map-container',
    npm: '@hridayanp/map-container',
  },
  {
    slug: 'raster-layer',
    title: 'raster-layer',
    group: 'Packages',
    description: 'Generic raster visualisation with zero-blink frame updates.',
    storybook: 'geospatial-raster-layer',
    npm: '@hridayanp/raster-layer',
  },
  {
    slug: 'vector-layer',
    title: 'vector-layer',
    group: 'Packages',
    description: 'One GeoJSON layer for every geometry type.',
    storybook: 'geospatial-vector-layer',
    npm: '@hridayanp/vector-layer',
  },
  {
    slug: 'wind-particle-layer',
    title: 'wind-particle-layer',
    group: 'Packages',
    description: 'GPU-animated flow particles on deck.gl and WeatherLayers GL.',
    storybook: 'geospatial-wind-particle-layer',
    npm: '@hridayanp/wind-particle-layer',
  },
  {
    slug: 'geo-legend',
    title: 'geo-legend',
    group: 'Packages',
    description: 'Continuous and classed legends for arbitrary data.',
    storybook: 'overlays-geo-legend',
    npm: '@hridayanp/geo-legend',
  },
  {
    slug: 'geo-hover',
    title: 'geo-hover',
    group: 'Packages',
    description: 'Feature picking, raster probing and a portalled readout card.',
    storybook: 'overlays-geo-hover',
    npm: '@hridayanp/geo-hover',
  },
  {
    slug: 'timeline-control',
    title: 'timeline-control',
    group: 'Packages',
    description: 'Frame playback for animated layers.',
    storybook: 'overlays-timeline-control',
    npm: '@hridayanp/timeline-control',
  },
  {
    slug: 'map-controls',
    title: 'map-controls',
    group: 'Packages',
    description: 'Zoom, reset, fullscreen, opacity and basemap switching.',
    storybook: 'overlays-map-controls',
    npm: '@hridayanp/map-controls',
  },
  {
    slug: 'deck-overlay',
    title: 'deck-overlay',
    group: 'Packages',
    description: 'Bridges deck.gl layers onto a MapLibre map.',
    npm: '@hridayanp/deck-overlay',
  },
  {
    slug: 'raster-utils',
    title: 'raster-utils',
    group: 'Packages',
    description: 'Statistics, colour ramps, colourisation, sampling, GeoTIFF.',
    storybook: 'utilities-raster-utilities',
    npm: '@hridayanp/raster-utils',
  },
  {
    slug: 'geo-utils',
    title: 'geo-utils',
    group: 'Packages',
    description: 'Bounds, geodesy and GeoJSON helpers. Zero dependencies.',
    storybook: 'utilities-geo-utilities',
    npm: '@hridayanp/geo-utils',
  },
  {
    slug: 'ui',
    title: 'ui',
    group: 'Packages',
    description: 'Shared primitives and the single stylesheet.',
    npm: '@hridayanp/ui',
  },

  /* Guides --------------------------------------------------------------- */
  {
    slug: 'local-development',
    title: 'Local Development',
    group: 'Guides',
    description: 'Install once at the root, then the commands you actually use.',
  },
  {
    slug: 'composition',
    title: 'Composing Layers',
    group: 'Guides',
    description: 'Stacking raster, vector and particles on one map.',
    storybook: 'composition-examples',
  },
  {
    slug: 'publishing',
    title: 'Publishing to npm',
    group: 'Guides',
    description: 'What ships, how versions work, and the dry run.',
  },
  {
    slug: 'adding-a-package',
    title: 'Adding a Package',
    group: 'Guides',
    description: 'The eight steps to a new layer package.',
  },
  {
    slug: 'verification',
    title: 'Testing & Verification',
    group: 'Guides',
    description: 'Typecheck, build, and the headless render check.',
  },

  /* Reference ------------------------------------------------------------ */
  {
    slug: 'invariants',
    title: 'Invariants',
    group: 'Reference',
    description: 'Ten things that break the library if you change them.',
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    group: 'Reference',
    description: 'Symptom to file, for the failures that actually happen.',
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
