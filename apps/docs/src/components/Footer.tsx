import { Link } from '../router';
import { SITE, neighbours, storybookHome } from '../site';

export function PageNavigation({ slug }: { slug: string }) {
  const { previous, next } = neighbours(slug);
  if (!previous && !next) return null;

  return (
    <nav className="docs-pagenav" aria-label="Page navigation">
      {previous ? (
        <Link href={`/docs/${previous.slug}`} className="docs-pagenav__item">
          <span className="docs-pagenav__direction">← Previous</span>
          <span className="docs-pagenav__title">{previous.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={`/docs/${next.slug}`}
          className="docs-pagenav__item docs-pagenav__item--next"
        >
          <span className="docs-pagenav__direction">Next →</span>
          <span className="docs-pagenav__title">{next.title}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="docs-footer">
      <div className="docs-footer__inner">
        <div className="docs-footer__brand">
          <strong>{SITE.name}</strong>
          <p>{SITE.tagline}</p>
          <p className="docs-footer__meta">
            MIT licensed · v{SITE.version} · {SITE.scope}/*
          </p>
        </div>

        <div className="docs-footer__columns">
          <div>
            <h3>Documentation</h3>
            <Link href="/docs/overview">Overview</Link>
            <Link href="/docs/installation">Installation</Link>
            <Link href="/docs/quick-start">Quick Start</Link>
            <Link href="/docs/theming">Theming</Link>
          </div>
          <div>
            <h3>Architecture</h3>
            <Link href="/docs/principles">Design Principles</Link>
            <Link href="/docs/repository-anatomy">Repository Anatomy</Link>
            <Link href="/docs/runtime-flow">Runtime Flow</Link>
            <Link href="/docs/build-system">Build System</Link>
          </div>
          <div>
            <h3>Packages</h3>
            <Link href="/docs/map-container">map-container</Link>
            <Link href="/docs/raster-layer">raster-layer</Link>
            <Link href="/docs/vector-layer">vector-layer</Link>
            <Link href="/docs/wind-particle-layer">wind-particle-layer</Link>
          </div>
          <div>
            <h3>More</h3>
            <a href={storybookHome()} target="_blank" rel="noreferrer noopener">
              Storybook
            </a>
            <Link href="/docs/publishing">Publishing</Link>
            <Link href="/docs/invariants">Invariants</Link>
            <Link href="/docs/troubleshooting">Troubleshooting</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
