import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The anatomy pictures and the styled examples of website/ui, checked against their pages, so the
// numbers, the lists and the demos cannot drift apart.

const UI = new URL('../ui/', import.meta.url);

interface Block {
  page: string;
  kind: 'anatomy' | 'styled';
  name: string;
  lines: string[];
  /** The tags of the first `html` block after `## Anatomy`, in order. */
  tree: string[];
  text: string;
}

function blocks(): Block[] {
  const found: Block[] = [];
  for (const file of readdirSync(UI)) {
    if (!file.endsWith('.md')) {
      continue;
    }
    const text = readFileSync(new URL(file, UI), 'utf8');
    const anatomy = text.indexOf('\n## Anatomy');
    const tree: string[] = [];
    if (anatomy !== -1) {
      const html = /```html\n([\s\S]*?)```/.exec(text.slice(anatomy));
      for (const match of (html?.[1] ?? '').matchAll(/<([A-Z]\w*)/g)) {
        tree.push(match[1]!);
      }
    }
    for (const match of text.matchAll(
      /^```(?:brm|html) (anatomy|styled) (\w+)\n([\s\S]*?)^```/gm,
    )) {
      found.push({
        page: file,
        kind: match[1] as Block['kind'],
        name: match[2]!,
        lines: match[3]!.split('\n').filter((line) => line.trim()),
        tree,
        text,
      });
    }
  }
  return found;
}

const all = blocks();
const demo = (name: string): URL => new URL(`demos/${name}.brm`, UI);

describe('anatomy and styled blocks', () => {
  it('finds the blocks', () => {
    expect(all.some((block) => block.kind === 'anatomy')).toBe(true);
    expect(all.some((block) => block.kind === 'styled')).toBe(true);
  });

  for (const block of all.filter((item) => item.kind === 'anatomy')) {
    describe(`${block.page}: anatomy ${block.name}`, () => {
      it('has its demo file', () => {
        expect(() => readFileSync(demo(block.name))).not.toThrow();
      });

      it('is named for an anatomy, with marks 1 to N for the N lines', () => {
        expect(block.name.endsWith('Anatomy')).toBe(true);
        const source = readFileSync(demo(block.name), 'utf8');
        const marks = [...source.matchAll(/data-mark="(\d+)"/g)].map((match) => Number(match[1]));
        const expected = block.lines.map((_, index) => index + 1);
        expect([...new Set(marks)].toSorted((a, b) => a - b)).toEqual(expected);
        // A number is used once.
        expect(marks.length).toBe(expected.length);
      });

      it('lists the pieces in the order of the tag tree', () => {
        const names = block.lines.map((line) => /^`(\w+)`/.exec(line)?.[1]);
        expect(names.every(Boolean)).toBe(true);
        // Every name is a tag of the tree, in its order. A tree may hold tags that the
        // picture leaves out.
        let from = 0;
        for (const name of names) {
          const at = block.tree.indexOf(name!, from);
          expect(at, `${name} is not in the tag tree, or is out of order`).toBeGreaterThanOrEqual(
            0,
          );
          from = at + 1;
        }
      });

      it('says when it draws a Popover in place', () => {
        const source = readFileSync(demo(block.name), 'utf8');
        const says = block.text.includes('draws the Popover in place');
        expect(source.includes('anatomy-popover') ? says : true).toBe(true);
      });
    });
  }

  for (const block of all.filter((item) => item.kind === 'styled')) {
    describe(`${block.page}: styled ${block.name}`, () => {
      it('has its demo file, with a stylesheet of its own', () => {
        expect(readFileSync(demo(block.name), 'utf8')).toContain('<style>');
      });
    });
  }

  it('shares no class between two styled demos', () => {
    const owner = new Map<string, string>();
    for (const block of all.filter((item) => item.kind === 'styled')) {
      const source = readFileSync(demo(block.name), 'utf8');
      const style = source.slice(source.indexOf('<style>'));
      for (const match of style.matchAll(/\.([a-z][\w-]*)/g)) {
        const previous = owner.get(match[1]!);
        expect(
          previous === undefined || previous === block.name,
          `.${match[1]} is in two demos`,
        ).toBe(true);
        owner.set(match[1]!, block.name);
      }
    }
  });
});
