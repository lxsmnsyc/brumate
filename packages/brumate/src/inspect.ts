import { builtin } from './node.ts';
import type { Markup } from './ast.ts';
import { compile } from './compile.ts';
import type { CompileOptions, CompileResult } from './compile.ts';
import { getLocation } from './error.ts';
import type { GraphNode } from './graph.ts';
import type { AnchorTarget } from './plan.ts';
import type { Declaration, Scope, Site } from './model.ts';
import { forEachNode } from './project.ts';

export interface InspectEntry {
  /** What it is, such as `signal count` or `event button.click`. */
  label: string;
  /** `line:column` in the source. */
  at: string;
  /** Why it ships or changes. */
  reason: string;
}

export interface InspectReport {
  filename: string;
  name: string;
  id: string;
  /** Code that runs in the browser when an event or trigger happens. */
  roots: InspectEntry[];
  /** Values and markup that can change on the client. */
  changes: InspectEntry[];
  /** Serialized values, by scope. */
  state: { scope: string; slots: string[] }[];
  /** Markup that ships as HTML only. */
  staticMarkup: { elements: number; inserts: number };
  /** The size of each client module, in bytes. */
  sizes: { module: string; bytes: number; gzip: number }[];
}

function at(source: string, range: { start: number }): string {
  const { line, column } = getLocation(source, range.start);
  return `${line}:${column}`;
}

function siteLabel(source: string, site: Site): string {
  return `${site.label} (${at(source, site.range)})`;
}

/** A short name for a scope, such as `body of #for (12:3)`. */
/** A short name of an anchor for the devtools: its tag, its block, or `$client`. */
export function anchorLabel(target: AnchorTarget): string {
  if ('range' in target) {
    return target.kind === 'client' ? '$client' : target.label;
  }
  switch (target.kind) {
    case 'element':
      return `<${target.tag}>`;
    case 'component':
      return `<${target.name}>`;
    case 'dynamic':
      return '<dynamic tag>';
    case 'listener':
      return `#${target.target} listener`;
    case 'insert':
      return 'insert';
    default:
      return `#${target.kind}`;
  }
}

export function scopeLabel(source: string, scope: Scope): string {
  if (scope.kind === 'body' && scope.block) {
    return `body of #${scope.block.kind} (${at(source, scope.block)})`;
  }
  if (scope.kind === 'template' && scope.template) {
    return `#template ${scope.template.name}`;
  }
  return scope.kind;
}

function list(items: string[]): string {
  return items.length > 2
    ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
    : items.join(' and ');
}

function nodeLabel(node: GraphNode): string {
  return node.kind === 'source' || node.kind === 'memo'
    ? `${node.declaration.kind} ${node.declaration.name}`
    : node.site.label;
}

/** Describes what a compiled component ships to the client, and why. */
export function report(
  source: string,
  result: CompileResult,
  liveProps?: Set<string>,
  parents?: Map<string, Set<string>>,
): InspectReport {
  const { plan } = result;
  const { graph } = plan;

  const roots: InspectEntry[] = [];
  for (const [site, symbol] of plan.symbols) {
    const reached = new Set<string>();
    const visit = (current: Site): void => {
      for (const callee of current.calls) {
        if (callee.kind === 'server-function') {
          reached.add(`${callee.name} (server)`);
        } else if (callee.kind === 'function' && callee.site && !reached.has(callee.name)) {
          reached.add(callee.name);
          visit(callee.site);
        }
      }
    };
    visit(site);
    let kind = 'runs on the event';
    if (site.kind === 'client') {
      kind = `runs when the browser is ${site.trigger === 'load' ? 'loaded' : site.trigger}`;
    } else if (site.kind === 'prop') {
      kind = 'a function passed to a component';
    }
    roots.push({
      label: `${symbol}: ${site.label}`,
      at: at(source, site.range),
      reason: reached.size > 0 ? `${kind}, calls ${list([...reached])}` : kind,
    });
  }

  const changes: InspectEntry[] = [];
  for (const node of graph.nodes) {
    if (!graph.live.has(node)) {
      continue;
    }
    let reason: string;
    if (node.kind === 'source') {
      const declaration = node.declaration;
      reason = sourceReason(source, declaration, graph.reached, liveProps, parents);
      changes.push({ label: nodeLabel(node), at: at(source, declaration.range), reason });
      continue;
    }
    const from = graph.edges
      .filter((edge) => edge.to === node && graph.live.has(edge.from))
      .map((edge) => nodeLabel(edge.from));
    reason = from.length > 0 ? `reads ${list(from)}` : 'changes on the client';
    changes.push({ label: nodeLabel(node), at: at(source, node.site.range), reason });
  }

  const state: InspectReport['state'] = [];
  for (const [scope, layout] of plan.scopes) {
    if (layout.slots.length > 0) {
      state.push({
        scope: scopeLabel(source, scope),
        slots: layout.slots.map((slot) => slot.name),
      });
    }
  }

  let elements = 0;
  let inserts = 0;
  const count = (node: Markup): void => {
    // An element with handlers ships client code, even when it finds its scope from an element around it.
    if (
      node.kind === 'element' &&
      !plan.anchors.has(node) &&
      !node.attributes.some((attribute) => attribute.kind === 'event')
    ) {
      elements++;
    } else if (node.kind === 'insert' && !plan.anchors.has(node)) {
      inserts++;
    }
  };
  forEachNode(result.file.children, count);
  for (const template of result.file.templates) {
    forEachNode(template.body.children, count);
  }

  const sizes: InspectReport['sizes'] = [];
  const add = (module: string, code: string): void => {
    // Outside Node, such as in a browser, the gzip size is not measured.
    const zlib = builtin('node:zlib');
    sizes.push({
      module,
      bytes: new TextEncoder().encode(code).length,
      gzip: zlib ? zlib.gzipSync(code).length : 0,
    });
  };
  add('entry', result.client);
  for (const [name, code] of Object.entries(result.parts)) {
    if (/export /.test(code)) {
      add(name, code);
    }
  }

  return {
    filename: result.file.filename,
    name: plan.name,
    id: plan.id,
    roots,
    changes,
    state,
    staticMarkup: { elements, inserts },
    sizes,
  };
}

function sourceReason(
  source: string,
  declaration: Declaration,
  reached: Set<Site>,
  liveProps: Set<string> | undefined,
  parents: Map<string, Set<string>> | undefined,
): string {
  switch (declaration.kind) {
    case 'signal': {
      const writers = declaration.writes
        .filter((write) => reached.has(write.site))
        .map((write) => siteLabel(source, write.site));
      const unique = [...new Set(writers)];
      if (unique.length > 0) {
        return `written by ${list(unique)}`;
      }
      return 'its element is created on the client';
    }
    case 'prop':
    case 'props-rest': {
      if (!liveProps) {
        return 'compiled alone, so every prop can change';
      }
      const keys = declaration.propKey
        ? [declaration.propKey, '*', ...(declaration.propKey === 'children' ? [] : ['~'])]
        : [...(parents?.keys() ?? [])];
      const files = new Set<string>();
      for (const key of keys) {
        for (const file of parents?.get(key) ?? []) {
          files.add(file);
        }
      }
      if (files.size === 0) {
        return 'a parent passes a value that changes';
      }
      return `${list([...files])} ${files.size === 1 ? 'passes' : 'pass'} a value that changes`;
    }
    case 'item':
    case 'index':
      return 'its list changes';
    case 'error':
      return 'its #try body changes';
    case 'template-param':
      return 'a call to its template changes';
    default:
      return 'changes on the client';
  }
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Formats a report as text. */
export function formatReport(value: InspectReport): string {
  const lines = [`${value.name} (${value.filename}) ${value.id}`, ''];
  const section = (title: string, entries: InspectEntry[]): void => {
    lines.push(title);
    if (entries.length === 0) {
      lines.push('  none');
    }
    for (const entry of entries) {
      lines.push(`  ${entry.label} (${entry.at})`, `    ${entry.reason}`);
    }
    lines.push('');
  };
  section('Client code', value.roots);
  section('Changes on the client', value.changes);
  lines.push('State');
  if (value.state.length === 0) {
    lines.push('  none');
  }
  for (const item of value.state) {
    lines.push(`  ${item.scope}: ${item.slots.join(', ')}`);
  }
  lines.push('');
  lines.push(
    'HTML only',
    `  ${plural(value.staticMarkup.elements, 'element')} and ${plural(value.staticMarkup.inserts, 'inserted value')} ship no client code`,
    '',
  );
  lines.push('Client modules, before minifying (bytes, gzip)');
  for (const size of value.sizes) {
    lines.push(`  ${size.module}: ${size.bytes} B, ${size.gzip} B`);
  }
  return lines.join('\n');
}

export interface InspectOptions extends CompileOptions {
  /** For each prop that can change, the files that change it, from `analyzeProjectProps`. */
  parents?: Map<string, Set<string>>;
}

/** Compiles a file and describes what it ships to the client, and why. */
export function inspect(
  source: string,
  options: InspectOptions = {},
): { report: InspectReport; text: string } {
  const result = compile(source, options);
  const value = report(source, result, options.liveProps, options.parents);
  return { report: value, text: formatReport(value) };
}
