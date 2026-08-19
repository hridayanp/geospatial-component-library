import { useEffect, useMemo, useRef } from 'react';
import { getMarkdown } from '../content';
import { renderMarkdown } from '../markdown';
import { storybookDocs, type DocPage } from '../site';
import { PageNavigation } from './Footer';
import { TableOfContents } from './TableOfContents';

export function DocArticle({ page }: { page: DocPage }) {
  const source = getMarkdown(page.slug);
  const rendered = useMemo(
    () => (source ? renderMarkdown(source) : { html: '', headings: [] }),
    [source],
  );
  const bodyRef = useRef<HTMLDivElement>(null);

  // Copy buttons are emitted by the markdown renderer as plain markup, so the
  // behaviour is wired once per page rather than per code block component.
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;

    const handler = (event: Event) => {
      const button = (event.target as HTMLElement).closest('[data-copy]');
      if (!button) return;
      const code = button.parentElement?.querySelector('code');
      if (!code) return;
      void navigator.clipboard.writeText(code.textContent ?? '').then(() => {
        button.textContent = 'Copied';
        window.setTimeout(() => {
          button.textContent = 'Copy';
        }, 1400);
      });
    };

    root.addEventListener('click', handler);
    return () => root.removeEventListener('click', handler);
  }, [rendered.html]);

  // Scroll to the fragment once the markdown is in the DOM. Without the frame
  // delay the target element does not exist yet on a cold load.
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) {
      window.scrollTo({ top: 0 });
      return;
    }
    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ block: 'start' });
    });
  }, [page.slug, rendered.html]);

  if (!source) {
    return (
      <main className="docs-main">
        <article className="docs-article">
          <h1>Page not written yet</h1>
          <p className="docs-lede">
            <code>src/content/{page.slug}.md</code> does not exist.
          </p>
        </article>
      </main>
    );
  }

  return (
    <>
      <main className="docs-main">
        <article className="docs-article">
          <div className="docs-article__eyebrow">{page.group}</div>
          <h1 className="docs-article__title">{page.title}</h1>
          <p className="docs-lede">{page.description}</p>

          {(page.npm || page.storybook) && (
            <div className="docs-article__actions">
              {page.npm && (
                <code className="docs-install">npm i {page.npm}</code>
              )}
              {page.storybook && (
                <a
                  className="docs-button docs-button--ghost"
                  href={storybookDocs(page.storybook)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Live examples in Storybook
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <path d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </a>
              )}
            </div>
          )}

          <div
            ref={bodyRef}
            className="docs-body"
            dangerouslySetInnerHTML={{ __html: rendered.html }}
          />

          <PageNavigation slug={page.slug} />
        </article>
      </main>

      <TableOfContents headings={rendered.headings} />
    </>
  );
}
