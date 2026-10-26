import type {
  Block,
  Body,
  ComponentNode,
  DynamicTagNode,
  ElementNode,
  EventAttribute,
  GlobalListenerNode,
  Range,
  RefAttribute,
  TemplateDecl,
} from './ast.ts';
import type { oxc } from './oxc.ts';

export type ScopeKind = 'module' | 'component' | 'body' | 'template';

export interface Scope {
  id: number;
  kind: ScopeKind;
  parent?: Scope;
  children: Scope[];
  declarations: Map<string, Declaration>;
  /** The block that owns a body scope. */
  block?: Block;
  /** The body or template that a scope holds. */
  body?: Body;
  template?: TemplateDecl;
}

export type DeclarationKind =
  | 'import'
  | 'module'
  | 'prop'
  | 'props-rest'
  | 'signal'
  | 'memo'
  | 'async-memo'
  | 'function'
  | 'server-function'
  | 'const'
  | 'let'
  | 'item'
  | 'index'
  | 'error'
  | 'reset'
  | 'template'
  | 'template-param'
  | 'context'
  | 'action';

export interface Declaration {
  id: number;
  name: string;
  kind: DeclarationKind;
  scope: Scope;
  range: Range;
  /** The site of a function, a server function or a memo. */
  site?: Site;
  /** The block that declares an item, an index, an error or a reset function. */
  block?: Block;
  reads: Reference[];
  writes: Reference[];
  /**
   * The prop that a destructured prop reads, such as `user` for
   * `const { user: { name } } = $props()`. Undefined for the props object.
   */
  propKey?: string;
  /** For `const result = $action(fn)`, the name of the server function. */
  action?: string;
  /** True for a server function that a server function refreshes with `refresh(fn)`. */
  refreshed?: boolean;
  /** For an import, the module and the name that it imports, such as `default`. */
  imported?: { source: string; name: string };
  /** For an import of a function of a `'use server'` file, the ID of the function. */
  serverImport?: string;
  /**
   * For `let shown = $optimistic(source)`, the value it follows. A write sets
   * a guess, until the source changes or the server calls of the page finish.
   */
  optimistic?: Declaration;
  /**
   * For `$debounced(value, ms)` and `$throttled(value, ms)`, how the browser
   * writes the memo: after the value stops changing for `ms`, or at most once every `ms`.
   */
  timing?: { kind: 'debounced' | 'throttled'; ms: number };
  /** For `let name = $signal(value)`, the value. */
  init?: oxc.Node;
  /**
   * True for a memo declared with `$optimistic`, before its source is known,
   * and for a prop that the component destructures with `let`.
   */
  writable?: boolean;
  /** True for a signal or a writable prop that `$bind` passes to a child, which needs a slot. */
  bound?: boolean;
  /** True for `const name = await $memo(value)`: the render waits for the memo where it is declared. */
  awaited?: boolean;
  /** For `const name = $id()`, the position of the call among the `$id` calls of its scope. */
  idIndex?: number;
  /** For `const name = $isPassed(prop)`, the key of the prop. */
  passedKey?: string;
  /** Elements whose `ref` targets this declaration. */
  refs: { attribute: RefAttribute; element: ElementNode | DynamicTagNode; scope: Scope }[];
}

export interface Reference {
  range: Range;
  declaration: Declaration;
  site: Site;
  /** False inside `$untrack(…)`. */
  tracked: boolean;
  /** True inside a function that the site contains, such as an inline arrow function. */
  inFunction: boolean;
  /**
   * For `await name` of a memo, the range of the whole `await` expression.
   * The render around the read waits for the memo, and the read compiles to
   * a plain read of its value.
   */
  await?: Range;
}

export type SiteKind =
  | 'setup'
  | 'function'
  | 'server-function'
  | 'memo'
  | 'effect'
  | 'client'
  | 'insert'
  | 'attribute'
  | 'event'
  | 'prop'
  | 'spread'
  | 'tag'
  | 'block'
  | 'style'
  | 'provide'
  | 'title';

/** A place where code runs: a function, a statement or a markup expression. */
export interface Site {
  id: number;
  kind: SiteKind;
  scope: Scope;
  range: Range;
  node: oxc.Node;
  /** A short name for printing, such as `function add` or `insert`. */
  label: string;
  reads: Reference[];
  writes: Reference[];
  /** Functions, server functions and templates that the site references. */
  calls: Set<Declaration>;
  /**
   * The calls outside `$untrack`. The values that their functions read are
   * values that the site depends on.
   */
  trackedCalls: Set<Declaration>;
  /** The declaration that a function or memo site belongs to. */
  declaration?: Declaration;
  /** The element, component or listener of an attribute or event site. */
  owner?: ElementNode | ComponentNode | DynamicTagNode | GlobalListenerNode;
  event?: EventAttribute;
  /**
   * For a handler wrapped by `brumate/events`, such as `prevent(move, 'Enter')`,
   * the modifiers that `b-on` holds, such as `prevent(Enter)`.
   */
  modifiers?: string[];
  /** The block whose header this site is. */
  block?: Block;
  /** The trigger of a `$client` site. */
  trigger?: 'visible' | 'idle' | 'load';
  /** True if the site awaits outside a nested function. */
  awaits: boolean;
  /** More code of the site, such as the context of `$setContext(context, value)`. */
  extra?: oxc.Node[];
  /**
   * For the function of `$handler(fn, ...args)`, the call, which the server
   * turns into a reference that a spread can pass on, with its arguments.
   */
  handler?: oxc.CallExpression;
  /** For the function of `$bind(name, fn)`, the call, which passes it as the setter of the binding. */
  setter?: oxc.CallExpression;
}

export type Severity = 'error' | 'warning';

export interface Diagnostic {
  severity: Severity;
  message: string;
  range: Range;
}

export interface SemanticModel {
  module: Scope;
  component: Scope;
  scopes: Scope[];
  declarations: Declaration[];
  sites: Site[];
  /** The `$bind(name)` calls, with the declaration of their name. */
  /** The `$bind` calls, with the declaration of their name and the site of their setter. */
  bindings: { call: oxc.CallExpression; declaration: Declaration; setter?: Site }[];
  diagnostics: Diagnostic[];
}

/** Returns true if `scope` is `ancestor` or inside it. */
export function isWithin(scope: Scope, ancestor: Scope): boolean {
  for (let current: Scope | undefined = scope; current; current = current.parent) {
    if (current === ancestor) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the memos and props that a memo reads, directly or through other
 * memos. A memo is pending while any of them loads. A prop loads when a
 * parent passes it a promise.
 */
export function upstreamMemos(declaration: Declaration): Declaration[] {
  const result = new Set<Declaration>();
  const visit = (current: Declaration): void => {
    for (const read of current.site?.reads ?? []) {
      const next = read.declaration;
      if (next === declaration || result.has(next)) {
        continue;
      }
      if (next.kind === 'memo' || next.kind === 'async-memo') {
        result.add(next);
        visit(next);
      } else if (next.kind === 'prop') {
        result.add(next);
      }
    }
  };
  visit(declaration);
  return [...result];
}

/** Finds a declaration by name, from `scope` outwards. */
export function lookup(scope: Scope, name: string): Declaration | undefined {
  for (let current: Scope | undefined = scope; current; current = current.parent) {
    const declaration = current.declarations.get(name);
    if (declaration) {
      return declaration;
    }
  }
  return undefined;
}
