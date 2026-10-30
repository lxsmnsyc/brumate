// The tests of the skill that ships in this package. Each `brm` block of the skill is a page: it
// is written out with its imports of `@brumate/ui` turned into paths in `src`, compiled by the
// plugin, rendered on the server. A block marked `wrong: message`
// fails to compile with exactly that message.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from 'brumate/server';
import { CompileError, compile } from '../../brumate/src/index.ts';

// The tests run in the folder of the package.
const ROOT = process.cwd();
const SKILL = join(ROOT, 'skills/brumate-ui/');
const PACKAGE = join(ROOT, 'package.json');
const SRC = join(ROOT, 'src/');
const OUT = join(ROOT, 'test/.output/skill/');

/** The files of the skill, as paths under its folder. */
const FILES = [
  'SKILL.md',
  ...readdirSync(`${SKILL}references`).map((name) => `references/${name}`),
];

interface Block {
  file: string;
  line: number;
  /**
   * The words after `brm` in the fence: nothing for a page that compiles and renders,
   * `fragment` for a piece that is not a page, and `wrong: message` for a page that fails with
   * exactly that message.
   */
  info: string;
  source: string;
}

/** The `brm` blocks of a markdown file. */
function blocks(file: string): Block[] {
  const lines = readFileSync(SKILL + file, 'utf8').split('\n');
  const found: Block[] = [];
  for (let index = 0; index < lines.length; index++) {
    const fence = /^```brm(?:\s+(.*))?$/.exec(lines[index]!);
    if (!fence) {
      continue;
    }
    const start = index + 1;
    let end = start;
    while (lines[end] !== '```') {
      end++;
    }
    found.push({
      file,
      line: start,
      info: fence[1] ?? '',
      source: lines.slice(start, end).join('\n') + '\n',
    });
    index = end;
  }
  return found;
}

const all = FILES.flatMap(blocks);
const right = all.filter((block) => block.info === '');
const wrong = all.flatMap((block) => {
  const found = /^wrong: (.*)$/.exec(block.info);
  return found ? [{ block, text: found[1]! }] : [];
});

/** A page of the skill, with the imports of `@brumate/ui` turned into paths in `src`. */
function page(block: Block): string {
  return block.source.replaceAll("'@brumate/ui/", "'../../../src/");
}

/** The path of the file that a block is written to. */
function pathOf(block: Block): string {
  return `${OUT}${block.file.replace(/\W+/g, '-')}-${block.line}.brm`;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const block of right) {
  writeFileSync(pathOf(block), page(block));
}

/** The first error that a file reports, without its place and its code. */
function firstMessage(error: unknown): string {
  if (error instanceof CompileError) {
    return error.diagnostics[0]!.message;
  }
  return (error as Error).message
    .replace(/(?:\s\([^()]*:\d+:\d+\))+$/, '')
    .replace(/\s\[BRM\d+\]$/, '');
}

describe('the skill', () => {
  it('has a name and a description', () => {
    const text = readFileSync(`${SKILL}SKILL.md`, 'utf8');
    const front = /^---\nname: (.+)\ndescription: (.+)\n---\n/.exec(text);
    expect(front?.[1]).toBe('brumate-ui');
    expect(front?.[2]?.length).toBeGreaterThan(40);
    expect(front?.[2]?.length).toBeLessThanOrEqual(1024);
  });

  it('stays short, and puts the detail in references', () => {
    expect(readFileSync(`${SKILL}SKILL.md`, 'utf8').split('\n').length).toBeLessThan(100);
  });

  it('links to files that exist', () => {
    for (const file of FILES) {
      for (const [, target] of readFileSync(SKILL + file, 'utf8').matchAll(
        /\]\(((?:references\/)?[\w-]+\.md)[)#]/g,
      )) {
        const path = file.startsWith('references/') ? `references/${target}` : target;
        expect(FILES).toContain(path);
      }
    }
  });

  it('links every reference from SKILL.md', () => {
    const text = readFileSync(`${SKILL}SKILL.md`, 'utf8');
    for (const file of FILES.filter((name) => name !== 'SKILL.md')) {
      expect(text).toContain(`](${file})`);
    }
  });

  it('describes the parts without naming another library', () => {
    for (const file of FILES) {
      expect(readFileSync(SKILL + file, 'utf8')).not.toMatch(/react[ -]?aria|stately/i);
    }
  });

  it('ships in the package', () => {
    const { files } = JSON.parse(readFileSync(PACKAGE, 'utf8')) as { files: string[] };
    expect(files).toContain('skills');
  });

  it('has code blocks to test', () => {
    expect(right.length).toBeGreaterThan(20);
    expect(wrong.length).toBeGreaterThanOrEqual(3);
    expect(all.length).toBe(right.length + wrong.length);
  });

  it('imports only parts that exist', () => {
    const parts = new Set(readdirSync(SRC));
    for (const block of all) {
      for (const [, name] of block.source.matchAll(/'@brumate\/ui\/([^']+)'/g)) {
        expect(parts).toContain(name);
      }
    }
  });
});

describe('the code blocks', () => {
  it.each(right.map((block) => [`${block.file}:${block.line}`, block] as const))(
    '%s compiles and renders',
    async (_name, block) => {
      const module = await import(/* @vite-ignore */ `${pathOf(block)}?brumate-server`);
      const rendered = await render(module.default, {});
      expect(rendered.html).not.toBe('');
    },
  );

  // The compiler accepts `count.value++`, so look for it.
  it.each(right.map((block) => [`${block.file}:${block.line}`, block] as const))(
    '%s does not read .value of a signal',
    (_name, block) => {
      const names = [
        ...block.source.matchAll(
          /(?:let|const)\s+(\w+)[^=\n]*=\s*\$(?:signal|memo|debounced|throttled|optimistic)\b/g,
        ),
      ].map((match) => match[1]!);
      for (const name of names) {
        expect(block.source).not.toMatch(new RegExp(`\\b${name}\\.value\\b`));
      }
    },
  );

  it.each(wrong.map((item) => [`${item.block.file}:${item.block.line}`, item] as const))(
    '%s fails with the error that it names',
    (_name, { block, text }) => {
      let error: unknown;
      try {
        compile(page(block), { filename: 'Example.brm' });
      } catch (thrown) {
        error = thrown;
      }
      expect(error).toBeInstanceOf(Error);
      expect(firstMessage(error)).toBe(text);
    },
  );
});
