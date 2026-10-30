import type { oxc } from './oxc.ts';
import type { Block } from './ast.ts';
import { isWithin, lookup } from './model.ts';
import type {
  Declaration,
  DeclarationKind,
  Diagnostic,
  Scope,
  SemanticModel,
  Site,
} from './model.ts';

export type GraphNode =
  | { kind: 'source'; declaration: Declaration }
  | { kind: 'memo'; declaration: Declaration; site: Site }
  | { kind: 'binding'; site: Site }
  | { kind: 'block'; site: Site; block: Block }
  | { kind: 'effect'; site: Site };

export interface Edge {
  from: GraphNode;
  to: GraphNode;
}

export interface Graph {
  model: SemanticModel;
  nodes: GraphNode[];
  edges: Edge[];
  /** Nodes whose value can change on the client. */
  live: Set<GraphNode>;
  /** Sites whose code can run on the client. */
  reached: Set<Site>;
  /** Body and template scopes that the client may create. */
  created: Set<Scope>;
  diagnostics: Diagnostic[];
}

/** Memos that a server function refreshes are live, so they have client code. */
function isMemoKind(kind: DeclarationKind): boolean {
  return kind === 'memo' || kind === 'async-memo';
}

const SOURCE_KINDS = new Set<DeclarationKind>([
  'context',
  'signal',
  'action',
  'prop',
  'props-rest',
  'item',
  'index',
  'error',
  'template-param',
]);

export interface GraphOptions {
  /**
   * The props that a parent can change on the client. `*` means every prop.
   * Without it, every prop can change, as when a file is compiled alone.
   */
  liveProps?: Set<string>;
}

/** True if a prop or the rest of the props can change on the client. */
function isLiveProp(declaration: Declaration, liveProps: Set<string> | undefined): boolean {
  if (!liveProps || liveProps.has('*')) {
    return true;
  }
  if (declaration.kind === 'props-rest') {
    // The rest changes when a prop that is not destructured by name changes.
    const named = new Set(
      [...declaration.scope.declarations.values()].flatMap((item) =>
        item.propKey ? [item.propKey] : [],
      ),
    );
    return [...liveProps].some((key) => !named.has(key));
  }
  if (declaration.propKey === undefined) {
    // The props object, or a computed key.
    return liveProps.size > 0;
  }
  return (
    liveProps.has(declaration.propKey) || (liveProps.has('~') && declaration.propKey !== 'children')
  );
}

/** True if client code reads the `reset` function of a `#try` block. */
export function resetUsed(model: SemanticModel, block: Block, reached: Set<Site>): boolean {
  return model.declarations.some(
    (declaration) =>
      declaration.kind === 'reset' &&
      declaration.block === block &&
      declaration.reads.some((read) => reached.has(read.site)),
  );
}

/** Sites whose code runs in the browser after the page renders, and can throw there. */
const CLIENT_CODE = new Set(['event', 'effect', 'client']);

/**
 * True if the body of a `#try` holds code that runs in the browser: a
 * handler, an effect, a `$client` callback, a memo that loads, or a read of a
 * memo, which throws when the memo holds an error. An error in it renders
 * the `#catch` body in the browser, so both bodies ship.
 */
export function tryCatchesClient(model: SemanticModel, block: Block & { kind: 'try' }): boolean {
  const body = model.scopes.find((scope) => scope.block === block && scope.body === block.body);
  if (body === undefined) {
    return false;
  }
  for (const site of model.sites) {
    if (
      (CLIENT_CODE.has(site.kind) ||
        (site.kind === 'memo' && site.declaration?.kind === 'async-memo')) &&
      isWithin(site.scope, body)
    ) {
      return true;
    }
  }
  // A memo that threw holds its error, so each read of it throws.
  for (const declaration of model.declarations) {
    if (isMemoKind(declaration.kind)) {
      for (const read of declaration.reads) {
        if (isWithin(read.site.scope, body)) {
          return true;
        }
      }
    }
  }
  return false;
}

/** True if the expression of a site is a prop that is typed as a promise, such as `$memo(user)`. */
function isPropValue(site: Site | undefined): boolean {
  let node = site?.node;
  while (node?.type === 'ParenthesizedExpression') {
    node = node.expression;
  }
  if (node?.type !== 'Identifier') {
    return false;
  }
  const declaration = lookup(site!.scope, node.name);
  return declaration?.kind === 'prop' && declaration.promise === true;
}

/** True if a site's expression is a function, such as a function passed as a prop. */
/** True for a site whose value is a `#template`, such as the prop `item=option`. */
export function isTemplateValue(site: Site): boolean {
  return site.node.type === 'Identifier' && lookup(site.scope, site.node.name)?.kind === 'template';
}

export function isFunctionValue(site: Site): boolean {
  let node: oxc.Node = site.node;
  // A wrapper of `brumate/events`, such as `prevent(save)`, returns the handler that it wraps.
  for (;;) {
    while (node.type === 'ParenthesizedExpression') {
      node = node.expression;
    }
    if (
      node.type !== 'CallExpression' ||
      node.callee.type !== 'Identifier' ||
      lookup(site.scope, node.callee.name)?.imported?.source !== 'brumate/events' ||
      !node.arguments[0]
    ) {
      break;
    }
    node = node.arguments[0];
  }
  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    return true;
  }
  if (node.type === 'Identifier') {
    const kind = lookup(site.scope, node.name)?.kind;
    // A template passed as a prop renders in the browser too, such as in a list that changes.
    return kind === 'function' || kind === 'server-function' || kind === 'template';
  }
  return false;
}

export function buildGraph(model: SemanticModel, options: GraphOptions = {}): Graph {
  const nodes: GraphNode[] = [];
  const edges: Edge[] = [];
  const declarationNodes = new Map<Declaration, GraphNode>();
  const siteNodes = new Map<Site, GraphNode>();
  const incoming = new Map<GraphNode, GraphNode[]>();
  const diagnostics: Diagnostic[] = [];

  const addNode = (node: GraphNode): GraphNode => {
    nodes.push(node);
    incoming.set(node, []);
    return node;
  };
  const addEdge = (from: GraphNode, to: GraphNode): void => {
    if (!incoming.get(to)!.includes(from)) {
      edges.push({ from, to });
      incoming.get(to)!.push(from);
    }
  };

  for (const declaration of model.declarations) {
    if (SOURCE_KINDS.has(declaration.kind)) {
      declarationNodes.set(declaration, addNode({ kind: 'source', declaration }));
    }
  }
  for (const site of model.sites) {
    let node: GraphNode | undefined;
    switch (site.kind) {
      case 'memo':
        node = addNode({ kind: 'memo', declaration: site.declaration!, site });
        declarationNodes.set(site.declaration!, node);
        break;
      case 'insert':
      case 'attribute':
      case 'prop':
      case 'tag':
      case 'spread':
      case 'style':
      case 'provide':
      case 'title':
        node = addNode({ kind: 'binding', site });
        break;
      case 'block':
        node = addNode({ kind: 'block', site, block: site.block! });
        break;
      case 'effect':
        node = addNode({ kind: 'effect', site });
        break;
      default:
        break;
    }
    if (node) {
      siteNodes.set(site, node);
    }
  }

  // The values that a site depends on, through the functions it calls.
  const dependencies = (site: Site, seen = new Set<Site>()): Declaration[] => {
    if (seen.has(site)) {
      return [];
    }
    seen.add(site);
    const result: Declaration[] = [];
    for (const read of site.reads) {
      if (read.tracked && declarationNodes.has(read.declaration)) {
        result.push(read.declaration);
      }
    }
    // A call inside `$untrack` reads its values without depending on them.
    for (const callee of site.trackedCalls) {
      if (callee.kind === 'function' && callee.site) {
        result.push(...dependencies(callee.site, seen));
      }
    }
    return result;
  };

  for (const [site, node] of siteNodes) {
    // A function prop is a fixed reference to a handler, which reads current values when it runs.
    if (site.kind === 'prop' && isFunctionValue(site)) {
      continue;
    }
    for (const declaration of dependencies(site)) {
      addEdge(declarationNodes.get(declaration)!, node);
    }
  }
  // Loop variables change with the list.
  for (const [site, node] of siteNodes) {
    const block = site.block;
    if (site.kind !== 'block' || !block || (block.kind !== 'for' && block.kind !== 'repeat')) {
      continue;
    }
    if (site.label === 'for key') {
      continue;
    }
    for (const declaration of model.declarations) {
      if (
        declaration.block === block &&
        (declaration.kind === 'item' || declaration.kind === 'index')
      ) {
        addEdge(node, declarationNodes.get(declaration)!);
      }
    }
  }

  const headers = new Map<Block, GraphNode[]>();
  for (const [site, node] of siteNodes) {
    if (site.kind === 'block' && site.block && site.label !== 'for key') {
      const list = headers.get(site.block) ?? [];
      list.push(node);
      headers.set(site.block, list);
    }
  }

  const live = new Set<GraphNode>();
  const reached = new Set<Site>();
  const created = new Set<Scope>();

  const reach = (site: Site): void => {
    if (reached.has(site)) {
      return;
    }
    reached.add(site);
    for (const callee of site.calls) {
      if (callee.site) {
        reach(callee.site);
      }
    }
  };

  for (let changed = true; changed;) {
    changed = false;
    const before = live.size + reached.size + created.size;

    // Scopes that the client creates.
    for (const scope of model.scopes) {
      if (created.has(scope)) {
        continue;
      }
      const block = scope.block;
      const parentCreated = scope.parent !== undefined && created.has(scope.parent);
      const blockLive =
        scope.kind === 'body' &&
        block !== undefined &&
        // The client renders the body of a `#client` block. The server renders its fallback.
        ((block.kind === 'client' && scope.body === block.body) ||
          // A portal into a target renders on the client, where the target is.
          (block.kind === 'portal' && block.target !== undefined) ||
          // The browser renders the items of a windowed list as they come into view.
          (block.kind === 'for' && block.window !== undefined && scope.body === block.body) ||
          // Client code can call `reset` to render a `#try` body again, and an error in the
          // client code of the body renders the `#catch` body.
          (block.kind === 'try' &&
            (resetUsed(model, block, reached) || tryCatchesClient(model, block))) ||
          (headers.get(block) ?? []).some((node) => live.has(node)) ||
          (block.kind === 'try' && scope.body === block.fallback && tryChanges(block)));
      const templateUsed = scope.kind === 'template' && templateCallChanges(scope);
      if (parentCreated || blockLive || templateUsed) {
        created.add(scope);
      }
    }

    // Code that runs on the client.
    for (const site of model.sites) {
      const isRoot =
        site.kind === 'event' ||
        site.kind === 'client' ||
        (site.kind === 'prop' && isFunctionValue(site)) ||
        // The window of a windowed list reads its list, its key and its height in the browser.
        (site.kind === 'block' && site.block?.kind === 'for' && site.block.window !== undefined) ||
        (site.kind === 'effect' && live.has(siteNodes.get(site)!)) ||
        created.has(site.scope);
      if (isRoot) {
        reach(site);
      }
    }

    // Values that change on the client.
    for (const [declaration, node] of declarationNodes) {
      if (live.has(node)) {
        continue;
      }
      const isLive =
        ((declaration.kind === 'prop' || declaration.kind === 'props-rest') &&
          isLiveProp(declaration, options.liveProps)) ||
        // A prop of `let` that client code writes, also when every parent passes a constant.
        (declaration.kind === 'prop' &&
          declaration.writable === true &&
          declaration.writes.some((write) => reached.has(write.site))) ||
        // A provider above can change the value.
        declaration.kind === 'context' ||
        // A form writes the result of its server function.
        declaration.kind === 'action' ||
        // A server function can ask the client to load the memo again.
        (isMemoKind(declaration.kind) &&
          [...(declaration.site?.calls ?? [])].some((callee) => callee.refreshed)) ||
        // A memo of a prop, which can be a promise: its value arrives later, also in a component
        // that the browser renders.
        (declaration.kind === 'memo' && isPropValue(declaration.site)) ||
        // Handlers write an optimistic value.
        (declaration.optimistic !== undefined &&
          declaration.writes.some((write) => reached.has(write.site))) ||
        (declaration.kind === 'signal' &&
          (declaration.writes.some((write) => reached.has(write.site)) ||
            declaration.refs.some((ref) => created.has(ref.scope)))) ||
        (declaration.kind === 'error' &&
          declaration.block?.kind === 'try' &&
          tryChanges(declaration.block)) ||
        // A child or an element writes it through `$bind`.
        declaration.bound === true ||
        (declaration.kind === 'template-param' && templateCallChanges(declaration.scope));
      if (isLive) {
        live.add(node);
      }
    }
    for (let propagated = true; propagated;) {
      propagated = false;
      for (const node of nodes) {
        if (!live.has(node) && incoming.get(node)!.some((from) => live.has(from))) {
          live.add(node);
          propagated = true;
        }
      }
    }

    if (live.size + reached.size + created.size !== before) {
      changed = true;
    }
  }

  // A template's arguments change when a call to it changes or runs on the client.
  function templateCallChanges(scope: Scope): boolean {
    const template = scope.template && lookup(scope.parent!, scope.template.name);
    return model.sites.some((site) => {
      if (!template || !site.calls.has(template)) {
        return false;
      }
      const node = siteNodes.get(site);
      return reached.has(site) || (node !== undefined && live.has(node));
    });
  }

  // A #try can fail on the client only if its body changes there.
  function tryChanges(block: Block & { kind: 'try' }): boolean {
    const body = model.scopes.find((scope) => scope.block === block && scope.body === block.body);
    if (!body) {
      return false;
    }
    for (const [site, node] of siteNodes) {
      if (live.has(node) && isWithin(site.scope, body)) {
        return true;
      }
    }
    return model.scopes.some((scope) => created.has(scope) && isWithin(scope, body));
  }

  for (const [site, node] of siteNodes) {
    if (site.kind === 'effect' && !live.has(node)) {
      diagnostics.push({
        severity: 'warning',
        message: 'This $effect reads no value that changes on the client, so it never runs',
        range: site.range,
      });
    }
  }

  // The server renders a `#defer` body again in a request of its own, with the rest of the page,
  // so the block must be in markup that the server renders. The browser renders `#client` bodies.
  for (const scope of model.scopes) {
    const block = scope.block;
    if (block?.kind !== 'defer' || scope.body !== block.body) {
      continue;
    }
    let message: string | undefined;
    for (let outer = scope.parent; outer && !message; outer = outer.parent) {
      const around = outer.block;
      if (around?.kind === 'client' && outer.body === around.body) {
        message = '#defer cannot be inside a #client body';
      } else if (created.has(outer)) {
        message = '#defer cannot be in markup that the browser renders';
      }
    }
    if (message) {
      diagnostics.push({
        severity: 'error',
        message,
        range: { start: block.start, end: block.start + '#defer'.length },
      });
    }
  }

  return { model, nodes, edges, live, reached, created, diagnostics };
}
