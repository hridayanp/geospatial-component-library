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
    'Twenty-six independently installable React packages for geospatial visualisation and analysis, built on MapLibre GL and deck.gl. Georeferenced data enters through explicit component interfaces; view state and interaction events leave through callbacks.',
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
    description: 'Resolved dependencies across twenty-six packages, and the invariants that constrain them.',
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
    slug: 'map-compare',
    title: 'map-compare',
    group: 'Packages',
    description: 'Synchronised comparison: a swipe divider for two states, small multiples for more.',
    storybook: 'comparison-map-compare',
    npm: '@hridayanp/map-compare',
  },
  {
    slug: 'classified-raster',
    title: 'classified-raster',
    group: 'Packages',
    description: 'Categorical raster symbology, latitude-weighted areas and change accounting.',
    storybook: 'analysis-classified-raster',
    npm: '@hridayanp/classified-raster',
  },
  {
    slug: 'hotspot-analysis',
    title: 'hotspot-analysis',
    group: 'Packages',
    description: 'Getis-Ord Gi* clustering and kernel density estimation over geographic observations.',
    storybook: 'analysis-hotspot-analysis',
    npm: '@hridayanp/hotspot-analysis',
  },
  {
    slug: 'geo-charts',
    title: 'geo-charts',
    group: 'Packages',
    description: 'Trend projection, class composition and transition matrices, as dependency-free SVG.',
    storybook: 'analysis-charts',
    npm: '@hridayanp/geo-charts',
  },
  {
    slug: 'contour-layer',
    title: 'contour-layer',
    group: 'Packages',
    description: 'Isolines traced from a raster with marching squares, drawn and labelled by MapLibre.',
    storybook: 'geospatial-contour-layer',
    npm: '@hridayanp/contour-layer',
  },
  {
    slug: 'wind-barb-layer',
    title: 'wind-barb-layer',
    group: 'Packages',
    description: 'WMO wind barbs and direction arrows from fields or observations, without deck.gl.',
    storybook: 'geospatial-wind-barb-layer',
    npm: '@hridayanp/wind-barb-layer',
  },
  {
    slug: 'data-tile-layer',
    title: 'data-tile-layer',
    group: 'Packages',
    description: 'Value-encoded data tiles decoded and coloured in the browser, with A − B difference and exact sampling.',
    storybook: 'geospatial-data-tile-layer',
    npm: '@hridayanp/data-tile-layer',
  },
  {
    slug: 'heatmap-layer',
    title: 'heatmap-layer',
    group: 'Packages',
    description: 'GPU point-density heatmap with weighting and a cross-fade to individual points.',
    storybook: 'geospatial-heatmap-layer',
    npm: '@hridayanp/heatmap-layer',
  },
  {
    slug: 'map-draw',
    title: 'map-draw',
    group: 'Packages',
    description: 'Drawing, editing and geodesic measurement — point, line, polygon, rectangle, circle — on terra-draw.',
    storybook: 'interaction-map-draw',
    npm: '@hridayanp/map-draw',
  },
  {
    slug: 'map-markers',
    title: 'map-markers',
    group: 'Packages',
    description: 'React-rendered markers and popups, and a click-to-pick point selector.',
    storybook: 'interaction-map-markers',
    npm: '@hridayanp/map-markers',
  },
  {
    slug: 'map-widgets',
    title: 'map-widgets',
    group: 'Packages',
    description: 'Scale bar, cursor coordinates, north arrow, overview inset, place search, ramp picker and loading overlay.',
    storybook: 'overlays-map-widgets',
    npm: '@hridayanp/map-widgets',
  },
  {
    slug: 'map-export',
    title: 'map-export',
    group: 'Packages',
    description: 'PNG, JPEG and animated GIF export of the map, with no runtime dependencies.',
    storybook: 'overlays-map-export',
    npm: '@hridayanp/map-export',
  },
  {
    slug: 'met-charts',
    title: 'met-charts',
    group: 'Packages',
    description: 'Skew-T, hodograph, wind rose, meteogram, profile, cross-section and verification charts as SVG.',
    storybook: 'analysis-meteorological-charts',
    npm: '@hridayanp/met-charts',
  },
  {
    slug: 'geo-inputs',
    title: 'geo-inputs',
    group: 'Packages',
    description: 'A latitude/longitude field that reads every notation, and a bounding-box editor.',
    storybook: 'interaction-geo-inputs',
    npm: '@hridayanp/geo-inputs',
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
