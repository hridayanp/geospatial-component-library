import { Link } from '../router';
import { GROUPS, SITE, pagesInGroup, storybookHome } from '../site';

export function Sidebar({
  currentSlug,
  open,
  onNavigate,
}: {
  currentSlug: string | null;
  open: boolean;
  onNavigate: () => void;
}) {
  return (
    <aside className={`docs-sidebar${open ? ' is-open' : ''}`} aria-label="Documentation">
      <nav className="docs-sidebar__inner">
        {GROUPS.map((group) => (
          <section key={group} className="docs-sidebar__group">
            <h2 className="docs-sidebar__heading">{group}</h2>
            <ul className="docs-sidebar__list">
              {pagesInGroup(group).map((page) => {
                const active = page.slug === currentSlug;
                return (
                  <li key={page.slug}>
                    <Link
                      href={`/docs/${page.slug}`}
                      className={`docs-sidebar__link${active ? ' is-active' : ''}`}
                      onNavigate={onNavigate}
                      {...(active ? { 'aria-current': 'page' as const } : {})}
                    >
                      {group === 'Packages' ? (
                        <>
                          <span className="docs-sidebar__scope">{SITE.scope}/</span>
                          {page.title}
                        </>
                      ) : (
                        page.title
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <section className="docs-sidebar__group">
          <h2 className="docs-sidebar__heading">Interactive examples</h2>
          <ul className="docs-sidebar__list">
            <li>
              <a
                className="docs-sidebar__link docs-sidebar__link--external"
                href={storybookHome()}
                target="_blank"
                rel="noreferrer noopener"
              >
                Storybook
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </a>
            </li>
          </ul>
        </section>
      </nav>
    </aside>
  );
}
