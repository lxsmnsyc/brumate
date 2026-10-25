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

export type Modifier = 'prevent' | 'stop' | 'passive' | 'once' | 'capture';

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
  modifiers: Modifier[];
  handler: Expression;
}

export interface RefAttribute extends Range {
  kind: 'ref';
  /** The name of a signal. */
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
