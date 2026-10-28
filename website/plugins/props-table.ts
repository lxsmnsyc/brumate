/**
 * Reads the props of a part of @brumate/ui from its `.brm` file, for the props tables of the docs
 * (the props-table contract). The type comes from `<script module>`, the defaults from the
 * destructuring of `$props` in the other script, and the descriptions from the doc comments.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'brumate';
import type { Script } from 'brumate';

type Program = Script['program'];

/** The folder of the parts. */
export const PART_FILES = new URL('../../packages/ui/src/', import.meta.url);

/** The sections of a page, in order (the props-table contract). */
export const SECTIONS = [
  'Anatomy',
  'Props',
  'Data attributes',
  'Keyboard',
  'Controlled and uncontrolled',
  'Styling',
];

export interface PropRow {
  name: string;
  type: string;
  /** The source of the default, or an empty string. */
  default: string;
  required: boolean;
  description: string;
}

const AS_DESCRIPTION =
  'Renders another element or a component. The other props are those of the target.';

type Node = { type: string; start: number; end: number; [key: string]: unknown };

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The doc comment right before `start`, as one paragraph. */
function docComment(source: string, start: number): string {
  const match = /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*$/.exec(source.slice(0, start));
  if (!match) {
    return '';
  }
  return collapse(
    match[1]!
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, ''))
      .join(' '),
  );
}

function keyName(key: Node, source: string): string {
  return key.type === 'Identifier'
    ? (key.name as string)
    : (JSON.parse(source.slice(key.start, key.end).replace(/^'|'$/g, '"')) as string);
}

/** The members of the exported type of that name in a program, or undefined. */
function members(program: Program, name: string): Node[] | undefined {
  for (const statement of program.body as unknown as Node[]) {
    if (statement.type !== 'ExportNamedDeclaration') {
      continue;
    }
    const declaration = statement.declaration as Node | null;
    if (declaration?.type === 'TSInterfaceDeclaration') {
      if ((declaration.id as Node & { name: string }).name === name) {
        return (declaration.body as { body: Node[] }).body;
      }
    } else if (declaration?.type === 'TSTypeAliasDeclaration') {
      const alias = declaration.typeAnnotation as Node;
      if (
        (declaration.id as Node & { name: string }).name === name &&
        alias.type === 'TSTypeLiteral'
      ) {
        return alias.members as Node[];
      }
    }
  }
  return undefined;
}

/** The defaults of the destructuring of `$props`, by name. */
function defaults(program: Program, source: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const statement of program.body as unknown as Node[]) {
    if (statement.type !== 'VariableDeclaration') {
      continue;
    }
    for (const declarator of statement.declarations as Node[]) {
      const init = declarator.init as Node | null;
      const id = declarator.id as Node;
      const callee = init?.type === 'CallExpression' ? (init.callee as Node) : undefined;
      if (
        callee?.type !== 'Identifier' ||
        callee.name !== '$props' ||
        id.type !== 'ObjectPattern'
      ) {
        continue;
      }
      for (const property of id.properties as Node[]) {
        const value = property.value as Node | undefined;
        if (property.type === 'Property' && value?.type === 'AssignmentPattern') {
          const right = value.right as Node;
          found.set(
            keyName(property.key as Node, source),
            collapse(source.slice(right.start, right.end)),
          );
        }
      }
    }
  }
  return found;
}

/**
 * The rows of the props table of a part: its props in the order of the type, with `as` first for
 * a part that has it. Throws for a part with no readable exported type.
 */
export function readProps(part: string, file = new URL(`${part}.brm`, PART_FILES)): PropRow[] {
  const source = readFileSync(file, 'utf8');
  const sfc = parse(source, { filename: `${part}.brm` });
  const program = sfc.moduleScript?.program;
  const own = program && members(program, `${part}OwnProps`);
  const list = own ?? (program && members(program, `${part}Props`));
  if (!list) {
    throw new Error(`${part}: no exported ${part}OwnProps or ${part}Props in <script module>`);
  }
  const given = sfc.instanceScript ? defaults(sfc.instanceScript.program, source) : new Map();
  const rows: PropRow[] = [];
  if (own) {
    // The default of `T` is the element that the part renders.
    const root = /=\s*([^,>]+?)\s*(?:,|$)/.exec(sfc.generics ?? '')?.[1];
    rows.push({
      name: 'as',
      type: 'AsTarget',
      default: root ?? 'none',
      required: false,
      description: AS_DESCRIPTION,
    });
  }
  for (const member of list) {
    // Index signatures and method signatures get no row (the props-table contract).
    if (member.type !== 'TSPropertySignature') {
      continue;
    }
    const annotation = member.typeAnnotation as { typeAnnotation: Node } | null;
    const name = keyName(member.key as Node, source);
    rows.push({
      name,
      type: annotation
        ? collapse(source.slice(annotation.typeAnnotation.start, annotation.typeAnnotation.end))
        : 'unknown',
      default: given.get(name) ?? '',
      required: !member.optional,
      description: docComment(source, member.start),
    });
  }
  return rows;
}

function escape(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** The text of a description, with a backtick pair as code. */
function describe(text: string): string {
  return escape(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** The HTML of a props table. */
export function renderProps(rows: PropRow[]): string {
  const body = rows
    .map((row) => {
      const fallback = row.required ? '<em>required</em>' : '';
      const value = row.default ? `<code>${escape(row.default)}</code>` : fallback;
      return `<tr><td><code>${escape(row.name)}</code></td><td><code>${escape(row.type)}</code></td><td>${value}</td><td>${describe(row.description)}</td></tr>`;
    })
    .join('\n');
  // The wrapper scrolls, so it takes focus: a keyboard user can scroll a wide table.
  return `<div class="props-scroll" role="group" aria-label="Props" tabindex="0">\n<table class="props-table">\n<thead><tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>\n</div>\n`;
}
