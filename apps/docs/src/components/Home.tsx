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
    title: 'Props in, callbacks out',
    body: 'No API client, no store, no routes, no auth. The host application owns data retrieval; these packages own rendering. Every component is pure with respect to your backend.',
  },
  {
    title: 'One raster layer, not six',
    body: 'Per-variable map components differ only in their data and their colour ramp. Both are props here, so temperature, rainfall, probability and pressure are the same component.',
  },
  {
    title: 'Install only what you use',
    body: 'Twelve packages, each independently versioned and publishable. A legend in a report costs about eight kilobytes and pulls in no map at all.',
  },
  {
    title: 'Peer dependencies for the heavy things',
    body: 'React, MapLibre, deck.gl and WeatherLayers are never bundled. One instance, supplied by you, shared by everything.',
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
            Geospatial components
            <br />
            that know nothing about your&nbsp;backend.
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
              <span>Loading live demo…</span>
            </div>
          }
        >
          <HeroMap />
        </Suspense>
      </section>

      <p className="docs-hero__caption">
        Live, above — a raster layer, a vector overlay, GPU wind particles, two
        legends and a zoom control, composed inside one <code>MapContainer</code>.
        Every value is generated in the browser. Nothing is fetched.
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
          <h2>Composition is just nesting</h2>
          <p>
            Layers attach themselves to the enclosing map through React context,
            so there is no layer registry to maintain and no ordering array to
            keep in sync. Mount order is draw order.
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
        <h2>Everything in here</h2>
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
