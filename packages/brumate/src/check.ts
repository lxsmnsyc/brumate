// Turns a `.brm` file into TypeScript, so a type checker and an editor can
// check it. The scripts and every expression of the markup are copied, with
// mappings back to the file. The markup becomes statements in blocks that
// match its control flow, so names are in scope where the markup reads them.

import type {
  Attribute,
  Block,
  Body,
  ComponentNode,
  Expression,
  Markup,
  Range,
  SFCFile,
  TemplateDecl,
} from './ast.ts';
import { BrumateError } from './error.ts';
import type { oxc } from './oxc.ts';
import { parse } from './parser.ts';
import { analyze } from './analyze.ts';
import { buildGraph } from './graph.ts';
import type { Declaration } from './model.ts';
import { blockBodies, clientState } from './plan.ts';

/**
 * The name of the component function. A file can import the name that its
 * file name gives the component, such as `SignIn` in `sign-in.brm`.
 */
const COMPONENT = '$$Component';

/** A range of the generated code that is copied from the file. */
export interface CheckMapping {
  /** Offset in the `.brm` file. */
  source: number;
  /** Offset in the generated code. */
  generated: number;
  length: number;
}

export interface CheckOutput {
  code: string;
  mappings: CheckMapping[];
  /** The syntax error of the file. The code then holds only its scripts. */
  error?: BrumateError;
}

/**
 * Declarations that the generated code calls to check the markup. They are
 * local to each generated file.
 */
const HELPERS = `/// <reference types="brumate/types" />
type $$Component<P> = (props: P, ...rest: any[]) => unknown;
type $$Markup = import('brumate/elements').Markup;
declare const $$markup: $$Markup;
declare function $$dynamic(tag: string | ((props: never, ...rest: never[]) => unknown), props: Record<string, unknown>): void;
type $$Event<K, M> = K extends keyof M ? M[K] : Event;
type $$Element<T> = T extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[T] : T extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[T] : HTMLElement;
declare function $$on<T extends string, K extends string>(tag: T, event: K, handler: (event: $$Event<K, HTMLElementEventMap> & { currentTarget: $$Element<T> }) => unknown): void;
declare function $$onWindow<K extends string>(event: K, handler: (event: $$Event<K, WindowEventMap> & { currentTarget: Window }) => unknown): void;
declare function $$onDocument<K extends string>(event: K, handler: (event: $$Event<K, DocumentEventMap> & { currentTarget: Document }) => unknown): void;
declare function $$use(...values: unknown[]): void;
type $$Plain = string | number | boolean | bigint | null | undefined | Date | Error | URL | URLSearchParams | ArrayBuffer | ArrayBufferView | Headers | FormData | Request | Response | ReadableStream<any> | AbortSignal | Event | DOMException | ImageData;
type $$Sendable<T> = T extends $$Plain | import('brumate/serial').AppValue ? T : T extends { brumateId: string } ? T : T extends RegExp ? { 'A regular expression cannot be sent to the client. Send its source and flags': never } : T extends (...args: any[]) => any ? { 'A function cannot be sent to the client. Keep it out of the signal or memo': never } : T extends Promise<infer U> ? Promise<$$Sendable<U>> : T extends ReadonlyMap<infer K, infer V> ? ReadonlyMap<$$Sendable<K>, $$Sendable<V>> : T extends ReadonlySet<infer V> ? ReadonlySet<$$Sendable<V>> : T extends object ? { [K in keyof T]: $$Sendable<T[K]> } : T;
/** Checks a value that the page state sends to the client. */
declare function $$sendable<T>(value: T & $$Sendable<T>): void;
`;

class Writer {
  code = '';
  readonly mappings: CheckMapping[] = [];
  private readonly source: string;

  constructor(source: string) {
    this.source = source;
  }

  text(value: string): void {
    this.code += value;
  }

  /** Copies a range of the file, and maps it. */
  copy(range: Range): void {
    if (range.end > range.start) {
      this.mappings.push({
        source: range.start,
        generated: this.code.length,
        length: range.end - range.start,
      });
    }
    this.code += this.source.slice(range.start, range.end);
  }

  /** Writes text in place of a range of the file of the same length, and maps it there. */
  stand(range: Range, text: string): void {
    this.mappings.push({ source: range.start, generated: this.code.length, length: text.length });
    this.code += text;
  }

  /** Copies an expression in parentheses. */
  expression(expression: Expression): void {
    this.text('(');
    this.copy(expression);
    this.text(')');
  }
}

function isTopLevel(statement: oxc.Node): boolean {
  return (
    statement.type === 'ImportDeclaration' ||
    statement.type === 'TSTypeAliasDeclaration' ||
    statement.type === 'TSInterfaceDeclaration' ||
    (statement.type === 'ExportNamedDeclaration' &&
      (statement.exportKind === 'type' ||
        statement.declaration?.type === 'TSTypeAliasDeclaration' ||
        statement.declaration?.type === 'TSInterfaceDeclaration'))
  );
}

/**
 * Finds the type arguments of the calls of `$props<T>()`, as ranges of the file. A component can
 * call it more than once, such as once with `const` and once with `let` for its bindable props.
 */
function propsTypes(program: oxc.Program | undefined): Range[] {
  const found: Range[] = [];
  const visit = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) {
      return;
    }
    const value = node as oxc.Node & {
      callee?: oxc.Node & { name?: string };
      typeArguments?: { params: Range[] };
    };
    if (
      value.type === 'CallExpression' &&
      value.callee?.type === 'Identifier' &&
      value.callee.name === '$props' &&
      value.typeArguments?.params[0]
    ) {
      found.push(value.typeArguments.params[0]);
      return;
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) {
        child.forEach(visit);
      } else if (typeof child === 'object') {
        visit(child);
      }
    }
  };
  visit(program);
  return found;
}

/**
 * Returns the signals and memos whose values the page state sends to the
 * client, because client code reads them. Element refs are sent as
 * references, so they are left out.
 */
function sentDeclarations(file: SFCFile): Declaration[] {
  try {
    const { slots } = clientState(buildGraph(analyze(file)), file);
    return [...slots.values()]
      .flat()
      .filter(
        (declaration) =>
          (declaration.kind === 'signal' ||
            declaration.kind === 'memo' ||
            declaration.kind === 'async-memo') &&
          declaration.refs.length === 0,
      );
  } catch {
    // A file that the analyzer cannot read is still checked as TypeScript.
    return [];
  }
}

class Generator {
  private readonly file: SFCFile;
  private readonly out: Writer;
  private readonly hoisted: oxc.Node[] = [];
  private readonly sent: Declaration[];

  constructor(file: SFCFile, out: Writer) {
    this.file = file;
    this.out = out;
    this.sent = sentDeclarations(file);
  }

  /** Copies a statement, and checks the values it declares that the client receives. */
  private statement(statement: oxc.Node): void {
    const { out } = this;
    out.copy(statement);
    out.text('\n');
    for (const declaration of this.sent) {
      if (declaration.range.start >= statement.start && declaration.range.end <= statement.end) {
        out.text('$$sendable(');
        out.copy(declaration.range);
        out.text(');\n');
      }
    }
  }

  generate(): void {
    const { file, out } = this;
    out.text(HELPERS);
    for (const statement of file.moduleScript?.program.body ?? []) {
      out.copy(statement);
      out.text('\n');
    }
    const body = file.instanceScript?.program.body ?? [];
    for (const statement of body) {
      if (isTopLevel(statement)) {
        out.copy(statement);
        out.text('\n');
      }
    }
    // Imports in the scripts of blocks are module imports too.
    this.collectBodyImports(file.children);
    for (const statement of this.hoisted) {
      out.copy(statement);
      out.text('\n');
    }
    const types = propsTypes(file.instanceScript?.program);
    // The function has a name of its own, so the component name of the file can be imported.
    out.text(`\nexport default ${COMPONENT};\nasync function ${COMPONENT}`);
    if (file.generics) {
      out.text(`<${file.generics}>`);
    }
    out.text('($$props: ');
    if (types.length > 0) {
      // The props of the calls together.
      types.forEach((type, index) => {
        out.text(index > 0 ? ' & (' : '(');
        out.copy(type);
        out.text(')');
      });
    } else {
      out.text('Record<string, any>');
    }
    out.text(", $$ctx?: import('brumate/server').Context): Promise<$$Markup> {\n");
    out.text('$$use($$props, $$ctx);\n');
    for (const statement of body) {
      if (!isTopLevel(statement)) {
        this.statement(statement);
      }
    }
    for (const style of file.styles) {
      for (const variable of style.variables) {
        out.text('$$use(');
        out.expression(variable);
        out.text(');\n');
      }
    }
    this.templates(file.templates);
    this.nodes(file.children);
    out.text('return $$markup;\n}\n');
    // Components are sent to the client by their ID, as the compiled ones are.
    out.text(`${COMPONENT}.brumateId = '';\n`);
  }

  private collectBodyImports(nodes: Markup[]): void {
    for (const node of nodes) {
      if ('children' in node) {
        this.collectBodyImports(node.children);
      }
      if (isBlock(node)) {
        for (const body of blockBodies(node)) {
          for (const statement of body.script?.program.body ?? []) {
            if (statement.type === 'ImportDeclaration') {
              this.hoisted.push(statement);
            }
          }
          this.collectBodyImports(body.children);
          for (const template of body.templates) {
            this.collectBodyImports(template.body.children);
          }
        }
      }
    }
    for (const template of this.file.templates) {
      if (nodes === this.file.children) {
        this.collectBodyImports(template.body.children);
      }
    }
  }

  private templates(templates: TemplateDecl[]): void {
    const { out } = this;
    for (const template of templates) {
      // Templates can await memos, as the component function can.
      out.text('async function ');
      out.copy(template.nameRange);
      out.text('(');
      if (template.params.length > 0) {
        out.copy({ start: template.params[0]!.start, end: template.params.at(-1)!.end });
      }
      out.text('): Promise<$$Markup> {\n');
      this.body(template.body);
      out.text('return $$markup;\n}\n');
    }
  }

  private body(body: Body): void {
    for (const statement of body.script?.program.body ?? []) {
      if (statement.type !== 'ImportDeclaration') {
        this.statement(statement);
      }
    }
    this.templates(body.templates);
    this.nodes(body.children);
  }

  private nodes(nodes: Markup[]): void {
    for (const node of nodes) {
      this.node(node);
    }
  }

  private node(node: Markup): void {
    const { out } = this;
    switch (node.kind) {
      case 'text':
        return;
      case 'insert':
        out.text('$$use(');
        out.expression(node.expression);
        out.text(');\n');
        return;
      case 'element':
        this.elementAttributes(node.tag, node.attributes);
        this.nodes(node.children);
        return;
      case 'component':
        this.component(node);
        this.nodes(node.children);
        return;
      case 'dynamic':
        out.text('$$dynamic(');
        out.expression(node.tag);
        out.text(', {');
        this.props(node.attributes);
        out.text('});\n');
        this.nodes(node.children);
        return;
      case 'fragment':
        this.nodes(node.children);
        return;
      case 'listener': {
        const helper = node.target === 'window' ? '$$onWindow' : '$$onDocument';
        for (const attribute of node.attributes) {
          out.text(`${helper}(${JSON.stringify(attribute.event)}, `);
          out.expression(attribute.handler);
          out.text(');\n');
        }
        return;
      }
      default:
        this.block(node);
    }
  }

  private elementAttributes(tag: string, attributes: Attribute[]): void {
    const { out } = this;
    for (const attribute of attributes) {
      switch (attribute.kind) {
        case 'value':
        case 'spread':
          out.text('$$use(');
          out.expression(attribute.value);
          out.text(');\n');
          break;
        case 'event':
          out.text(`$$on(${JSON.stringify(tag)}, ${JSON.stringify(attribute.event)}, `);
          out.expression(attribute.handler);
          out.text(');\n');
          break;
        case 'ref':
          out.text('$$use(');
          out.copy(attribute.targetRange);
          out.text(');\n');
          break;
        case 'computed':
          out.text('$$use(');
          out.expression(attribute.name);
          if (attribute.value !== true) {
            out.text(', ');
            out.expression(attribute.value);
          }
          out.text(');\n');
          break;
        default:
          break;
      }
    }
  }

  /** Writes a prop name, mapped to the attribute, so errors about the prop point at it. */
  private propName(attribute: Range & { name: string }): void {
    const { out } = this;
    out.text(' ');
    if (/^[A-Za-z_$][\w$]*$/.test(attribute.name)) {
      // A shorthand, such as `{page}`, has its name after the brace.
      const start =
        this.file.source[attribute.start] === '{'
          ? this.file.source.indexOf(attribute.name, attribute.start)
          : attribute.start;
      out.copy({ start, end: start + attribute.name.length });
    } else {
      out.text(JSON.stringify(attribute.name));
    }
    out.text(': ');
  }

  /** Writes the attributes of a component or a dynamic tag as the properties of an object. */
  private props(attributes: Attribute[], children = false): void {
    const { out } = this;
    for (const attribute of attributes) {
      switch (attribute.kind) {
        case 'static':
          this.propName(attribute);
          out.text(`${attribute.value === true ? 'true' : JSON.stringify(attribute.value)},`);
          break;
        case 'value':
          this.propName(attribute);
          out.expression(attribute.value);
          out.text(',');
          break;
        case 'event':
          this.propName(attribute);
          out.expression(attribute.handler);
          out.text(',');
          break;
        case 'spread':
          out.text(' ...');
          out.expression(attribute.value);
          out.text(',');
          break;
        default:
          break;
      }
    }
    if (children) {
      out.text(' children: undefined as any,');
    }
  }

  private component(node: ComponentNode): void {
    const { out } = this;
    const nameStart = node.start + 1;
    // A direct call checks the props as a fresh object, so an unknown prop is reported, and the
    // type parameters of a generic component are inferred from them.
    out.copy({ start: nameStart, end: nameStart + node.name.length });
    out.text('(');
    // A missing prop is reported on the object, so its brace stands for the `<` of the tag.
    out.stand({ start: node.start, end: node.start + 1 }, '{');
    this.props(node.attributes, node.children.length > 0);
    // The closing brace stands for the end of the opening tag, so the error spans the tag.
    out.text(' ');
    out.stand({ start: this.openTagEnd(node) - 1, end: this.openTagEnd(node) }, '}');
    out.text(');\n');
  }

  /** The offset after the `>` that ends the opening tag of a component. */
  private openTagEnd(node: ComponentNode): number {
    const last = node.attributes.at(-1)?.end ?? node.start + 1 + node.name.length;
    return this.file.source.indexOf('>', last) + 1;
  }

  private block(block: Block): void {
    const { out } = this;
    switch (block.kind) {
      case 'if':
      case 'switch': {
        const branches = block.kind === 'if' ? block.branches : block.cases;
        branches.forEach((branch, index) => {
          out.text(index === 0 ? 'if ' : ' else if ');
          out.expression(branch.condition);
          out.text(' {\n');
          this.body(branch.body);
          out.text('}');
        });
        if (block.fallback) {
          out.text(' else {\n');
          this.body(block.fallback);
          out.text('}');
        }
        out.text('\n');
        return;
      }
      case 'for': {
        out.text('for (const ');
        out.copy(block.item);
        out.text(' of ');
        out.expression(block.list);
        out.text(') {\n');
        if (block.index) {
          out.text('const ');
          out.copy(block.index);
          out.text(' = 0 as number;\n');
        }
        if (block.key && block.key !== 'index') {
          out.text('$$use(');
          out.expression(block.key);
          out.text(');\n');
        }
        this.body(block.body);
        out.text('}\n');
        this.fallback(block.fallback);
        return;
      }
      case 'repeat': {
        out.text('for (let $$i = 0; $$i < ');
        out.expression(block.count);
        out.text('; $$i++) {\n');
        if (block.index) {
          out.text('const ');
          out.copy(block.index);
          out.text(' = $$i;\n');
        }
        this.body(block.body);
        out.text('}\n');
        this.fallback(block.fallback);
        return;
      }
      case 'key':
        out.text('$$use(');
        out.expression(block.value);
        out.text(');\n{\n');
        this.body(block.body);
        out.text('}\n');
        return;
      case 'offscreen':
        out.text('$$use(');
        out.expression(block.visible);
        out.text(');\n{\n');
        this.body(block.body);
        out.text('}\n');
        return;
      case 'try':
        out.text('try {\n');
        this.body(block.body);
        out.text('} catch (');
        if (block.error) {
          out.copy(block.error);
        } else {
          out.text('$$error');
        }
        out.text(') {\n');
        if (block.reset) {
          out.text('const ');
          out.copy(block.reset);
          out.text(' = (): void => {};\n');
        }
        this.body(block.fallback);
        out.text('}\n');
        return;
      case 'loading':
        if (block.on) {
          out.text('$$use(');
          out.expression(block.on);
          out.text(');\n');
        }
        out.text('{\n');
        this.body(block.body);
        out.text('}\n');
        this.fallback(block.fallback);
        return;
      case 'portal':
        if (block.target) {
          out.text('$$use(');
          out.expression(block.target);
          out.text(');\n');
        }
        out.text('{\n');
        this.body(block.body);
        out.text('}\n');
        return;
      case 'head':
        out.text('{\n');
        this.body(block.body);
        out.text('}\n');
        return;
      case 'client':
      case 'defer':
        out.text('{\n');
        this.body(block.body);
        out.text('}\n');
        this.fallback(block.fallback);
        return;
    }
  }

  private fallback(body: Body | undefined): void {
    if (body) {
      this.out.text('{\n');
      this.body(body);
      this.out.text('}\n');
    }
  }
}

function isBlock(node: Markup): node is Block {
  return !['element', 'component', 'dynamic', 'fragment', 'listener', 'text', 'insert'].includes(
    node.kind,
  );
}

/** Finds the `<script>` blocks at the top level, without parsing the markup. */
function scriptRanges(source: string): Range[] {
  const ranges: Range[] = [];
  for (const match of source.matchAll(/^<script(\s[^>]*)?>([\s\S]*?)<\/script\s*>/gm)) {
    const start = match.index + match[0].indexOf('>') + 1;
    ranges.push({ start, end: start + match[2]!.length });
  }
  return ranges;
}

/**
 * Generates TypeScript for a `.brm` file. With a syntax error, the code holds
 * the scripts only, so they still get type information.
 */
export function toTypeScript(source: string, filename = 'Component.brm'): CheckOutput {
  const out = new Writer(source);
  let file: SFCFile;
  try {
    file = parse(source, { filename });
  } catch (error) {
    if (!(error instanceof BrumateError)) {
      throw error;
    }
    out.text(HELPERS);
    for (const range of scriptRanges(source)) {
      out.copy(range);
      out.text('\n');
    }
    out.text(
      `export default async function ${COMPONENT}(..._: any[]): Promise<$$Markup> {\n  return $$markup;\n}\n`,
    );
    return { code: out.code, mappings: out.mappings, error };
  }
  new Generator(file, out).generate();
  return { code: out.code, mappings: out.mappings };
}
