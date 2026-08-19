import { useEffect, useState } from 'react';
import { Link } from '../router';
import { SITE, storybookHome } from '../site';
import { Search } from './Search';

function Logo() {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <ellipse cx="16" cy="16" rx="6" ry="13" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M3 16h26" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof document === 'undefined') return 'dark';
    return (
      (document.documentElement.getAttribute('data-docs-theme') as
        | 'dark'
        | 'light') ?? 'dark'
    );
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-docs-theme', theme);
    // The library reads its own attribute, so the live demos follow the docs.
    document.documentElement.setAttribute('data-gcl-theme', theme);
    try {
      localStorage.setItem('docs-theme', theme);
    } catch {
      /* private browsing */
    }
  }, [theme]);

  return [theme, setTheme] as const;
}

export function Header({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const [theme, setTheme] = useTheme();

  return (
    <header className="docs-header">
      <button
        className="docs-header__menu"
        onClick={onToggleSidebar}
        aria-label="Toggle navigation"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <Link href="/" className="docs-header__brand">
        <span className="docs-header__logo">
          <Logo />
        </span>
        <span className="docs-header__name">{SITE.shortName}</span>
        <span className="docs-badge">v{SITE.version}</span>
      </Link>

      <Search />

      <nav className="docs-header__actions">
        <Link href="/docs/overview" className="docs-header__link">
          Docs
        </Link>
        <Link href="/docs/installation" className="docs-header__link">
          Install
        </Link>
        <a
          className="docs-button docs-button--primary"
          href={storybookHome()}
          target="_blank"
          rel="noreferrer noopener"
        >
          Open Storybook
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </a>
        <button
          className="docs-icon-button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4.5" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
            </svg>
          )}
        </button>
      </nav>
    </header>
  );
}
