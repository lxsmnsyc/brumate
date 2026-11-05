import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECTIONS } from '../plugins/props-table.ts';

// Each page of a part has the sections of the props-table contract in their order, then Use cases,
// then the sections about the part itself. The pages of ideas are outside this list.

const UI = new URL('../ui/', import.meta.url);
const DOCS = new URL('../docs/', import.meta.url);

const CONCEPT_PAGES = new Set([
  'index',
  'introduction',
  'styling',
  'state',
  'resuming',
  'layers',
  'influences',
]);
const USE_CASES = 'Use cases';

/** The h2 headings of a page, outside code blocks. */
function readHeadings(source: string): string[] {
  const headings: string[] = [];
  let fence = '';
  for (const line of source.split('\n')) {
    const mark = /^(`{3,}|~{3,})/.exec(line);
    if (mark) {
      if (!fence) {
        fence = mark[1]!;
      } else if (mark[1]![0] === fence[0] && mark[1]!.length >= fence.length) {
        fence = '';
      }
      continue;
    }
    const heading = fence ? null : /^## (.*)$/.exec(line);
    if (heading) {
      headings.push(heading[1]!.trim());
    }
  }
  return headings;
}

/** The headings that are out of order: SECTIONS, then Use cases, then the others. */
function findOrderProblems(headings: string[]): string[] {
  const order = [...SECTIONS, USE_CASES];
  const problems: string[] = [];
  let last = -1;
  let lastHeading = '';
  let sawTopic = '';
  for (const heading of headings) {
    const place = order.indexOf(heading);
    if (place === -1) {
      sawTopic = sawTopic || heading;
    } else if (sawTopic) {
      problems.push(`${heading} comes after ${sawTopic}, a section about the part`);
    } else if (place < last) {
      problems.push(`${heading} comes after ${lastHeading}`);
    } else {
      last = place;
      lastHeading = heading;
    }
  }
  return problems;
}

function listPages(directory: URL): string[] {
  const names: string[] = [];
  for (const file of readdirSync(directory)) {
    if (file.endsWith('.md')) {
      names.push(file.slice(0, -3));
    }
  }
  return names;
}

describe('sections of the pages of @brumate/ui', () => {
  for (const name of listPages(UI)) {
    if (CONCEPT_PAGES.has(name)) {
      continue;
    }
    it(`${name} keeps the order of the sections`, () => {
      const headings = readHeadings(readFileSync(new URL(`${name}.md`, UI), 'utf8'));
      expect(findOrderProblems(headings)).toEqual([]);
    });
  }

  it('names one idea with one heading', () => {
    const renamed = new Map([
      ['Style', 'Styling'],
      ['Rows from data', 'Items from data'],
      ['Keys and screen readers', 'Focus and keys'],
    ]);
    for (const name of listPages(UI)) {
      const headings = readHeadings(readFileSync(new URL(`${name}.md`, UI), 'utf8'));
      for (const heading of headings) {
        expect(renamed.has(heading), `${name}: use ${renamed.get(heading)} for ${heading}`).toBe(
          false,
        );
      }
    }
  });
});

describe('fences of .brm samples', () => {
  it('use brm, not html', () => {
    for (const directory of [UI, DOCS]) {
      for (const name of listPages(directory)) {
        const source = readFileSync(new URL(`${name}.md`, directory), 'utf8');
        expect(/^```html(\s|$)/m.test(source), `${name}.md has an html fence`).toBe(false);
      }
    }
  });
});
