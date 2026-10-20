import type {
  Attribute,
  Block,
  Body,
  ComponentNode,
  DynamicTagNode,
  ElementNode,
  Expression,
  Markup,
  SFCFile,
  TemplateDecl,
} from '../ast.ts';
import type { Scope, Site } from '../model.ts';
import { children } from '../oxc.ts';
import type { oxc } from '../oxc.ts';
import type { Plan } from '../plan.ts';

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

const TYPE_DECLARATIONS = new Set([
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSDeclareFunction',
  'TSModuleDeclaration',
]);

interface Edit {
  start: number;
  end: number;
  text: string;
}

/** Rewrites ranges of the source with edits that do not overlap. */
class Patch {
  private readonly source: string;
  private readonly edits: Edit[] = [];

  constructor(source: string) {
    this.source = source;
  }

  replace(start: number, end: number, text: string): void {
    this.edits.push({ start, end, text });
  }

  slice(start: number, end: number): string {
    const edits = this.edits
      .filter((edit) => edit.start >= start && edit.end <= end)
      .toSorted((a, b) => a.start - b.start);
    let result = '';
    let position = start;
    for (const edit of edits) {
      result += this.source.slice(position, edit.start) + edit.text;
      position = edit.end;
    }
    return result + this.source.slice(position, end);
  }
}

/** Applies JSX whitespace rules: lines are trimmed and whitespace-only lines are dropped. */
function cleanText(value: string): string {
  if (!value.includes('\n')) {
    return value;
  }
  const lines = value.split('\n');
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!.replace(/\t/g, ' ');
    if (i > 0) {
      line = line.trimStart();
    }
    if (i < lines.length - 1) {
      line = line.trimEnd();
    }
    if (line) {
      result.push(line);
    }
  }
  return result.join(' ');
}

type Part = { static: string } | { code: string };

export function generateServer(file: SFCFile, plan: Plan): string {
  return new ServerGenerator(file, plan).generate();
}

class ServerGenerator {
  private readonly file: SFCFile;
  private readonly plan: Plan;
  private readonly patch: Patch;
  private readonly sitesByNode = new Map<object, Site>();
  private readonly lines: string[] = [];
  private readonly hoisted: string[] = [];
  private parts: Part[] = [];
  private depth = 0;
  private counter = 0;

  constructor(file: SFCFile, plan: Plan) {
    this.file = file;
    this.plan = plan;
    this.patch = new Patch(file.source);
    for (const site of plan.graph.model.sites) {
      this.sitesByNode.set(site.node, site);
    }
  }

  generate(): string {
    this.collectEdits();
    const model = this.plan.graph.model;
    const header: string[] = ["import * as $$b from 'brumate/server';"];
    const moduleBody: string[] = [];

    if (this.file.moduleScript) {
      for (const statement of this.file.moduleScript.program.body) {
        const code = this.source(statement);
        (statement.type === 'ImportDeclaration' ? header : moduleBody).push(code);
      }
    }

    const setup: oxc.Node[] = [];
    if (this.file.instanceScript) {
      for (const statement of this.file.instanceScript.program.body) {
        if (statement.type === 'ImportDeclaration') {
          header.push(this.source(statement));
        } else if (TYPE_DECLARATIONS.has(statement.type) || this.isTypeExport(statement)) {
          moduleBody.push(this.source(statement));
        } else {
          setup.push(statement);
        }
      }
    }

    const component = model.component;
    const generics = this.file.generics ? `<${this.file.generics}>` : '';
    this.line(
      `export default async function ${this.plan.name}${generics}($$props: ${this.propsType()}, $$ctx: $$b.Context): Promise<string> {`,
    );
    this.line(`let $$html = '';`);
    this.line(`const ${this.scopeName(component)} = $$ctx.scope();`);
    this.emitStatements(setup);
    for (const template of this.file.templates) {
      this.emitTemplate(template);
    }
    this.emitClientAnchors(component);
    this.emitNodes(this.file.children, component);
    this.emitSlots(component);
    this.flush();
    this.line('return $$html;');
    this.depth--;
    this.line('}');

    return [...header, ...this.hoisted, ...moduleBody, '', ...this.lines, ''].join('\n');
  }

  // Source text

  private source(node: { start: number; end: number }): string {
    return this.patch.slice(node.start, node.end);
  }

  private expression(expression: Expression): string {
    return `(${this.patch.slice(expression.start, expression.end)})`;
  }

  private isTypeExport(statement: oxc.Node): boolean {
    return statement.type === 'ExportNamedDeclaration' && statement.exportKind === 'type';
  }

  private propsType(): string {
    const program = this.file.instanceScript?.program;
    if (program) {
      for (const statement of program.body) {
        if (statement.type !== 'VariableDeclaration') {
          continue;
        }
        for (const declarator of statement.declarations) {
          const init = declarator.init;
          if (
            init?.type === 'CallExpression' &&
            init.callee.type === 'Identifier' &&
            init.callee.name === '$props'
          ) {
            const type = init.typeArguments?.params[0];
            return type ? this.file.source.slice(type.start, type.end) : 'Record<string, any>';
          }
        }
      }
    }
    return 'Record<string, never>';
  }

  /** Rewrites compile-time functions into plain values for the server. */
  private collectEdits(): void {
    const visit = (node: oxc.Node): void => {
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
        const name = node.callee.name;
        const argument = node.arguments[0];
        if (name === '$props') {
          this.patch.replace(node.start, node.end, '$$props');
          return;
        }
        if (name === '$signal' || name === '$memo' || name === '$untrack') {
          if (!argument) {
            this.patch.replace(node.start, node.end, 'undefined');
            return;
          }
          const isAsync =
            name === '$memo' && this.sitesByNode.get(argument)?.declaration?.kind === 'async-memo';
          this.patch.replace(node.start, argument.start, isAsync ? '(await (' : '(');
          this.patch.replace(argument.end, node.end, isAsync ? '))' : ')');
          visit(argument);
          return;
        }
      }
      for (const [, child] of children(node)) {
        visit(child);
      }
    };
    const programs: oxc.Program[] = [];
    if (this.file.instanceScript) {
      programs.push(this.file.instanceScript.program);
    }
    for (const scope of this.plan.graph.model.scopes) {
      if (scope.body?.script) {
        programs.push(scope.body.script.program);
      }
    }
    for (const program of programs) {
      visit(program);
    }
    for (const site of this.plan.graph.model.sites) {
      if (site.kind !== 'setup' && site.kind !== 'function' && site.kind !== 'server-function') {
        if (
          !programs.some(
            (program) => site.node.start >= program.start && site.node.end <= program.end,
          )
        ) {
          visit(site.node);
        }
      }
    }
  }

  // Output

  private line(code: string): void {
    this.flush();
    this.lines.push(`${'  '.repeat(this.depth)}${code}`);
    if (code.endsWith('{')) {
      this.depth++;
    }
  }

  /** Copies source code, keeping the indentation of its lines relative to the first. */
  private raw(code: string, column: number): void {
    this.flush();
    const indent = '  '.repeat(this.depth);
    code.split('\n').forEach((line, index) => {
      const text = index === 0 ? line : line.replace(new RegExp(`^ {0,${column}}`), '');
      this.lines.push(text.trim() === '' ? '' : `${indent}${text}`);
    });
  }

  private column(offset: number): number {
    const lineStart = this.file.source.lastIndexOf('\n', offset - 1) + 1;
    return offset - lineStart;
  }

  private close(code = '}'): void {
    this.flush();
    this.depth--;
    this.lines.push(`${'  '.repeat(this.depth)}${code}`);
    if (code.endsWith('{')) {
      this.depth++;
    }
  }

  private html(text: string): void {
    const last = this.parts.at(-1);
    if (last && 'static' in last) {
      last.static += text;
    } else {
      this.parts.push({ static: text });
    }
  }

  private code(code: string): void {
    this.parts.push({ code });
  }

  private flush(): void {
    if (this.parts.length === 0) {
      return;
    }
    const parts = this.parts;
    this.parts = [];
    const value = parts
      .map((part) => ('static' in part ? JSON.stringify(part.static) : part.code))
      .join(' + ');
    this.lines.push(`${'  '.repeat(this.depth)}$$html += ${value};`);
  }

  private unique(prefix: string): string {
    return `$$${prefix}${this.counter++}`;
  }

  // Scopes

  private scopeName(scope: Scope): string {
    return `$$s${scope.id}`;
  }

  /** The scope whose ID anchors in `scope` use. */
  private anchorPrefix(scope: Scope, target: object): { scope: string; index: number } | undefined {
    const index = this.plan.anchors.get(target as Markup);
    return index === undefined ? undefined : { scope: this.scopeName(scope), index };
  }

  private emitSlots(scope: Scope): void {
    const slots = this.plan.scopes.get(scope)?.slots ?? [];
    if (slots.length > 0) {
      this.line(
        `$$ctx.slots(${this.scopeName(scope)}, [${slots.map((slot) => slot.name).join(', ')}]);`,
      );
    }
  }

  private emitStatements(statements: oxc.Node[]): void {
    for (const statement of statements) {
      if (statement.type === 'ExpressionStatement') {
        const expression = statement.expression;
        if (
          expression.type === 'CallExpression' &&
          expression.callee.type === 'Identifier' &&
          (expression.callee.name === '$effect' || expression.callee.name === '$client')
        ) {
          continue;
        }
      }
      if (statement.type === 'ImportDeclaration') {
        this.hoisted.push(this.source(statement));
        continue;
      }
      if (TYPE_DECLARATIONS.has(statement.type)) {
        continue;
      }
      this.raw(this.source(statement), this.column(statement.start));
    }
  }

  /** Emits `<template>` markers for the `$client` callbacks of a scope. */
  private emitClientAnchors(scope: Scope): void {
    for (const site of this.plan.graph.model.sites) {
      if (site.kind !== 'client' || site.scope !== scope) {
        continue;
      }
      const anchor = this.anchorPrefix(scope, site)!;
      this.html('<template data-b="');
      this.code(anchor.scope);
      this.html(
        `:${anchor.index}" data-client="${site.trigger}=${this.plan.id}#${this.plan.symbols.get(site)}"></template>`,
      );
    }
  }

  /** Emits a body: its scope ID, script, templates, markup and slots. */
  private emitBody(body: Body, itemScope?: string): void {
    const scope = this.plan.bodyScopes.get(body)!;
    const plan = this.plan.scopes.get(scope)!;
    if (plan.needsId && !itemScope) {
      this.line(`const ${this.scopeName(scope)} = $$ctx.scope();`);
    }
    if (body.script) {
      this.emitStatements(body.script.program.body);
    }
    for (const template of body.templates) {
      this.emitTemplate(template);
    }
    this.emitClientAnchors(scope);
    this.emitNodes(body.children, scope);
    this.emitSlots(scope);
  }

  private emitTemplate(template: TemplateDecl): void {
    const first = template.params[0];
    const last = template.params.at(-1);
    const params = first && last ? this.file.source.slice(first.start, last.end) : '';
    this.line(`async function ${template.name}(${params}): Promise<$$b.Raw> {`);
    this.line(`let $$html = '';`);
    this.emitBody(template.body);
    this.flush();
    this.line('return $$b.raw($$html);');
    this.close();
  }

  // Markup

  private emitNodes(nodes: Markup[], scope: Scope): void {
    for (const node of nodes) {
      this.emitNode(node, scope);
    }
  }

  private emitNode(node: Markup, scope: Scope): void {
    switch (node.kind) {
      case 'text':
        this.html(cleanText(node.value));
        return;
      case 'insert': {
        const anchor = this.anchorPrefix(scope, node);
        const value = `await $$b.insert(${this.expression(node.expression)})`;
        if (anchor) {
          this.html('<!--t');
          this.code(anchor.scope);
          this.html(`:${anchor.index}-->`);
          this.code(value);
          this.html('<!--/t-->');
        } else {
          this.code(value);
        }
        return;
      }
      case 'element':
        this.emitElement(node, scope);
        return;
      case 'component':
        this.emitComponent(node, scope);
        return;
      case 'dynamic':
        this.emitDynamic(node, scope);
        return;
      case 'fragment':
        this.emitNodes(node.children, scope);
        return;
      case 'listener': {
        const anchor = this.anchorPrefix(scope, node)!;
        const events = node.attributes.map((attribute) =>
          this.eventEntry(attribute.event, attribute.modifiers, attribute.handler),
        );
        this.html('<template data-b="');
        this.code(anchor.scope);
        this.html(
          `:${anchor.index}" data-listen="${node.target}" data-on="${events.join(' ')}"></template>`,
        );
        return;
      }
      default:
        this.emitBlock(node, scope);
    }
  }

  private eventEntry(event: string, modifiers: string[], handler: Expression): string {
    const site = this.sitesByNode.get(handler.ast)!;
    const name = [event, ...modifiers].join(':');
    return `${name}=${this.plan.id}#${this.plan.symbols.get(site)}`;
  }

  private emitElement(node: ElementNode, scope: Scope): void {
    this.html(`<${node.tag}`);
    const events: string[] = [];
    let prefetch: string | undefined;
    const anchor = this.anchorPrefix(scope, node);
    for (const attribute of node.attributes) {
      switch (attribute.kind) {
        case 'static':
          this.html(
            attribute.value === true
              ? ` ${attribute.name}`
              : ` ${attribute.name}="${attribute.value}"`,
          );
          break;
        case 'value':
          this.code(
            `$$b.attribute(${JSON.stringify(attribute.name)}, ${this.expression(attribute.value)})`,
          );
          break;
        case 'spread':
          this.code(`$$b.spread(${this.expression(attribute.value)})`);
          break;
        case 'computed':
          this.code(
            `$$b.attribute(${this.expression(attribute.name)}, ${attribute.value === true ? 'true' : this.expression(attribute.value)})`,
          );
          break;
        case 'event':
          events.push(this.eventEntry(attribute.event, attribute.modifiers, attribute.handler));
          break;
        case 'ref':
          if (anchor) {
            this.line(`${attribute.target} = $$ctx.element(${anchor.scope}, ${anchor.index});`);
          }
          break;
        case 'prefetch':
          prefetch = attribute.strategy;
          break;
      }
    }
    if (anchor) {
      this.html(' data-b="');
      this.code(anchor.scope);
      this.html(`:${anchor.index}"`);
    }
    if (events.length > 0) {
      this.html(` data-on="${events.join(' ')}"`);
      if (prefetch) {
        this.html(` data-prefetch="${prefetch}"`);
      }
    }
    this.html('>');
    if (VOID_ELEMENTS.has(node.tag)) {
      return;
    }
    this.emitNodes(node.children, scope);
    this.html(`</${node.tag}>`);
  }

  /** Renders children into a variable, for a component or a dynamic tag. */
  private emitChildren(nodes: Markup[], scope: Scope): string | undefined {
    if (nodes.length === 0) {
      return undefined;
    }
    const name = this.unique('children');
    this.line(`const ${name} = await (async () => {`);
    this.line(`let $$html = '';`);
    this.emitNodes(nodes, scope);
    this.flush();
    this.line('return $$b.raw($$html);');
    this.close('})();');
    return name;
  }

  private props(attributes: Attribute[], scope: Scope, extra: string[] = []): string {
    const entries: string[] = [];
    for (const attribute of attributes) {
      switch (attribute.kind) {
        case 'static':
          entries.push(
            `${JSON.stringify(attribute.name)}: ${attribute.value === true ? 'true' : JSON.stringify(attribute.value)}`,
          );
          break;
        case 'value':
          entries.push(
            `${JSON.stringify(attribute.name)}: ${this.propValue(attribute.value, scope)}`,
          );
          break;
        case 'event':
          entries.push(
            `${JSON.stringify(attribute.name)}: ${this.propValue(attribute.handler, scope)}`,
          );
          break;
        case 'spread':
          entries.push(`...${this.expression(attribute.value)}`);
          break;
        case 'computed':
          entries.push(
            `[${this.expression(attribute.name)}]: ${attribute.value === true ? 'true' : this.expression(attribute.value)}`,
          );
          break;
        default:
          break;
      }
    }
    return `{ ${[...entries, ...extra].join(', ')} }`;
  }

  /** A prop value. A client function is marked so it serializes as a reference. */
  private propValue(expression: Expression, scope: Scope): string {
    const code = this.expression(expression);
    const site = this.sitesByNode.get(expression.ast);
    const symbol = site && this.plan.symbols.get(site);
    if (symbol) {
      return `$$ctx.fn(${code}, ${JSON.stringify(`${this.plan.id}#${symbol}`)}, ${this.nearestScope(scope)})`;
    }
    return code;
  }

  /** The nearest scope with an ID, for references from client functions. */
  private nearestScope(scope: Scope): string {
    for (let current: Scope | undefined = scope; current; current = current.parent) {
      if (this.plan.scopes.get(current)?.needsId) {
        return this.scopeName(current);
      }
    }
    return this.scopeName(this.plan.graph.model.component);
  }

  private emitComponent(node: ComponentNode, scope: Scope): void {
    const childrenName = this.emitChildren(node.children, scope);
    const props = this.props(
      node.attributes,
      scope,
      childrenName ? [`children: ${childrenName}`] : [],
    );
    const anchor = this.anchorPrefix(scope, node);
    const link = anchor ? `, ${anchor.scope}, ${anchor.index}` : '';
    this.code(`await $$b.component(${node.name}, ${props}, $$ctx${link})`);
  }

  private emitDynamic(node: DynamicTagNode, scope: Scope): void {
    const childrenName = this.emitChildren(node.children, scope);
    const extra: string[] = [];
    const anchor = this.anchorPrefix(scope, node);
    if (anchor) {
      extra.push(`"data-b": \`\${${anchor.scope}}:${anchor.index}\``);
    }
    const events = node.attributes.flatMap((attribute) =>
      attribute.kind === 'event'
        ? [this.eventEntry(attribute.event, attribute.modifiers, attribute.handler)]
        : [],
    );
    if (events.length > 0) {
      extra.push(`"data-on": ${JSON.stringify(events.join(' '))}`);
    }
    const attributes = node.attributes.filter((attribute) => attribute.kind !== 'event');
    this.code(
      `await $$b.dynamic(${this.expression(node.tag)}, ${this.props(attributes, scope, extra)}, ${childrenName ?? 'undefined'}, $$ctx)`,
    );
  }

  // Blocks

  private open(scope: Scope, block: Block, suffix?: string): void {
    const anchor = this.anchorPrefix(scope, block);
    if (anchor) {
      this.html('<!--b');
      this.code(anchor.scope);
      this.html(`:${anchor.index}${suffix === undefined ? '' : `:${suffix}`}-->`);
    }
  }

  private end(block: Block): void {
    if (this.plan.anchors.has(block)) {
      this.html('<!--/b-->');
    }
  }

  private emitBlock(block: Block, scope: Scope): void {
    switch (block.kind) {
      case 'if':
      case 'switch': {
        const branches = block.kind === 'if' ? block.branches : block.cases;
        const fallback = block.fallback;
        branches.forEach((branch, index) => {
          if (index === 0) {
            this.line(`if ${this.expression(branch.condition)} {`);
          } else {
            this.close(`} else if ${this.expression(branch.condition)} {`);
          }
          this.open(scope, block, String(index));
          this.emitBody(branch.body);
          this.end(block);
        });
        this.close('} else {');
        this.open(scope, block, fallback ? String(branches.length) : '-1');
        if (fallback) {
          this.emitBody(fallback);
        }
        this.end(block);
        this.close();
        return;
      }
      case 'for':
      case 'repeat': {
        const bodyScope = this.plan.bodyScopes.get(block.body)!;
        const list = this.unique('list');
        const index = this.unique('index');
        const anchored = this.plan.anchors.has(block);
        this.line('{');
        if (block.kind === 'for') {
          this.line(`const ${list} = Array.from(${this.expression(block.list)});`);
        } else {
          this.line(
            `const ${list} = Array.from({ length: ${this.expression(block.count)} }, (_, index) => index);`,
          );
        }
        if (block.index) {
          this.line(`let ${index} = 0;`);
        }
        this.open(scope, block);
        const item =
          block.kind === 'for'
            ? this.file.source.slice(block.item.start, block.item.end)
            : this.unique('item');
        this.line(`for (const ${item} of ${list}) {`);
        if (block.index) {
          this.line(`const ${block.index.name} = ${index}++;`);
        }
        const itemScope = this.scopeName(bodyScope);
        if (this.plan.scopes.get(bodyScope)!.needsId) {
          this.line(`const ${itemScope} = $$ctx.scope();`);
        }
        if (anchored) {
          this.html('<!--i');
          this.code(itemScope);
          this.html('-->');
        }
        this.emitBody(block.body, itemScope);
        if (anchored) {
          this.html('<!--/i-->');
        }
        this.close();
        if (block.fallback) {
          this.line(`if (${list}.length === 0) {`);
          this.emitBody(block.fallback);
          this.close();
        }
        this.end(block);
        this.close();
        return;
      }
      case 'try': {
        const before = this.unique('before');
        const error = this.unique('error');
        this.open(scope, block);
        this.flush();
        this.line(`const ${before} = $$html;`);
        this.line('try {');
        this.emitBody(block.body);
        this.close(`} catch (${error}) {`);
        this.line(`$$html = ${before};`);
        if (block.error) {
          this.line(`const ${block.error.name} = ${error};`);
        }
        if (block.reset) {
          this.line(`const ${block.reset.name} = undefined;`);
        }
        this.emitBody(block.fallback);
        this.close();
        this.end(block);
        return;
      }
      case 'client':
        this.open(scope, block);
        this.end(block);
        return;
      default:
        // `#key`, `#loading`, `#portal` and `#static` render their body in place.
        // TODO: render `#portal` at the end of the page.
        this.open(scope, block);
        this.line('{');
        this.emitBody(block.body);
        this.close();
        this.end(block);
    }
  }
}
