import { useEffect, useState } from 'react';
import { DocArticle } from './components/DocArticle';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Home } from './components/Home';
import { Sidebar } from './components/Sidebar';
import { Link, useRoute } from './router';
import { PAGE_BY_SLUG, SITE, storybookHome } from './site';

/**
 * `/storybook` is not a page — it hands off to the Storybook build.
 *
 * In development that is a separate server on :6006; in a production build
 * Storybook lives at `dist/storybook`, so the same route works against a
 * relative path. Either way this is a full navigation, not a client-side
 * route, because Storybook is its own application.
 */
function StorybookRedirect() {
  const target = storybookHome();

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <main className="docs-main docs-main--centered">
      <div className="docs-redirect">
        <h1>Opening Storybook…</h1>
        <p>
          If nothing happens, <a href={target}>follow this link</a>.
        </p>
        <p className="docs-redirect__hint">
          In development Storybook runs separately on port 6006. Start it with{' '}
          <code>npm run dev</code> at the workspace root, which runs both apps.
        </p>
      </div>
    </main>
  );
}

function NotFound({ path }: { path: string }) {
  return (
    <main className="docs-main docs-main--centered">
      <div className="docs-redirect">
        <div className="docs-article__eyebrow">404</div>
        <h1>No page at {path}</h1>
        <p>
          The documentation index is on the <Link href="/">home page</Link>, or
          jump straight to the <Link href="/docs/overview">overview</Link>.
        </p>
      </div>
    </main>
  );
}

export function App() {
  const route = useRoute();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isStorybook = route.path === '/storybook';
  const docMatch = route.path.match(/^\/docs\/(.+)$/);
  const slug = docMatch?.[1] ?? null;
  const page = slug ? (PAGE_BY_SLUG.get(slug) ?? null) : null;
  const isHome = route.path === '/';

  // Close the mobile drawer on navigation, and keep the title in sync.
  useEffect(() => {
    setSidebarOpen(false);
    document.title = page
      ? `${page.title} · ${SITE.name}`
      : isHome
        ? `${SITE.name}`
        : `Not found · ${SITE.name}`;
  }, [route.path, page, isHome]);

  return (
    <div className={`docs-shell${isHome ? ' docs-shell--home' : ''}`}>
      <Header onToggleSidebar={() => setSidebarOpen((open) => !open)} />

      <div className="docs-layout">
        {!isHome && (
          <>
            <Sidebar
              currentSlug={slug}
              open={sidebarOpen}
              onNavigate={() => setSidebarOpen(false)}
            />
            {sidebarOpen && (
              <div
                className="docs-scrim"
                onClick={() => setSidebarOpen(false)}
                role="presentation"
              />
            )}
          </>
        )}

        {isHome && <Home />}
        {!isHome && isStorybook && <StorybookRedirect />}
        {!isHome && !isStorybook && page && <DocArticle page={page} />}
        {!isHome && !isStorybook && !page && <NotFound path={route.path} />}
      </div>

      <Footer />
    </div>
  );
}
