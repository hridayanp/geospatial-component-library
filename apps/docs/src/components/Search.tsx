import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { search } from '../content';
import { navigate } from '../router';

/**
 * Client-side search over the page registry and markdown body text.
 *
 * The whole corpus is a few hundred kilobytes and already in memory, so a
 * scored substring match beats shipping a search index and a query engine.
 */
export function Search() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => search(query), [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setCursor(0);
  }, []);

  // Cmd/Ctrl+K from anywhere, Escape to dismiss.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close]);

  const go = useCallback(
    (slug: string) => {
      navigate(`/docs/${slug}`);
      close();
    },
    [close],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) => (value + 1) % results.length);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => (value - 1 + results.length) % results.length);
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = results[cursor] ?? results[0];
      if (chosen) go(chosen.page.slug);
    }
  };

  return (
    <>
      <button
        className="docs-search-trigger"
        onClick={() => {
          setOpen(true);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span>Search documentation</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <div className="docs-search-overlay" onClick={close} role="presentation">
          <div
            className="docs-search-panel"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Search documentation"
          >
            <div className="docs-search-panel__input">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCursor(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search pages, packages and sections…"
                aria-label="Search query"
              />
              <kbd>esc</kbd>
            </div>

            <div className="docs-search-panel__results">
              {query.trim().length < 2 && (
                <p className="docs-search-panel__hint">
                  Type at least two characters. Try <code>raster</code>,{' '}
                  <code>publish</code> or <code>peer</code>.
                </p>
              )}
              {query.trim().length >= 2 && results.length === 0 && (
                <p className="docs-search-panel__hint">
                  No matches for “{query}”.
                </p>
              )}
              {results.map((entry, index) => (
                <button
                  key={entry.page.slug}
                  className={`docs-search-result${index === cursor ? ' is-active' : ''}`}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => go(entry.page.slug)}
                >
                  <span className="docs-search-result__group">{entry.page.group}</span>
                  <span className="docs-search-result__title">{entry.page.title}</span>
                  <span className="docs-search-result__desc">
                    {entry.page.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
