import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { CompileError, compile } from '../src/index.ts';
import { ERRORS, findError, renderErrors } from '../src/error-catalog.ts';

const SKILL = fileURLToPath(new URL('../skills/brumate/', import.meta.url));
const SRC = fileURLToPath(new URL('../src/', import.meta.url));

/** The files of the skill, as paths under its folder. */
const FILES = [
  'SKILL.md',
  ...readdirSync(`${SKILL}references`).map((name) => `references/${name}`),
];

interface Block {
  file: string;
  line: number;
  /** The words after `brm` in the fence. */
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

const hand = FILES.filter((file) => file !== 'references/errors.md');
const all = hand.flatMap(blocks);

describe('the skill', () => {
  it('has a name and a description', () => {
    const text = readFileSync(`${SKILL}SKILL.md`, 'utf8');
    const front = /^---\nname: (.+)\ndescription: (.+)\n---\n/.exec(text);
    expect(front?.[1]).toBe('brumate');
    expect(front?.[2]?.length).toBeGreaterThan(40);
    expect(front?.[2]?.length).toBeLessThanOrEqual(1024);
  });

  it('links to files that exist', () => {
    for (const file of hand) {
      for (const [, target] of readFileSync(SKILL + file, 'utf8').matchAll(
        /\]\((references\/[^)#]+)\)/g,
      )) {
        expect(FILES, `${file} links to ${target}`).toContain(target);
      }
    }
  });

  it('has code blocks to test', () => {
    expect(right.length).toBeGreaterThan(10);
    expect(wrong.length).toBeGreaterThan(8);
  });
});

const right = all.filter((block) => block.info === '');
const wrong = all.flatMap((block) => {
  const found = /^wrong="(.*)"$/.exec(block.info);
  return found ? [{ block, text: found[1]! }] : [];
});

describe('the code blocks', () => {
  it('all have a known mark', () => {
    const marks = all.filter((block) => block.info !== '' && block.info !== 'fragment');
    expect(marks.length).toBe(wrong.length);
  });

  it.each(right.map((block) => [`${block.file}:${block.line}`, block] as const))(
    '%s compiles',
    (_name, block) => {
      expect(() => compile(block.source, { filename: 'Example.brm' })).not.toThrow();
    },
  );

  it.each(wrong.map((item) => [`${item.block.file}:${item.block.line}`, item] as const))(
    '%s fails with the error that it names',
    (_name, { block, text }) => {
      let error: unknown;
      try {
        compile(block.source, { filename: 'Example.brm' });
      } catch (thrown) {
        error = thrown;
      }
      // The block must fail, with the message that the skill names.
      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;
      expect(message).toContain(text);
      // The error is in the catalog, so errors.md explains it.
      const first = error instanceof CompileError ? error.diagnostics[0]!.message : message;
      expect(findError(first)).toBeDefined();
    },
  );
});

describe('brumate skill', () => {
  it('copies the skill into the folder', () => {
    const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
    const folder = mkdtempSync(join(tmpdir(), 'brumate-skill-'));
    try {
      execFileSync('node', [cli, 'skill', join(folder, '.claude/skills')], { stdio: 'pipe' });
      for (const file of FILES) {
        expect(readFileSync(join(folder, '.claude/skills/brumate', file), 'utf8')).toBe(
          readFileSync(SKILL + file, 'utf8'),
        );
      }
    } finally {
      rmSync(folder, { recursive: true });
    }
  });
});

describe('errors.md', () => {
  it('is rendered from the catalog', () => {
    const file = `${SKILL}references/errors.md`;
    if (process.env.UPDATE_SKILL) {
      writeFileSync(file, renderErrors());
    }
    expect(readFileSync(file, 'utf8')).toBe(renderErrors());
  });
});

/** A message with every `{name}` or `${…}` as `{}`, so two forms of one message are equal. */
function shape(message: string): string {
  return message.replace(/\{\w+\}/g, '{}');
}

type Node = { type: string; [key: string]: any };

function walk(node: unknown, visit: (node: Node) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      walk(item, visit);
    }
  } else if (node && typeof node === 'object') {
    if ('type' in node) {
      visit(node as Node);
    }
    for (const value of Object.values(node)) {
      walk(value, visit);
    }
  }
}

/** The messages that the code of a file can report, from the literals that it passes. */
function reported(file: string): string[] {
  const source = readFileSync(SRC + file, 'utf8');
  const { program } = parseSync(file, source);
  // Constants that hold a message, and the tables of messages.
  const named = new Map<string, Node[]>();
  walk(program, (node) => {
    let name: string | undefined;
    let value: Node | undefined;
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init) {
      name = node.id.name;
      value = node.init;
    } else if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') {
      name = node.left.name;
      value = node.right;
    }
    if (name && value) {
      named.set(name, [...(named.get(name) ?? []), value]);
    }
  });
  const found: string[] = [];
  const add = (node: Node | undefined | null): void => {
    if (!node) {
      return;
    }
    if (node.type === 'Literal' && typeof node.value === 'string') {
      found.push(node.value);
    } else if (node.type === 'TemplateLiteral') {
      found.push(node.quasis.map((quasi: Node) => quasi.value.cooked).join('{}'));
    } else if (node.type === 'ConditionalExpression') {
      add(node.consequent);
      add(node.alternate);
    } else if (node.type === 'LogicalExpression') {
      add(node.left);
      add(node.right);
    } else if (node.type === 'TSNonNullExpression') {
      add(node.expression);
    } else if (node.type === 'MemberExpression' && node.object.type === 'Identifier') {
      // A table of messages, such as MISPLACED[name].
      for (const table of named.get(node.object.name) ?? []) {
        if (table.type === 'ObjectExpression') {
          for (const property of table.properties) {
            add(property.value);
          }
        }
      }
    } else if (node.type === 'Identifier') {
      // A message that the code keeps in a constant, as `const message = '…'`.
      for (const init of named.get(node.name) ?? []) {
        add(init);
      }
    }
  };
  const callee = (node: Node): string => {
    if (node.callee.type === 'Identifier') {
      return node.callee.name;
    }
    return node.callee.type === 'MemberExpression' ? node.callee.property.name : '';
  };
  walk(program, (node) => {
    if (node.type === 'CallExpression' || node.type === 'NewExpression') {
      const name = callee(node);
      if (name === 'fail') {
        add(node.arguments[0]);
      } else if (name === 'report' && node.arguments[0]?.value === 'error') {
        add(node.arguments[1]);
      } else if (name === 'ModuleError') {
        add(node.arguments[0]);
      } else if (name === 'expect' && node.arguments[1]) {
        add(node.arguments[1]);
      } else if (name === 'parseIdentifier') {
        add(node.arguments[2]);
      }
    }
    if (node.type === 'ObjectExpression') {
      const severity = node.properties.find((property: Node) => property.key?.name === 'severity');
      const message = node.properties.find((property: Node) => property.key?.name === 'message');
      if (severity?.value?.value === 'error' && message) {
        add(message.value);
      }
    }
  });
  // The default message of the parser's expect().
  if (file === 'parser.ts') {
    found.push('Expected "{}"');
  }
  return found;
}

describe('the catalog', () => {
  const messages = new Set<string>();
  for (const file of readdirSync(SRC).filter((name) => name.endsWith('.ts'))) {
    for (const message of reported(file)) {
      // A message that passes on another one, such as the error of a parser, has no form of its own.
      if (message.replace(/\{\}|[\s()]/g, '') !== '') {
        messages.add(`${file}: ${message}`);
      }
    }
  }

  it('finds the messages of the compiler', () => {
    expect(messages.size).toBeGreaterThan(100);
  });

  it('has an entry for each message of the compiler', () => {
    const forms = new Set(ERRORS.map((error) => shape(error.message)));
    const missing = [...messages].filter((message) => {
      const text = message.slice(message.indexOf(': ') + 2);
      return !forms.has(shape(text));
    });
    expect(missing).toEqual([]);
  });

  it('has no entry twice', () => {
    const forms = ERRORS.map((error) => shape(error.message));
    expect(forms.filter((form, index) => forms.indexOf(form) !== index)).toEqual([]);
  });

  it('gives each entry a cause and a fix', () => {
    for (const error of ERRORS) {
      expect(error.cause).not.toBe('');
      expect(error.fix).not.toBe('');
    }
  });
});
