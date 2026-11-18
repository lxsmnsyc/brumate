import type { oxc } from './oxc.ts';

export interface Range {
  start: number;
  end: number;
}

/** Source text that oxc parses. */
export interface Expression extends Range {
  code: string;
  ast: oxc.Expression;
}

export interface Script extends Range {
  program: oxc.Program;
}

export interface Style extends Range {
  lang: 'css' | 'scss' | 'less';
  /** True for `<style global>`: its rules get no scope attribute. */
  global: boolean;
  /** The CSS between the tags, with `${…}` interpolations left in place. */
  content: string;
  /** The `${…}` interpolations, in source order. */
  variables: Expression[];
}

export interface SFCFile {
  filename: string;
  source: string;
  moduleScript?: Script;
  instanceScript?: Script;
  generics?: string;
  styles: Style[];
  /** The `<style>` of every block body, in source order. Each is also in `styles` of its `Body`. */
  blockStyles: Style[];
  templates: TemplateDecl[];
  children: Markup[];
}

export type Markup =
  | ElementNode
  | ComponentNode
  | DynamicTagNode
  | FragmentNode
  | GlobalListenerNode
  | TextNode
  | InsertNode
  | Block;

export interface ElementNode extends Range {
  kind: 'element';
  tag: string;
  attributes: Attribute[];
  children: Markup[];
}

export interface ComponentNode extends Range {
  kind: 'component';
  name: string;
  attributes: Attribute[];
  children: Markup[];
}

export interface DynamicTagNode extends Range {
  kind: 'dynamic';
  tag: Expression;
  attributes: Attribute[];
  children: Markup[];
  /**
   * True inside the `#key` block that the parser wraps it in. The block
   * renders it again when the tag changes, so the tag itself needs no update.
   */
  keyed?: boolean;
}

export interface FragmentNode extends Range {
  kind: 'fragment';
  children: Markup[];
  /**
   * For `#reveal`: the order in which the server shows the `#loading` bodies
   * inside, and whether only the next fallback shows. Elsewhere the children
   * render as they are.
   */
  reveal?: Reveal;
}

/** The order of `#reveal`, as its header writes it. */
export type RevealOrder = 'sequential' | 'backwards' | 'together' | 'natural';

export interface Reveal {
  order: RevealOrder;
  collapsed: boolean;
}

export interface GlobalListenerNode extends Range {
  kind: 'listener';
  target: 'window' | 'document';
  attributes: EventAttribute[];
}

export interface TextNode extends Range {
  kind: 'text';
  value: string;
}

export interface InsertNode extends Range {
  kind: 'insert';
  expression: Expression;
}

export interface StaticAttribute extends Range {
  kind: 'static';
  name: string;
  value: string | true;
}

export interface ValueAttribute extends Range {
  kind: 'value';
  name: string;
  value: Expression;
}

export interface EventAttribute extends Range {
  kind: 'event';
  /** The attribute name, such as `onClick`. */
  name: string;
  /** The DOM event name, such as `click`. */
  event: string;
  handler: Expression;
}

export interface RefAttribute extends Range {
  kind: 'ref';
  /** The name in `ref=$bind(name)`: a signal, or a prop that the component writes. */
  target: string;
  /** The range of the name. */
  targetRange: Range;
}

export interface SpreadAttribute extends Range {
  kind: 'spread';
  value: Expression;
}

export interface ComputedAttribute extends Range {
  kind: 'computed';
  name: Expression;
  value: Expression | true;
}

export type Attribute =
  | StaticAttribute
  | ValueAttribute
  | EventAttribute
  | RefAttribute
  | SpreadAttribute
  | ComputedAttribute;

export interface Body extends Range {
  script?: Script;
  /** The `<style>` elements at the top level of the body. */
  styles: Style[];
  templates: TemplateDecl[];
  children: Markup[];
}

export interface Branch {
  condition: Expression;
  body: Body;
}

export interface IfBlock extends Range {
  kind: 'if';
  branches: Branch[];
  fallback?: Body;
}

export interface ForBlock extends Range {
  kind: 'for';
  item: oxc.BindingPattern;
  index?: oxc.BindingIdentifier;
  list: Expression;
  /** `'index'` keys items by position. */
  key?: Expression | 'index';
  /**
   * `window(height, count)`: the browser renders only the items in view, which are about
   * `height` pixels tall, and the server renders the first `count`.
   */
  window?: { height: Expression; count?: Expression };
  body: Body;
  fallback?: Body;
}

export interface RepeatBlock extends Range {
  kind: 'repeat';
  index?: oxc.BindingIdentifier;
  count: Expression;
  body: Body;
  fallback?: Body;
}

export interface SwitchBlock extends Range {
  kind: 'switch';
  cases: Branch[];
  fallback?: Body;
}

export interface KeyBlock extends Range {
  kind: 'key';
  value: Expression;
  body: Body;
}

export interface TryBlock extends Range {
  kind: 'try';
  body: Body;
  error?: oxc.BindingIdentifier;
  reset?: oxc.BindingIdentifier;
  fallback: Body;
}

export interface LoadingBlock extends Range {
  kind: 'loading';
  on?: Expression;
  body: Body;
  fallback?: Body;
}

/** `#head { … }`: markup for the document's `<head>`. */
export interface HeadBlock extends Range {
  kind: 'head';
  body: Body;
}

export interface PortalBlock extends Range {
  kind: 'portal';
  target?: Expression;
  body: Body;
}

export type ClientTrigger = 'visible' | 'idle' | 'load';

export interface ClientBlock extends Range {
  kind: 'client';
  trigger: ClientTrigger;
  body: Body;
  /** Markup that the server renders in place of the body, until the body renders. */
  fallback?: Body;
}

/**
 * `#defer (trigger) { … } #else { … }`: a body that the server renders in a
 * later request, when the trigger fires in the browser. The page has the
 * fallback until then.
 */
export interface DeferBlock extends Range {
  kind: 'defer';
  trigger: ClientTrigger;
  body: Body;
  fallback?: Body;
}

/**
 * `#offscreen (visible) { … }`: a body that stays in the page while it is
 * hidden, with its markup and state, but does not run its effects.
 */
export interface OffscreenBlock extends Range {
  kind: 'offscreen';
  visible: Expression;
  body: Body;
}

export type Block =
  | IfBlock
  | ForBlock
  | RepeatBlock
  | SwitchBlock
  | KeyBlock
  | TryBlock
  | LoadingBlock
  | PortalBlock
  | HeadBlock
  | ClientBlock
  | DeferBlock
  | OffscreenBlock;

export interface TemplateDecl extends Range {
  kind: 'template';
  name: string;
  nameRange: Range;
  params: oxc.ParamPattern[];
  body: Body;
}

/** The markup inside a node: the children of an element, or the bodies of a block. */
export function getChildren(node: Markup): Markup[] {
  switch (node.kind) {
    case 'element':
    case 'component':
    case 'dynamic':
    case 'fragment':
      return node.children;
    case 'if': {
      const children: Markup[] = [];
      for (const branch of node.branches) {
        children.push(...branch.body.children);
      }
      children.push(...(node.fallback?.children ?? []));
      return children;
    }
    case 'switch': {
      const children: Markup[] = [];
      for (const branch of node.cases) {
        children.push(...branch.body.children);
      }
      children.push(...(node.fallback?.children ?? []));
      return children;
    }
    case 'for':
    case 'repeat':
    case 'loading':
    case 'client':
    case 'defer':
      return [...node.body.children, ...(node.fallback?.children ?? [])];
    case 'try':
      return [...node.body.children, ...node.fallback.children];
    case 'key':
    case 'portal':
    case 'head':
    case 'offscreen':
      return node.body.children;
    default:
      return [];
  }
}

/** Visits every markup node of a file, including blocks and templates. */
export function forEachNode(nodes: Markup[], visit: (node: Markup) => void): void {
  for (const node of nodes) {
    visit(node);
    forEachNode(getChildren(node), visit);
  }
}

/** Returns the bodies of a block, in source order. */
export function blockBodies(block: Block): Body[] {
  switch (block.kind) {
    case 'if': {
      const bodies: Body[] = [];
      for (const branch of block.branches) {
        bodies.push(branch.body);
      }
      if (block.fallback) {
        bodies.push(block.fallback);
      }
      return bodies;
    }
    case 'switch': {
      const bodies: Body[] = [];
      for (const branch of block.cases) {
        bodies.push(branch.body);
      }
      if (block.fallback) {
        bodies.push(block.fallback);
      }
      return bodies;
    }
    case 'for':
    case 'repeat':
    case 'loading':
    case 'client':
    case 'defer':
      return [block.body, ...(block.fallback ? [block.fallback] : [])];
    case 'try':
      return [block.body, block.fallback];
    default:
      return [block.body];
  }
}

/** Where a body sits in its file. */
export interface BodyInfo {
  /** The body around this one, or undefined for the body of the component. */
  parent?: Body;
  /**
   * True if no element of the parent body is around this body, so its top-level elements are
   * top-level elements of the parent too. A template body is never top-level: it renders where
   * it is called.
   */
  top: boolean;
  /** True for the body of a template. */
  template: boolean;
}

/** The place of every body of a file: the bodies of blocks and of templates. */
export function bodyTree(file: SFCFile): Map<Body, BodyInfo> {
  const tree = new Map<Body, BodyInfo>();
  function visitBody(body: Body, parent: Body | undefined, top: boolean, template = false): void {
    tree.set(body, { parent, top, template });
    for (const declared of body.templates) {
      visitBody(declared.body, body, false, true);
    }
    visitNodes(body.children, body, true);
  }
  function visitNodes(nodes: Markup[], parent: Body | undefined, top: boolean): void {
    for (const node of nodes) {
      switch (node.kind) {
        case 'element':
          visitNodes(node.children, parent, false);
          break;
        case 'component':
        case 'dynamic':
        case 'fragment':
          visitNodes(node.children, parent, top);
          break;
        case 'text':
        case 'insert':
        case 'listener':
          break;
        default:
          for (const body of blockBodies(node)) {
            visitBody(body, parent, top);
          }
      }
    }
  }
  for (const template of file.templates) {
    visitBody(template.body, undefined, false, true);
  }
  visitNodes(file.children, undefined, true);
  return tree;
}

const fileBodies = new WeakMap<SFCFile, Body>();

/**
 * The body of the file itself, the outermost block: its script, `<style>` elements, templates
 * and markup. It is not in `bodyTree`, where a body without a parent sits directly in it.
 */
export function fileBody(file: SFCFile): Body {
  let body = fileBodies.get(file);
  if (!body) {
    body = {
      start: 0,
      end: file.source.length,
      script: file.instanceScript,
      styles: file.styles,
      templates: file.templates,
      children: file.children,
    };
    fileBodies.set(file, body);
  }
  return body;
}
