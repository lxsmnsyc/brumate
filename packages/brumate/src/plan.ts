import type { Block, Body, Markup, SFCFile } from './ast.ts';
import { isFunctionValue, resetUsed } from './graph.ts';
import type { Graph } from './graph.ts';
import { compileStyles } from './css.ts';
import type { StyleOutput } from './css.ts';
import type { Declaration, DeclarationKind, Scope, Site } from './model.ts';

export interface ScopePlan {
  scope: Scope;
  /** Declarations that client code reads, in slot order. */
  slots: Declaration[];
  /** True if the scope gets an ID at render time. */
  needsId: boolean;
  /** The number of anchors in the scope. */
  anchors: number;
}

/** A markup node or a site that the client must find in the page. */
export type AnchorTarget = Markup | Site;

export interface Plan {
  graph: Graph;
  /** The name of the component function, from the file name. */
  name: string;
  /** Identifies the component in handler references. */
  id: string;
  scopes: Map<Scope, ScopePlan>;
  /** The scope of each body, including template bodies. */
  bodyScopes: Map<Body, Scope>;
  /** The anchor index of a node within its scope. */
  anchors: Map<AnchorTarget, number>;
  /** The export name of each client root, such as `h3`. */
  symbols: Map<Site, string>;
  /** Sites whose code runs on the client, including update code for live nodes. */
  clientSites: Set<Site>;
  /** The compiled `<style>` blocks. */
  styles: StyleOutput;
  /** True if a style variable can change on the client. */
  liveStyles: boolean;
}

// Declarations that are code or come from imports, so they never need a slot.
const NO_SLOT = new Set<DeclarationKind>([
  'import',
  'module',
  'function',
  'server-function',
  'template',
  'reset',
]);

/** Returns the component name for a file name, such as `TodoList` for `todo-list.brm`. */
export function getComponentName(filename: string): string {
  const base = filename
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]*$/, '');
  const name = base
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
  return /^\d/.test(name) ? `Component${name}` : name || 'Component';
}

/** A short, stable hash of a string, in base 36. */
export function hash(value: string): string {
  let result = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 0x01000193);
  }
  return (result >>> 0).toString(36);
}

/**
 * Finds the code that runs on the client, and the declarations that it
 * reads, by scope. Those declarations are the slots: the server writes
 * their values into the page state.
 */
export function clientState(graph: Graph): {
  isLiveSite: (site: Site) => boolean;
  clientSites: Set<Site>;
  slots: Map<Scope, Declaration[]>;
} {
  const model = graph.model;
  const siteNodes = new Map<Site, boolean>();
  for (const node of graph.nodes) {
    if (node.kind !== 'source') {
      siteNodes.set(node.site, graph.live.has(node));
    }
  }
  const isLiveSite = (site: Site): boolean => siteNodes.get(site) === true;

  // Code on the client: reached sites, live nodes, and the functions they call.
  const clientSites = new Set<Site>();
  const addClientSite = (site: Site): void => {
    if (clientSites.has(site)) {
      return;
    }
    clientSites.add(site);
    for (const callee of site.calls) {
      if (callee.kind === 'function' && callee.site) {
        addClientSite(callee.site);
      }
    }
  };
  for (const site of model.sites) {
    if (graph.reached.has(site) || isLiveSite(site)) {
      addClientSite(site);
    }
  }

  const slots = new Map<Scope, Declaration[]>();
  for (const scope of model.scopes) {
    if (scope.kind === 'module') {
      continue;
    }
    slots.set(
      scope,
      [...scope.declarations.values()].filter(
        (declaration) =>
          !NO_SLOT.has(declaration.kind) &&
          declaration.reads.some((read) => clientSites.has(read.site)),
      ),
    );
  }
  return { isLiveSite, clientSites, slots };
}

export function createPlan(file: SFCFile, graph: Graph, path?: string): Plan {
  const model = graph.model;
  const name = getComponentName(file.filename);
  const bodyScopes = new Map<Body, Scope>();
  for (const scope of model.scopes) {
    if (scope.body) {
      bodyScopes.set(scope.body, scope);
    }
  }

  const { isLiveSite, clientSites, slots: slotLists } = clientState(graph);
  const scopes = new Map<Scope, ScopePlan>();
  for (const [scope, slots] of slotLists) {
    scopes.set(scope, { scope, slots, needsId: scope.kind === 'component', anchors: 0 });
  }

  const anchors = new Map<AnchorTarget, number>();
  const anchor = (scope: Scope, target: AnchorTarget): void => {
    const plan = scopes.get(scope)!;
    anchors.set(target, plan.anchors++);
    plan.needsId = true;
  };

  const symbols = new Map<Site, string>();
  for (const site of model.sites) {
    if (site.kind === 'event' || (site.kind === 'prop' && isFunctionValue(site))) {
      symbols.set(site, `h${site.id}`);
    } else if (site.kind === 'client') {
      symbols.set(site, `c${site.id}`);
      anchor(site.scope, site);
    }
  }

  const sitesByNode = new Map<object, Site[]>();
  for (const site of model.sites) {
    if (site.owner) {
      const list = sitesByNode.get(site.owner) ?? [];
      list.push(site);
      sitesByNode.set(site.owner, list);
    }
  }
  const insertSites = new Map<object, Site>();
  for (const site of model.sites) {
    if (site.kind === 'insert') {
      insertSites.set(site.node, site);
    }
  }
  const headerSites = new Map<Block, Site[]>();
  for (const site of model.sites) {
    if (site.kind === 'block' && site.block && site.label !== 'for key') {
      const list = headerSites.get(site.block) ?? [];
      list.push(site);
      headerSites.set(site.block, list);
    }
  }
  const refTargets = new Map<object, Declaration>();
  for (const declaration of model.declarations) {
    for (const ref of declaration.refs) {
      refTargets.set(ref.attribute, declaration);
    }
  }
  const slotted = new Set<Declaration>();
  for (const plan of scopes.values()) {
    for (const declaration of plan.slots) {
      slotted.add(declaration);
    }
  }

  const visitBody = (body: Body): void => {
    const scope = bodyScopes.get(body)!;
    for (const template of body.templates) {
      visitBody(template.body);
    }
    visitNodes(body.children, scope);
  };

  const visitNodes = (nodes: Markup[], scope: Scope): void => {
    for (const node of nodes) {
      visitNode(node, scope);
    }
  };

  const visitNode = (node: Markup, scope: Scope): void => {
    switch (node.kind) {
      case 'text':
        return;
      case 'insert': {
        const site = insertSites.get(node.expression.ast);
        if (site && isLiveSite(site)) {
          anchor(scope, node);
        }
        return;
      }
      case 'element':
      case 'dynamic': {
        const sites = sitesByNode.get(node) ?? [];
        const hasRef =
          node.kind === 'element' &&
          node.attributes.some((attribute) => {
            const target = attribute.kind === 'ref' ? refTargets.get(attribute) : undefined;
            return target !== undefined && slotted.has(target);
          });
        if (hasRef || sites.some((site) => site.kind === 'event' || isLiveSite(site))) {
          anchor(scope, node);
        }
        visitNodes(node.children, scope);
        return;
      }
      case 'component': {
        const sites = sitesByNode.get(node) ?? [];
        if (sites.some((site) => isLiveSite(site))) {
          anchor(scope, node);
        }
        visitNodes(node.children, scope);
        return;
      }
      case 'fragment':
        visitNodes(node.children, scope);
        return;
      case 'listener':
        anchor(scope, node);
        return;
      default:
        visitBlock(node, scope);
    }
  };

  const visitBlock = (block: Block, scope: Scope): void => {
    const portalTarget = block.kind === 'portal' && block.target !== undefined;
    const live =
      block.kind === 'client' ||
      portalTarget ||
      (block.kind === 'try' && resetUsed(model, block, graph.reached)) ||
      (headerSites.get(block) ?? []).some((site) => isLiveSite(site));
    if (live) {
      anchor(scope, block);
    }
    if (block.kind === 'portal' || block.kind === 'head') {
      // Portal content is marked with its scope ID, so it can be removed with its block.
      scopes.get(bodyScopes.get(block.body)!)!.needsId = true;
    }
    for (const body of blockBodies(block)) {
      if (live && (block.kind === 'for' || block.kind === 'repeat') && body === block.body) {
        // Each item gets an ID for its marker.
        scopes.get(bodyScopes.get(body)!)!.needsId = true;
      }
      visitBody(body);
    }
  };

  for (const template of file.templates) {
    visitBody(template.body);
  }
  visitNodes(file.children, model.component);

  for (const plan of scopes.values()) {
    if (plan.slots.length > 0) {
      plan.needsId = true;
    }
    // IDs from `$id()` are made from the scope's ID, so each instance needs its own.
    if (
      [...plan.scope.declarations.values()].some((declaration) => declaration.idIndex !== undefined)
    ) {
      plan.needsId = true;
    }
  }

  const styles = compileStyles(file, hash(file.filename), path);
  const liveStyles = model.sites.some((site) => site.kind === 'style' && isLiveSite(site));

  return {
    graph,
    name,
    id: `${name}_${hash(file.filename)}`,
    styles,
    liveStyles,
    scopes,
    bodyScopes,
    anchors,
    symbols,
    clientSites,
  };
}

/** Returns the bodies of a block, in source order. */
export function blockBodies(block: Block): Body[] {
  switch (block.kind) {
    case 'if':
      return [
        ...block.branches.map((branch) => branch.body),
        ...(block.fallback ? [block.fallback] : []),
      ];
    case 'switch':
      return [
        ...block.cases.map((branch) => branch.body),
        ...(block.fallback ? [block.fallback] : []),
      ];
    case 'for':
    case 'repeat':
    case 'loading':
      return [block.body, ...(block.fallback ? [block.fallback] : [])];
    case 'try':
      return [block.body, block.fallback];
    default:
      return [block.body];
  }
}
