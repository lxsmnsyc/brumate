import type { Attribute, Block, Body, Markup, Range, SFCFile } from './ast.ts';
import { getLocation } from './error.ts';
import type { Graph, GraphNode } from './graph.ts';
import type { Diagnostic, Scope, SemanticModel, Site } from './model.ts';

function at(source: string, range: Range): string {
  const { line, column } = getLocation(source, range.start);
  return `${line}:${column}`;
}

function quote(text: string): string {
  return JSON.stringify(text);
}

function printAttribute(item: Attribute): string {
  switch (item.kind) {
    case 'static':
      return item.value === true ? item.name : `${item.name}=${quote(item.value)}`;
    case 'value':
      return `${item.name}=(${item.value.code})`;
    case 'event':
      return `${item.name}${item.modifiers.map((modifier) => `:${modifier}`).join('')}=(${item.handler.code})`;
    case 'ref':
      return `ref=$bind(${item.target})`;
    case 'spread':
      return `{...${item.value.code}}`;
    case 'computed':
      return `[${item.name.code}]${item.value === true ? '' : `=(${item.value.code})`}`;
  }
}

/** Prints the syntax tree, one node per line. */
export function printAST(file: SFCFile): string {
  const lines: string[] = [];
  const write = (depth: number, text: string): void => {
    lines.push(`${'  '.repeat(depth)}${text}`);
  };

  const body = (item: Body, depth: number, label: string): void => {
    write(depth, label);
    if (item.script) {
      write(depth + 1, 'script');
    }
    for (const template of item.templates) {
      write(depth + 1, `template ${template.name}`);
      body(template.body, depth + 2, 'body');
    }
    nodes(item.children, depth + 1);
  };

  const block = (item: Block, depth: number): void => {
    switch (item.kind) {
      case 'if':
        write(depth, 'if');
        for (const branch of item.branches) {
          body(branch.body, depth + 1, `branch (${branch.condition.code})`);
        }
        if (item.fallback) {
          body(item.fallback, depth + 1, 'else');
        }
        break;
      case 'for': {
        const key =
          item.key === undefined ? '' : ` by ${item.key === 'index' ? 'index' : item.key.code}`;
        const index = item.index ? `, ${item.index.name}` : '';
        const itemCode = file.source.slice(item.item.start, item.item.end);
        write(depth, `for (${itemCode}${index} of ${item.list.code.trim()}${key})`);
        body(item.body, depth + 1, 'body');
        if (item.fallback) {
          body(item.fallback, depth + 1, 'else');
        }
        break;
      }
      case 'repeat':
        write(
          depth,
          `repeat (${item.index ? `${item.index.name} of ` : ''}${item.count.code.trim()})`,
        );
        body(item.body, depth + 1, 'body');
        if (item.fallback) {
          body(item.fallback, depth + 1, 'else');
        }
        break;
      case 'switch':
        write(depth, 'switch');
        for (const branch of item.cases) {
          body(branch.body, depth + 1, `case (${branch.condition.code})`);
        }
        if (item.fallback) {
          body(item.fallback, depth + 1, 'default');
        }
        break;
      case 'key':
        write(depth, `key (${item.value.code})`);
        body(item.body, depth + 1, 'body');
        break;
      case 'offscreen':
        write(depth, `offscreen (${item.visible.code})`);
        body(item.body, depth + 1, 'body');
        break;
      case 'try': {
        write(depth, 'try');
        body(item.body, depth + 1, 'body');
        const names = [item.error?.name, item.reset?.name].filter(Boolean).join(', ');
        body(item.fallback, depth + 1, names ? `catch (${names})` : 'catch');
        break;
      }
      case 'loading':
        write(depth, item.on ? `loading (${item.on.code})` : 'loading');
        body(item.body, depth + 1, 'body');
        if (item.fallback) {
          body(item.fallback, depth + 1, 'else');
        }
        break;
      case 'head':
        write(depth, 'head');
        body(item.body, depth + 1, 'body');
        break;
      case 'portal':
        write(depth, item.target ? `portal (${item.target.code})` : 'portal');
        body(item.body, depth + 1, 'body');
        break;
      case 'client':
      case 'defer':
        write(depth, `${item.kind} (${item.trigger})`);
        body(item.body, depth + 1, 'body');
        if (item.fallback) {
          body(item.fallback, depth + 1, 'else');
        }
        break;
    }
  };

  const node = (item: Markup, depth: number): void => {
    switch (item.kind) {
      case 'element':
      case 'component': {
        const name = item.kind === 'element' ? item.tag : item.name;
        const attributes = item.attributes.map((value) => ` ${printAttribute(value)}`).join('');
        write(depth, `${item.kind} <${name}${attributes}>`);
        nodes(item.children, depth + 1);
        break;
      }
      case 'dynamic':
        write(
          depth,
          `dynamic <{${item.tag.code}}${item.attributes.map((value) => ` ${printAttribute(value)}`).join('')}>`,
        );
        nodes(item.children, depth + 1);
        break;
      case 'fragment':
        write(
          depth,
          item.reveal
            ? `reveal ('${item.reveal.order}'${item.reveal.collapsed ? ', collapsed' : ''})`
            : 'fragment',
        );
        nodes(item.children, depth + 1);
        break;
      case 'listener':
        write(
          depth,
          `listener <${item.target}${item.attributes.map((value) => ` ${printAttribute(value)}`).join('')}>`,
        );
        break;
      case 'text':
        write(depth, `text ${quote(item.value)}`);
        break;
      case 'insert':
        write(depth, `insert {${item.expression.code}}`);
        break;
      default:
        block(item, depth);
    }
  };

  const nodes = (items: Markup[], depth: number): void => {
    for (const item of items) {
      node(item, depth);
    }
  };

  if (file.moduleScript) {
    write(0, 'script module');
  }
  if (file.instanceScript) {
    write(0, file.generics ? `script generics=${quote(file.generics)}` : 'script');
  }
  for (const style of file.styles) {
    write(0, `style ${style.lang}`);
    for (const variable of style.variables) {
      write(1, `variable (${variable.code})`);
    }
  }
  for (const template of file.templates) {
    write(0, `template ${template.name}`);
    body(template.body, 1, 'body');
  }
  nodes(file.children, 0);
  return lines.join('\n');
}

function scopeLabel(source: string, scope: Scope): string {
  if (scope.kind === 'body' && scope.block) {
    return `${scope.id} body (${scope.block.kind} ${at(source, scope.block)})`;
  }
  if (scope.kind === 'template' && scope.template) {
    return `${scope.id} template ${scope.template.name}`;
  }
  return `${scope.id} ${scope.kind}`;
}

function siteLabel(source: string, site: Site): string {
  return `${site.label} (${at(source, site.range)})`;
}

function printDiagnostics(source: string, diagnostics: Diagnostic[], lines: string[]): void {
  if (diagnostics.length === 0) {
    return;
  }
  lines.push('diagnostics');
  for (const diagnostic of diagnostics) {
    lines.push(`  ${diagnostic.severity} ${diagnostic.message} (${at(source, diagnostic.range)})`);
  }
}

/** Prints scopes, declarations, sites and diagnostics. */
export function printModel(source: string, model: SemanticModel): string {
  const lines: string[] = [];
  for (const scope of model.scopes) {
    lines.push(`scope ${scopeLabel(source, scope)}`);
    for (const declaration of scope.declarations.values()) {
      lines.push(`  ${declaration.kind} ${declaration.name}`);
    }
  }
  lines.push('sites');
  for (const site of model.sites) {
    const parts = [siteLabel(source, site)];
    const reads = [
      ...new Set(site.reads.map((read) => (read.tracked ? '' : '~') + read.declaration.name)),
    ];
    const writes = [...new Set(site.writes.map((write) => write.declaration.name))];
    const calls = [...site.calls].map((declaration) => declaration.name);
    if (reads.length > 0) {
      parts.push(`reads ${reads.join(', ')}`);
    }
    if (writes.length > 0) {
      parts.push(`writes ${writes.join(', ')}`);
    }
    if (calls.length > 0) {
      parts.push(`calls ${calls.join(', ')}`);
    }
    lines.push(`  ${parts.join(' ')}`);
  }
  printDiagnostics(source, model.diagnostics, lines);
  return lines.join('\n');
}

function nodeLabel(source: string, node: GraphNode): string {
  switch (node.kind) {
    case 'source':
      return `${node.declaration.kind} ${node.declaration.name}`;
    case 'memo':
      return `${node.declaration.kind} ${node.declaration.name}`;
    default:
      return siteLabel(source, node.site);
  }
}

/** Prints the graph: nodes, what is live, what runs on the client and which scopes it creates. */
export function printGraph(source: string, graph: Graph): string {
  const lines: string[] = ['nodes'];
  for (const node of graph.nodes) {
    const from = graph.edges
      .filter((edge) => edge.to === node)
      .map((edge) => nodeLabel(source, edge.from));
    const state = graph.live.has(node) ? 'live' : 'static';
    lines.push(
      `  ${nodeLabel(source, node)} ${state}${from.length > 0 ? ` <- ${from.join(', ')}` : ''}`,
    );
  }
  lines.push('client');
  for (const site of graph.model.sites) {
    if (graph.reached.has(site)) {
      lines.push(`  ${siteLabel(source, site)}${site.kind === 'server-function' ? ' (stub)' : ''}`);
    }
  }
  const created = graph.model.scopes.filter((scope) => graph.created.has(scope));
  if (created.length > 0) {
    lines.push('created');
    for (const scope of created) {
      lines.push(`  ${scopeLabel(source, scope)}`);
    }
  }
  printDiagnostics(source, [...graph.model.diagnostics, ...graph.diagnostics], lines);
  return lines.join('\n');
}
