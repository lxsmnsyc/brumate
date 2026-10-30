import type { oxc } from './oxc.ts';
import type {
  Block,
  Body,
  ComponentNode,
  DynamicTagNode,
  ElementNode,
  InsertNode,
  Markup,
  SFCFile,
} from './ast.ts';
import { cleanText } from './codegen/patch.ts';
import { isFunctionValue, isTemplateValue, resetUsed, tryCatchesClient } from './graph.ts';
import type { Graph } from './graph.ts';
import { compileStyles } from './css.ts';
import { forEachNode } from './project.ts';
import type { StyleOutput } from './css.ts';
import type { Declaration, DeclarationKind, Diagnostic, Scope, Site } from './model.ts';

export interface ScopePlan {
  scope: Scope;
  /** Declarations that client code reads, in slot order. */
  slots: Declaration[];
  /** True if the scope gets an ID at render time. */
  needsId: boolean;
  /** The number of anchors in the scope. */
  anchors: number;
}

/** A node without the parentheses around it. */
function unparen(node: oxc.Node): oxc.Node {
  let current = node;
  while (current.type === 'ParenthesizedExpression') {
    current = current.expression;
  }
  return current;
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
  /** The scope of each anchor, for the devtools, which find an element by its scope and anchor. */
  anchorScopes: Map<AnchorTarget, Scope>;
  /**
   * Inserts that are the only content of their element. They share the
   * element's anchor and update its children, so they have no markers.
   */
  contents: Set<Markup>;
  /**
   * The inserts of `contents` whose element holds text, such as a
   * `<textarea>` or a `<title>`. The client sets the element's text.
   */
  textContents: Set<Markup>;
  /**
   * Lists whose item bodies are one element. The element's `b-b` marks
   * the item, in place of `<!--i…-->` and `<!--/i-->`.
   */
  elementItems: Set<Block>;
  /** The export name of each client root, such as `h3`. */
  symbols: Map<Site, string>;
  /**
   * The children of each component and dynamic tag, which the browser renders each time the
   * component inserts them: the export of their render, such as `n0`, and their scope.
   */
  childrenRenders: Map<ComponentNode | DynamicTagNode, { symbol: string; scope: Scope }>;
  /**
   * The component whose children hold a block, for the blocks in children. The browser renders
   * the new bodies of such a block with the contexts of that component, as the server does.
   */
  blockHolders: Map<Block, { node: ComponentNode; scope: Scope }>;
  /** Sites whose code runs on the client, including update code for live nodes. */
  clientSites: Set<Site>;
  /** The compiled `<style>` blocks. */
  styles: StyleOutput;
  /** True if a style variable can change on the client. */
  liveStyles: boolean;
  /** True when server function IDs hash the names of the functions. */
  hideNames: boolean;
  /** Errors in markup that the client could not update. */
  diagnostics: Diagnostic[];
}

/**
 * Elements that the HTML parser can end before their end tag, or whose
 * content it moves out, when they hold some other elements: a `<p>` ends at
 * a `<div>`, and a `<table>` moves out content that is not part of a table.
 */
const UNSTABLE = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'dt',
  'dd',
  'option',
  'optgroup',
  'select',
  'rb',
  'rp',
  'rt',
  'rtc',
  'table',
  'caption',
  'colgroup',
  'thead',
  'tbody',
  'tfoot',
  'template',
]);

/**
 * True if the browser keeps the element's content inside it, whatever that
 * content renders. Then an element inside it can find it with `closest`, and
 * it can stand for a list item. A `<tr>` is one when it holds only cells.
 */
function isStable(node: ElementNode): boolean {
  const tag = node.tag.toLowerCase();
  if (tag === 'tr') {
    return node.children.every((child) =>
      child.kind === 'text'
        ? cleanText(child.value).trim() === ''
        : child.kind === 'element' && ['td', 'th'].includes(child.tag.toLowerCase()),
    );
  }
  return !UNSTABLE.has(tag);
}

/**
 * Elements whose content is text, where a comment would be text too. The
 * parser reads `<script>` and `<style>` itself, so only these reach markup.
 */
const RAW_TEXT = new Set(['textarea', 'title']);

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

/**
 * The name of the function that a component compiles to: its name, or the name with `$` when a
 * script of the file has a top-level name of its own, such as an import of `ButtonContext` in
 * `button-context.brm`.
 */
export function componentFunctionName(file: SFCFile, name: string): string {
  const taken = new Set<string>();
  for (const script of [file.moduleScript, file.instanceScript]) {
    for (const statement of script?.program.body ?? []) {
      if (statement.type === 'ImportDeclaration') {
        for (const specifier of statement.specifiers ?? []) {
          taken.add(specifier.local.name);
        }
      } else if (statement.type === 'VariableDeclaration') {
        for (const declarator of statement.declarations) {
          if (declarator.id.type === 'Identifier') {
            taken.add(declarator.id.name);
          }
        }
      } else if (
        (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') &&
        statement.id
      ) {
        taken.add(statement.id.name);
      }
    }
  }
  let result = name;
  while (taken.has(result)) {
    result += '$';
  }
  return result;
}

/**
 * The ID of a server function: the component or file ID, and the name of the
 * function, or a hash of it, so a production build does not show the names.
 */
export function functionId(owner: string, name: string, hidden = false): string {
  return `${owner}#${hidden ? `f${hash(`${owner}#${name}`)}` : name}`;
}

/** The ID of a server function of a component. */
export function serverFunctionId(plan: Plan, name: string): string {
  return functionId(plan.id, name, plan.hideNames);
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
/**
 * The components and dynamic tags of a file that have children. The server sends their children
 * as a reference to a render of the browser, so each insert makes new scopes, as a block does.
 */
export function childrenHolders(file: SFCFile): (ComponentNode | DynamicTagNode)[] {
  const found: (ComponentNode | DynamicTagNode)[] = [];
  const visit = (node: Markup): void => {
    if ((node.kind === 'component' || node.kind === 'dynamic') && node.children.length > 0) {
      found.push(node);
    }
  };
  forEachNode(file.children, visit);
  for (const template of file.templates) {
    forEachNode(template.body.children, visit);
  }
  return found;
}

export function clientState(
  graph: Graph,
  file?: SFCFile,
): {
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
  // Children render in the browser each time a component inserts them, so their code is there.
  const ranges = (file ? childrenHolders(file) : []).map((node) => ({
    start: node.children[0]!.start,
    end: node.children.at(-1)!.end,
  }));
  if (ranges.length > 0) {
    for (const site of model.sites) {
      const node = site.node as { start?: number; end?: number };
      if (
        node.start !== undefined &&
        node.end !== undefined &&
        ranges.some((range) => range.start <= node.start! && node.end! <= range.end)
      ) {
        addClientSite(site);
      }
    }
  }
  // The update of a block reads all of its header, such as each condition of `#if` and
  // `#else if`, when one of them changes. So a condition that never changes, such as one of
  // `$isPassed`, is read in the browser too.
  const liveBlocks = new Set<Block>();
  for (const site of clientSites) {
    if (site.block) {
      liveBlocks.add(site.block);
    }
  }
  for (const site of model.sites) {
    if (site.block && liveBlocks.has(site.block)) {
      addClientSite(site);
    }
  }
  // The spreads of an element update together, so a spread that never changes, such as a rest
  // prop, is read in the browser when another spread of the same element changes. Without it,
  // the update would remove the attributes that it gives, such as a class. An attribute of the
  // element that changes reads them too, as a class of the element adds the class of a spread.
  const liveSpreads = new Set<Site['owner']>();
  for (const site of clientSites) {
    if ((site.kind === 'spread' || site.kind === 'attribute') && site.owner) {
      liveSpreads.add(site.owner);
    }
  }
  for (const site of model.sites) {
    if (site.kind === 'spread' && site.owner && liveSpreads.has(site.owner)) {
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
          (declaration.reads.some((read) => clientSites.has(read.site)) ||
            // A binding writes the slot of its name, and a bound prop writes the parent's
            // through its own, so they need slots without a read in the browser.
            declaration.bound === true ||
            // A prop forwards its element to the parent through its slot, and a dynamic tag
            // passes the slot of its signal to a component.
            declaration.refs.some(
              (ref) => declaration.kind === 'prop' || ref.element.kind === 'dynamic',
            ) ||
            (declaration.kind === 'prop' &&
              declaration.writable === true &&
              declaration.writes.some((write) => clientSites.has(write.site)))),
      ),
    );
  }
  return { isLiveSite, clientSites, slots };
}

export function createPlan(file: SFCFile, graph: Graph, path?: string, hideNames = false): Plan {
  const model = graph.model;
  const name = getComponentName(file.filename);
  const bodyScopes = new Map<Body, Scope>();
  for (const scope of model.scopes) {
    if (scope.body) {
      bodyScopes.set(scope.body, scope);
    }
  }

  const { isLiveSite, clientSites, slots: slotLists } = clientState(graph, file);
  const blockHolders = new Map<Block, { node: ComponentNode; scope: Scope }>();
  // The components whose children are being visited, innermost last.
  const holders: ComponentNode[] = [];
  const holderScopes = new Map<ComponentNode, Scope>();
  const childrenRenders = new Map<
    ComponentNode | DynamicTagNode,
    { symbol: string; scope: Scope }
  >();
  const scopes = new Map<Scope, ScopePlan>();
  for (const [scope, slots] of slotLists) {
    scopes.set(scope, { scope, slots, needsId: scope.kind === 'component', anchors: 0 });
  }

  // The `$bind` calls of the file, which make an element bind a value.
  const boundCalls = new Set<oxc.Node>(model.bindings.map((binding) => binding.call));
  const anchors = new Map<AnchorTarget, number>();
  const anchorScopes = new Map<AnchorTarget, Scope>();
  const anchor = (scope: Scope, target: AnchorTarget): void => {
    const plan = scopes.get(scope)!;
    anchors.set(target, plan.anchors++);
    anchorScopes.set(target, scope);
    plan.needsId = true;
  };

  const symbols = new Map<Site, string>();
  for (const site of model.sites) {
    if (site.kind === 'prop' && isTemplateValue(site)) {
      // A template that a component renders in the browser, which the core calls at once.
      symbols.set(site, `t${site.id}`);
    } else if (site.kind === 'event' || (site.kind === 'prop' && isFunctionValue(site))) {
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

  const contents = new Set<Markup>();
  const textContents = new Set<Markup>();
  const diagnostics: Diagnostic[] = [];
  const elementItems = new Set<Block>();
  // Root elements of list items, which get an anchor so they mark their item.
  const itemRoots = new Set<Markup>();

  // `outer` is the scope of the nearest element around the nodes that has an anchor, in the same
  // markup. An element inside it in the same scope finds its handlers' scope from that anchor.
  const visitBody = (body: Body, outer?: Scope): void => {
    const scope = bodyScopes.get(body)!;
    for (const template of body.templates) {
      visitBody(template.body);
    }
    visitNodes(body.children, scope, outer);
  };

  const visitNodes = (nodes: Markup[], scope: Scope, outer?: Scope): void => {
    for (const node of nodes) {
      visitNode(node, scope, outer);
    }
  };

  const visitNode = (node: Markup, scope: Scope, outer?: Scope): void => {
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
        const hasRef = node.attributes.some((attribute) => {
          const target = attribute.kind === 'ref' ? refTargets.get(attribute) : undefined;
          return target !== undefined && slotted.has(target);
        });
        const content = node.kind === 'element' ? liveContent(node) : undefined;
        const events = sites.some((site) => site.kind === 'event');
        // `value=$bind(name)`: the core finds the scope of the name from the anchor of the element.
        const bound =
          node.kind === 'element' &&
          node.attributes.some(
            (attribute) =>
              attribute.kind === 'value' && boundCalls.has(unparen(attribute.value.ast)),
          );
        // An element whose only anchor would be for its handlers finds their scope from
        // the anchor of an element around it, with `closest`.
        const implied = node.kind === 'element' && outer === scope;
        if (
          hasRef ||
          bound ||
          content ||
          itemRoots.has(node) ||
          sites.some((site) => isLiveSite(site)) ||
          (events && !implied)
        ) {
          anchor(scope, node);
        }
        if (content) {
          anchors.set(content, anchors.get(node)!);
          anchorScopes.set(content, scope);
          contents.add(content);
          if (node.kind === 'element' && RAW_TEXT.has(node.tag.toLowerCase())) {
            textContents.add(content);
          }
          return;
        }
        // The children of a dynamic tag can render inside a component. An element that the
        // browser can end early, before its children, is not one that they can find.
        let inner = outer;
        if (node.kind === 'dynamic') {
          inner = undefined;
          if (node.children.length > 0) {
            childrenRenders.set(node, { symbol: `n${childrenRenders.size}`, scope });
          }
        } else if (anchors.has(node)) {
          inner = isStable(node) ? scope : undefined;
        }
        visitNodes(node.children, scope, inner);
        if (node.kind === 'element' && RAW_TEXT.has(node.tag.toLowerCase())) {
          checkText(node);
        }
        return;
      }
      case 'component': {
        const sites = sitesByNode.get(node) ?? [];
        if (sites.some((site) => isLiveSite(site))) {
          anchor(scope, node);
        }
        if (node.children.length > 0) {
          childrenRenders.set(node, { symbol: `n${childrenRenders.size}`, scope });
        }
        // Children render inside the component's elements.
        holders.push(node);
        holderScopes.set(node, scope);
        visitNodes(node.children, scope);
        holders.pop();
        return;
      }
      case 'fragment':
        visitNodes(node.children, scope, outer);
        return;
      case 'listener':
        anchor(scope, node);
        return;
      default:
        visitBlock(node, scope, outer);
    }
  };

  /**
   * Reports live markup inside an element whose content is text. Its markers
   * would be text, so the client can only update a value that is the whole content.
   */
  const checkText = (element: ElementNode): void => {
    const found = firstAnchored(element.children, anchors);
    if (found) {
      const tag = element.tag.toLowerCase();
      diagnostics.push({
        severity: 'error',
        message: `A value that changes in <${tag}> must be its whole content, such as <${tag}>{\`Count \${count}\`}</${tag}>`,
        range: { start: found.start, end: found.end },
      });
    }
  };

  /** The live insert that is the whole content of an element, if any. */
  const liveContent = (node: ElementNode): InsertNode | undefined => {
    const [only, ...rest] = node.children.filter(
      (child) => child.kind !== 'text' || cleanText(child.value) !== '',
    );
    if (rest.length > 0 || only?.kind !== 'insert') {
      return undefined;
    }
    const site = insertSites.get(only.expression.ast);
    return site && isLiveSite(site) ? only : undefined;
  };

  const visitBlock = (block: Block, scope: Scope, outer?: Scope): void => {
    const portalTarget = block.kind === 'portal' && block.target !== undefined;
    const live =
      block.kind === 'client' ||
      // The browser renders the items of a windowed list as they come into view.
      (block.kind === 'for' && block.window !== undefined) ||
      // The browser asks for the body of a `#defer` block by its anchor.
      block.kind === 'defer' ||
      portalTarget ||
      (block.kind === 'try' &&
        (resetUsed(model, block, graph.reached) ||
          tryCatchesClient(model, block) ||
          holdsStream(block))) ||
      (headerSites.get(block) ?? []).some((site) => isLiveSite(site));
    if (live) {
      anchor(scope, block);
      // The component around it finds its scope by its anchor, for the contexts of its bodies.
      const holder = holders.at(-1);
      if (holder) {
        const holderScope = holderScopes.get(holder)!;
        blockHolders.set(block, { node: holder, scope: holderScope });
        if (!anchors.has(holder)) {
          anchor(holderScope, holder);
        }
      }
    }
    if (live && block.kind === 'offscreen') {
      // The client hides and shows the body's instance, and pauses the effects inside it.
      scopes.get(bodyScopes.get(block.body)!)!.needsId = true;
    }
    if (block.kind === 'portal' || block.kind === 'head') {
      // Portal content is marked with its scope ID, so it can be removed with its block.
      scopes.get(bodyScopes.get(block.body)!)!.needsId = true;
    }
    // Portal and head content renders elsewhere in the page.
    const inner = block.kind === 'portal' || block.kind === 'head' ? undefined : outer;
    for (const body of blockBodies(block)) {
      if (live && (block.kind === 'for' || block.kind === 'repeat') && body === block.body) {
        // Each item gets an ID for its marker.
        scopes.get(bodyScopes.get(body)!)!.needsId = true;
        const root = singleRoot(body);
        if (root) {
          itemRoots.add(root);
          elementItems.add(block);
        }
      }
      visitBody(body, inner);
    }
  };

  /** The element that is the whole markup of a body, when nothing else renders next to it. */
  const singleRoot = (body: Body): Markup | undefined => {
    const scope = bodyScopes.get(body)!;
    // `$client` callbacks render `<template>` markers next to the markup.
    if (
      body.templates.length > 0 ||
      model.sites.some((site) => site.kind === 'client' && site.scope === scope)
    ) {
      return undefined;
    }
    const [only, ...rest] = body.children.filter(
      (child) => child.kind !== 'text' || cleanText(child.value) !== '',
    );
    return rest.length === 0 && only?.kind === 'element' && isStable(only) ? only : undefined;
  };

  for (const template of file.templates) {
    visitBody(template.body);
  }
  visitNodes(file.children, model.component);

  // A `<title>` sets the title of the page from `#head`, as the tags of the head do. One in a
  // `<head>` element is the head's own, and one in an `<svg>` names a shape.
  const checkTitles = (nodes: Markup[], inHead: boolean): void => {
    for (const node of nodes) {
      switch (node.kind) {
        case 'element': {
          const tag = node.tag.toLowerCase();
          if (tag === 'title' && !inHead) {
            diagnostics.push({
              severity: 'error',
              message:
                'Put <title> in #head, as <meta> and <link>, such as #head { <title>{`${count} left`}</title> }',
              range: { start: node.start, end: node.end },
            });
          } else if (tag !== 'head' && tag !== 'svg') {
            checkTitles(node.children, inHead);
          }
          break;
        }
        case 'component':
        case 'dynamic':
        case 'fragment':
          checkTitles(node.children, inHead);
          break;
        case 'text':
        case 'insert':
        case 'listener':
          break;
        default:
          for (const body of blockBodies(node)) {
            checkTitles(body.children, inHead || node.kind === 'head');
          }
      }
    }
  };
  for (const template of file.templates) {
    checkTitles(template.body.children, false);
  }
  checkTitles(file.children, false);

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
    hideNames,
    scopes,
    bodyScopes,
    anchors,
    anchorScopes,
    contents,
    textContents,
    elementItems,
    symbols,
    childrenRenders,
    blockHolders,
    clientSites,
    diagnostics,
  };
}

/** The first node in the markup that has an anchor, at any depth. */
function firstAnchored(nodes: Markup[], anchors: Map<AnchorTarget, number>): Markup | undefined {
  for (const node of nodes) {
    const found = anchors.has(node) ? node : firstAnchored(childNodes(node), anchors);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/** Returns the markup inside a node, with the bodies of a block. */
function childNodes(node: Markup): Markup[] {
  switch (node.kind) {
    case 'text':
    case 'insert':
    case 'listener':
      return [];
    case 'element':
    case 'component':
    case 'dynamic':
    case 'fragment':
      return node.children;
    default:
      return blockBodies(node).flatMap((body) => body.children);
  }
}

/**
 * True if the body of a `#try` holds a `#loading` block or a component, which can hold one. A
 * body of it that fails after the page is sent renders the `#catch` body in place of the `#try`
 * body, so the block needs its markers.
 */
export function holdsStream(block: Block & { kind: 'try' }): boolean {
  let found = false;
  forEachNode(block.body.children, (node) => {
    found ||= node.kind === 'component' || node.kind === 'dynamic' || node.kind === 'loading';
  });
  return found;
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
    case 'client':
    case 'defer':
      return [block.body, ...(block.fallback ? [block.fallback] : [])];
    case 'try':
      return [block.body, block.fallback];
    default:
      return [block.body];
  }
}

/**
 * The arguments that tell the core which component holds a block in its children: the kind of the
 * scope that renders the component and its anchor. Empty for a block outside children.
 */
export function holderArguments(plan: Plan, block: Block): string {
  const holder = plan.blockHolders.get(block);
  const anchor = holder && plan.anchors.get(holder.node);
  return holder && anchor !== undefined ? `, ${holder.scope.id}, ${anchor}` : '';
}
