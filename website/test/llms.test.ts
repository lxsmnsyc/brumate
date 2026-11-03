import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { llmsFull, llmsTxt, pagePath, readPages } from '../plugins/llms.ts';
import { SITE_PAGES, UI_PAGES } from '../plugins/markdown.ts';

const docs = fileURLToPath(new URL('../docs/', import.meta.url));
const ui = fileURLToPath(new URL('../ui/', import.meta.url));
const origin = 'https://example.test';
const pages = readPages(docs, ui, '/');

describe('llms.txt', () => {
  const text = llmsTxt(pages, origin, '/');

  it('lists every page of the docs', () => {
    for (const page of SITE_PAGES) {
      expect(text).toContain(`(${origin}/docs/${page || 'index'}.md)`);
    }
  });

  it('lists every page of @brumate/ui that is a file', () => {
    for (const page of [...UI_PAGES].filter(Boolean)) {
      expect(text).toContain(`(${origin}/ui/${page}.md)`);
    }
  });

  it('starts with the title and a summary', () => {
    expect(text.startsWith('# brumate\n\n> ')).toBe(true);
  });
});

describe('the Markdown of a page', () => {
  it('has a title and no block of the site left', () => {
    for (const page of pages) {
      expect(page.title).not.toBe('');
      expect(page.markdown).not.toMatch(/^```\S*\s+(?:demo|styled|anatomy|gallery)/m);
      expect(page.markdown).not.toMatch(/^```props/m);
      expect(page.markdown.startsWith('---')).toBe(false);
    }
  });

  it('writes a demo as its source and a props block as a table', () => {
    const button = pages.find((page) => pagePath(page) === 'ui/button.md')!;
    expect(button.markdown).toContain('| Prop | Type | Default | Description |');
    expect(button.markdown).toContain('```html\n<script>');
  });

  it('points links at the Markdown of the other page', () => {
    const button = pages.find((page) => pagePath(page) === 'ui/button.md')!;
    expect(button.markdown).toContain('(/docs/typescript.md#props-types)');
  });
});

describe('llms-full.txt', () => {
  it('holds every page', () => {
    const full = llmsFull(pages, origin, '/');
    for (const page of pages) {
      expect(full).toContain(page.markdown);
    }
  });
});
