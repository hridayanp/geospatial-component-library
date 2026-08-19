import { PAGES, type DocPage } from './site';
import { toPlainText } from './markdown';

/**
 * Every `.md` file under `src/content/`, imported as a raw string at build
 * time. Eager because the whole site is a few hundred kilobytes of text and
 * search needs all of it in memory anyway — lazy chunks would buy nothing but
 * a loading spinner.
 */
const files = import.meta.glob('./content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const bySlug = new Map<string, string>();
for (const [path, source] of Object.entries(files)) {
  const slug = path.replace('./content/', '').replace(/\.md$/, '');
  bySlug.set(slug, source);
}

export function getMarkdown(slug: string): string | null {
  return bySlug.get(slug) ?? null;
}

export interface SearchEntry {
  page: DocPage;
  /** Lowercased haystack: title, description and body text. */
  haystack: string;
  /** Section headings, for showing where a match sits. */
  sections: string[];
}

export const SEARCH_INDEX: SearchEntry[] = PAGES.map((page) => {
  const source = bySlug.get(page.slug) ?? '';
  const sections = Array.from(source.matchAll(/^##\s+(.+)$/gm)).map((match) =>
    match[1]!.replace(/`/g, '').trim(),
  );
  return {
    page,
    haystack: `${page.title} ${page.description} ${toPlainText(source)}`.toLowerCase(),
    sections,
  };
});

export function search(query: string, limit = 8): SearchEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const scored = SEARCH_INDEX.map((entry) => {
    let score = 0;
    if (entry.page.title.toLowerCase().includes(needle)) score += 100;
    if (entry.page.description.toLowerCase().includes(needle)) score += 40;
    for (const section of entry.sections) {
      if (section.toLowerCase().includes(needle)) score += 20;
    }
    const index = entry.haystack.indexOf(needle);
    if (index !== -1) score += 10;
    return { entry, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((row) => row.entry);
}

/** Report any page registered in site.ts with no matching markdown file. */
export function missingPages(): string[] {
  return PAGES.filter((page) => !bySlug.has(page.slug)).map((page) => page.slug);
}
