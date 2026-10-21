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
  /** For `const name = $id()`, the position of the call among the `$id` calls of its scope. */
  idIndex?: number;
  /** Elements whose `ref` targets this declaration. */
  refs: { attribute: RefAttribute; element: ElementNode; scope: Scope }[];
}

export interface Reference {
  range: Range;
  declaration: Declaration;
  site: Site;
  /** False inside `$untrack(…)`. */
  tracked: boolean;
  /** True inside a function that the site contains, such as an inline arrow function. */
  inFunction: boolean;
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
  /** The declaration that a function or memo site belongs to. */
  declaration?: Declaration;
  /** The element, component or listener of an attribute or event site. */
  owner?: ElementNode | ComponentNode | DynamicTagNode | GlobalListenerNode;
  event?: EventAttribute;
  /** The block whose header this site is. */
  block?: Block;
  /** The trigger of a `$client` site. */
  trigger?: 'visible' | 'idle' | 'load';
  /** True if the site awaits outside a nested function. */
  awaits: boolean;
  /** More code of the site, such as the context of `$provide(context, value)`. */
  extra?: oxc.Node[];
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
