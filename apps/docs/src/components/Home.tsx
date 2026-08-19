import { Suspense, lazy } from 'react';
import { Link } from '../router';
import { GROUPS, SITE, pagesInGroup, storybookHome } from '../site';

// The hero pulls in MapLibre, deck.gl and WeatherLayers. Splitting it keeps the
// documentation itself loading fast for anyone who came to read rather than look.
const HeroMap = lazy(() =>
  import('./HeroMap').then((module) => ({ default: module.HeroMap })),
);

const HIGHLIGHTS = [
  {
    title: 'Explicit responsibility boundary',
    body: 'Components occupy the presentation tier. Georeferenced data and configuration enter through props; view state and interaction events leave through callbacks. Retrieval, authorisation and application state remain with the host.',
  },
  {
    title: 'Generalised rendering primitives',
    body: 'Variable-specific map components differ only in the band they render and the ramp they apply. Both are props, so precipitation, temperature and probability of exceedance are one component.',
  },
  {
    title: 'Granular package boundaries',
    body: 'Twelve packages, each independently versioned and publishable. A symbology key for a print report resolves without acquiring a map renderer.',
  },
  {
    title: 'Single-instance runtime guarantee',
    body: 'React, MapLibre GL, deck.gl and WeatherLayers GL are declared as peer dependencies throughout. Exactly one instance is resolved per application, and no major-version upgrade is imposed.',
  },
];

const CODE = `import 'maplibre-gl/dist/maplibre-gl.css';
import '@hridayanp/ui/styles.css';

import { MapContainer } from '@hridayanp/map-container';
import { RasterLayer } from '@hridayanp/raster-layer';
import { VectorLayer } from '@hridayanp/vector-layer';
import { WindParticleLayer } from '@hridayanp/wind-particle-layer';
import { GeoLegend } from '@hridayanp/geo-legend';

<MapContainer center={[92, 25.5]} zoom={6} style={{ height: 520 }}>
  <RasterLayer data={raster} colorScale={palette} min={0} max={100} />
  <VectorLayer data={boundaries} fill={false} stroke="#94a3b8" />
  <WindParticleLayer data={{ kind: 'field', u, v, width, height, bounds }} />
  <GeoLegend colorScale={palette} min={0} max={100} placement="bottom-right" />
</MapContainer>`;

export function Home() {
  return (
    <div className="docs-home">
      <section className="docs-hero">
        <div className="docs-hero__text">
          <div className="docs-hero__eyebrow">
            <span className="docs-badge docs-badge--accent">v{SITE.version}</span>
            <span>{SITE.scope}/*</span>
          </div>
          <h1>
            Geospatial rendering
            <br />
            primitives for React.
          </h1>
          <p>{SITE.tagline}</p>

          <div className="docs-hero__actions">
            <Link href="/docs/quick-start" className="docs-button docs-button--primary docs-button--lg">
              Get started
            </Link>
            <a
              className="docs-button docs-button--ghost docs-button--lg"
              href={storybookHome()}
              target="_blank"
              rel="noreferrer noopener"
            >
              Browse Storybook
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </a>
          </div>

          <code className="docs-install docs-install--hero">
            npm i {SITE.scope}/map-container {SITE.scope}/raster-layer maplibre-gl
          </code>
        </div>

        <Suspense
          fallback={
            <div className="docs-hero__map docs-hero__map--loading">
              <span>Initialising renderer…</span>
            </div>
          }
        >
          <HeroMap />
        </Suspense>
      </section>

      <p className="docs-hero__caption">
        Rendered above: a raster layer, a vector overlay, GPU flow particles, two
        symbology keys and a zoom control, composed within a single{' '}
        <code>MapContainer</code>. Every value is generated deterministically in
        the browser — the demonstration requires no backend, because the library
        does not.
      </p>

      <section className="docs-highlights">
        {HIGHLIGHTS.map((item) => (
          <article key={item.title} className="docs-highlight">
            <h2>{item.title}</h2>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <section className="docs-home__code">
        <div>
          <h2>Composition through nesting</h2>
          <p>
            Layer components resolve the enclosing map through React context and
            register their own sources and style layers, so there is no layer
            registry to maintain and no ordering array to synchronise. Mount
            order determines draw order; <code>beforeId</code> overrides it where
            data belongs beneath basemap labels.
          </p>
          <Link href="/docs/composition" className="docs-button docs-button--ghost">
            Composition guide
          </Link>
        </div>
        <pre className="docs-home__pre">
          <code>{CODE}</code>
        </pre>
      </section>

      <section className="docs-home__index">
        <h2>Documentation index</h2>
        <div className="docs-home__groups">
          {GROUPS.map((group) => (
            <div key={group} className="docs-home__group">
              <h3>{group}</h3>
              <ul>
                {pagesInGroup(group).map((page) => (
                  <li key={page.slug}>
                    <Link href={`/docs/${page.slug}`}>
                      <strong>
                        {group === 'Packages' ? `${SITE.scope}/${page.title}` : page.title}
                      </strong>
                      <span>{page.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
