import { useEffect, useState } from 'react';
import type { Heading } from '../markdown';

/**
 * "On this page", with scroll spy.
 *
 * The observer's `rootMargin` pulls the detection band to the top sixth of the
 * viewport. Without it, a heading only becomes "active" once it has scrolled
 * well past the reader, which feels a section behind.
 */
export function TableOfContents({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-72px 0px -80% 0px', threshold: 0 },
    );

    for (const heading of headings) {
      const element = document.getElementById(heading.id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return <div className="docs-toc" />;

  return (
    <div className="docs-toc">
      <div className="docs-toc__inner">
        <h2 className="docs-toc__heading">On this page</h2>
        <ul className="docs-toc__list">
          {headings.map((heading) => (
            <li key={heading.id} data-level={heading.level}>
              <a
                href={`#${heading.id}`}
                className={`docs-toc__link${activeId === heading.id ? ' is-active' : ''}`}
                onClick={(event) => {
                  event.preventDefault();
                  const element = document.getElementById(heading.id);
                  if (!element) return;
                  // History, not scrollIntoView alone, so the anchor is
                  // shareable and the back button returns to the last section.
                  window.history.replaceState({}, '', `#${heading.id}`);
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
