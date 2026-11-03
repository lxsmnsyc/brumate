import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { splitFrontMatter } from '../plugins/front-matter.ts';
import { groups } from '../src/ui-groups.ts';

// The groups of the sidebar and the summaries of the cards come from different places, so this
// checks that they agree with the pages in website/ui.

const UI = new URL('../ui/', import.meta.url);

const names: string[] = [];
for (const file of readdirSync(UI)) {
  if (file.endsWith('.md')) {
    names.push(file.slice(0, -3));
  }
}

describe('groups of the pages of @brumate/ui', () => {
  const counts = new Map<string, number>();
  for (const group of groups) {
    for (const page of group.pages) {
      counts.set(page, (counts.get(page) ?? 0) + 1);
    }
  }

  it('has a page for each name', () => {
    for (const page of counts.keys()) {
      expect(names, `${page} is in a group but has no page`).toContain(page);
    }
  });

  it('puts every page in one group', () => {
    for (const page of names) {
      expect(counts.get(page) ?? 0, `${page} must be in exactly one group`).toBe(1);
    }
  });

  it('gives every part a summary', () => {
    for (const group of groups) {
      if (group.title === 'Start') {
        continue;
      }
      for (const page of group.pages) {
        const { data } = splitFrontMatter(readFileSync(new URL(`${page}.md`, UI), 'utf8'));
        expect(data.summary?.trim(), `${page}.md needs a summary in its front matter`).toBeTruthy();
      }
    }
  });
});
