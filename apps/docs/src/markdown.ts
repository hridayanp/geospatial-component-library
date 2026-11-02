import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import plaintext from 'highlight.js/lib/languages/plaintext';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import { Marked } from 'marked';

/**
 * Markdown → HTML, with heading anchors and syntax highlighting.
 *
 * Only the six languages this documentation actually uses are registered.
 * `highlight.js`'s full bundle registers ~190 and costs several hundred
 * kilobytes; this costs about twenty.
 */

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('jsonc', json);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('jsx', typescript);
hljs.registerLanguage('javascript', typescript);
hljs.registerLanguage('js', typescript);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('text', plaintext);

export interface Heading {
  /** Anchor id, also the `#fragment`. */
  id: string;
  /** Rendered text. */
  text: string;
  /** 2 or 3 — h1 is the page title, deeper levels are not listed. */
  level: number;
}

export interface RenderedDoc {
  html: string;
  headings: Heading[];
}

/** GitHub-style slug: lowercase, punctuation stripped, spaces to hyphens. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function renderMarkdown(source: string): RenderedDoc {
  const headings: Heading[] = [];
  const used = new Set<string>();

  const marked = new Marked({
    gfm: true,
    breaks: false,
  });

  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const plain = text.replace(/<[^>]+>/g, '');

        let id = slugify(plain);
        // Duplicate headings across a long page are normal ("Props" appears
        // twice); suffix them so anchors stay unique and linkable.
        if (used.has(id)) {
          let suffix = 2;
          while (used.has(`${id}-${suffix}`)) suffix++;
          id = `${id}-${suffix}`;
        }
        used.add(id);

        if (depth === 2 || depth === 3) {
          headings.push({ id, text: plain, level: depth });
        }

        return `<h${depth} id="${id}" class="doc-heading">${text}<a class="doc-anchor" href="#${id}" aria-label="Link to this section">#</a></h${depth}>`;
      },

      code({ text, lang }) {
        const language = (lang ?? '').split(/\s+/)[0] ?? '';
        const registered = language && hljs.getLanguage(language);
        const highlighted = registered
          ? hljs.highlight(text, { language }).value
          : escapeHtml(text);
        const label = registered ? language : '';
        return (
          `<div class="doc-code" data-language="${label}">` +
          `<button class="doc-code__copy" type="button" data-copy>Copy</button>` +
          `<pre><code class="hljs language-${label}">${highlighted}</code></pre>` +
          `</div>`
        );
      },

      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href);
        const attributes = [
          `href="${href}"`,
          title ? `title="${title}"` : '',
          external ? 'target="_blank" rel="noreferrer noopener"' : '',
          external ? 'class="doc-link doc-link--external"' : 'class="doc-link"',
        ]
          .filter(Boolean)
          .join(' ');
        return `<a ${attributes}>${text}</a>`;
      },

      table({ header, rows }) {
        const head = header
          .map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`)
          .join('');
        const body = rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell) => `<td>${this.parser.parseInline(cell.tokens)}</td>`)
                .join('')}</tr>`,
          )
          .join('');
        return `<div class="doc-table-wrap"><table class="doc-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
      },

      blockquote({ tokens }) {
        const body = this.parser.parse(tokens);
        // A blockquote opening with **Note:** / **Warning:** renders as a
        // callout, which is how the important caveats get visual weight
        // without inventing custom markdown syntax.
        const match = body.match(/^<p><strong>(Note|Warning|Tip):?<\/strong>/i);
        const kind = match ? match[1]!.toLowerCase() : 'note';
        const cleaned = match
          ? body.replace(/^<p><strong>(Note|Warning|Tip):?<\/strong>\s*/i, '<p>')
          : body;
        return `<div class="doc-callout doc-callout--${kind}"><div class="doc-callout__label">${kind}</div><div class="doc-callout__body">${cleaned}</div></div>`;
      },
    },
  });

  const html = marked.parse(source, { async: false }) as string;
  return { html, headings };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Plain text for search indexing: markdown syntax and code fences removed.
 */
export function toPlainText(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_>|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
