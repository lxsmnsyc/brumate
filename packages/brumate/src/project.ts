import { analyze, contextName } from './analyze.ts';
import type { Attribute, Body, Markup, SFCFile } from './ast.ts';
import { forEachNode, getChildren } from './ast.ts';
import { buildGraph } from './graph.ts';
import type { Graph } from './graph.ts';
import type { SemanticModel, Site } from './model.ts';
import type { oxc } from './oxc.ts';
import { parse } from './parser.ts';

export { forEachNode, getChildren } from './ast.ts';

/** A component that a file renders, and the props it passes that can change. */
export interface ComponentUsage {
  /** The import specifier of the component. */
  source: string;
  /** The props whose values can change on the client. `*` means every prop. */
  liveProps: Set<string>;
  /** True for a dynamic tag, which can name the component. Only a component that declares the prop takes it. */
  dynamic?: boolean;
  /**
   * The props whose value names `.brm` imports, such as `as=Target` or `as=(flag ? A : B)`: the
   * prop name and the import specifiers.
   */
  components?: Map<string, string[]>;
  /**
   * The props whose value is a prop of this file, such as `{as}`: the prop name and the names of
   * this file's props. `*` means the whole props object.
   */
  passed?: Map<string, string[]>;
  /** True if the browser may render the component: it is in a block or a template that the browser creates. */
  inCreated?: boolean;
  /** The import specifier of the component whose children hold this one, if any. */
  host?: string;
}

/** A dynamic tag of a file, with the props that name its tag and the props that can change. */
export interface DynamicTagUsage {
  /** The props that the tag expression reads. `*` means the whole props object. */
  tagProps: Set<string>;
  liveProps: Set<string>;
}

/** True if a component declares a prop by name, or takes the rest or the whole props object. */
function declaresProp(model: SemanticModel, name: string): boolean {
  for (const declaration of model.declarations) {
    if (
      declaration.kind === 'props-rest' ||
      (declaration.kind === 'prop' &&
        (declaration.propKey === undefined || declaration.propKey === name || name === '~'))
    ) {
      return true;
    }
  }
  return false;
}

/** The names a value can be: the identifiers of an expression and of the branches of a condition. */
function valueNames(node: oxc.Expression, names: string[] = []): string[] {
  switch (node.type) {
    case 'Identifier':
      names.push(node.name);
      break;
    case 'ConditionalExpression':
      valueNames(node.consequent, names);
      valueNames(node.alternate, names);
      break;
    case 'LogicalExpression':
      // The right side of `&&` is the value. Its left side is a condition.
      if (node.operator !== '&&') {
        valueNames(node.left, names);
      }
      valueNames(node.right, names);
      break;
    case 'ParenthesizedExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
      valueNames(node.expression, names);
      break;
    default:
      break;
  }
  return names;
}

/** Returns the import specifier of a name that the file imports. */
export function importSource(file: SFCFile, name: string): string | undefined {
  const programs = [file.moduleScript?.program, file.instanceScript?.program];
  for (const program of programs) {
    for (const statement of program?.body ?? []) {
      if (statement.type !== 'ImportDeclaration') {
        continue;
      }
      for (const specifier of statement.specifiers) {
        if (specifier.local.name === name) {
          return statement.source.value;
        }
      }
    }
  }
  return undefined;
}

/** The import specifiers of the `.brm` files that a file imports. */
export function importedComponents(file: SFCFile): string[] {
  const specifiers: string[] = [];
  for (const program of [file.moduleScript?.program, file.instanceScript?.program]) {
    for (const statement of program?.body ?? []) {
      if (statement.type === 'ImportDeclaration' && statement.source.value.endsWith('.brm')) {
        specifiers.push(statement.source.value);
      }
    }
  }
  return specifiers;
}

/**
 * The live prop that a dynamic tag gives to the component it names. A spread or a computed name
 * can hold any prop, but `children` come from the body of the tag, so they are left out: `~`.
 */
function tagProp(name: string | undefined): string | undefined {
  return name === '*' ? '~' : name;
}

/** Returns a function that names the prop of an attribute when its value can change. */
function liveChecker(graph: Graph): (attribute: Attribute) => string | undefined {
  const live = new Set<Site>();
  for (const node of graph.nodes) {
    if (node.kind !== 'source' && graph.live.has(node)) {
      live.add(node.site);
    }
  }
  const sites = new Map<object, Site>();
  for (const site of graph.model.sites) {
    sites.set(site.node, site);
  }
  function isLive(expression: { ast: object }): boolean {
    const site = sites.get(expression.ast);
    return site !== undefined && live.has(site);
  }
  return (attribute) => {
    switch (attribute.kind) {
      case 'value':
        return isLive(attribute.value) ? attribute.name : undefined;
      case 'event':
        return isLive(attribute.handler) ? attribute.name : undefined;
      case 'spread':
        return isLive(attribute.value) ? '*' : undefined;
      case 'computed':
        return isLive(attribute.name) || (attribute.value !== true && isLive(attribute.value))
          ? '*'
          : undefined;
      default:
        return undefined;
    }
  };
}

/** Lists the dynamic tags of a file that have props that can change. */
export function dynamicTags(file: SFCFile, graph: Graph): DynamicTagUsage[] {
  const liveProp = liveChecker(graph);
  const tags: DynamicTagUsage[] = [];
  function visit(node: Markup): void {
    if (node.kind !== 'dynamic') {
      return;
    }
    const liveProps = new Set<string>();
    for (const attribute of node.attributes) {
      const name = tagProp(liveProp(attribute));
      if (name) {
        liveProps.add(name);
      }
    }
    if (liveProps.size === 0) {
      return;
    }
    const tagProps = new Set<string>();
    for (const site of graph.model.sites) {
      if (site.node !== node.tag.ast) {
        continue;
      }
      for (const read of site.reads) {
        const declaration = read.declaration;
        if (declaration.kind === 'props-rest') {
          tagProps.add('*');
        } else if (declaration.kind === 'prop') {
          tagProps.add(declaration.propKey ?? '*');
        }
      }
    }
    if (tagProps.size > 0) {
      tags.push({ tagProps, liveProps });
    }
  }
  forEachNode(file.children, visit);
  for (const template of file.templates) {
    forEachNode(template.body.children, visit);
  }
  return tags;
}

/** Adds a value to the list under a key. */
function append(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list) {
    list.push(value);
  } else {
    map.set(key, [value]);
  }
}

/** Lists the components that a file renders, and the props it passes that can change. */
export function summarize(file: SFCFile, graph: Graph): ComponentUsage[] {
  const liveProp = liveChecker(graph);

  const usages: ComponentUsage[] = [];
  // The components that the file reads as values. A dynamic tag can name any of them.
  const valueSources: string[] = [];
  for (const declaration of graph.model.declarations) {
    if (
      declaration.kind === 'import' &&
      declaration.imported?.source.endsWith('.brm') &&
      declaration.reads.length > 0
    ) {
      valueSources.push(declaration.imported.source);
    }
  }
  function visit(node: Markup, inCreated: boolean, host: string | undefined): void {
    if (node.kind === 'dynamic') {
      // The props of a dynamic tag reach the component that it names, so each component that the
      // file reads as a value gets the props that can change.
      const liveProps = new Set<string>();
      for (const attribute of node.attributes) {
        const name = tagProp(liveProp(attribute));
        if (name) {
          liveProps.add(name);
        }
      }
      if (liveProps.size > 0 || inCreated) {
        for (const source of valueSources) {
          usages.push({ source, liveProps, dynamic: true, inCreated, host });
        }
      }
      return;
    }
    if (node.kind !== 'component') {
      return;
    }
    const source = importSource(file, node.name.split('.')[0]!);
    if (!source) {
      return;
    }
    const liveProps = new Set<string>();
    const components = new Map<string, string[]>();
    const passed = new Map<string, string[]>();
    for (const attribute of node.attributes) {
      const name = liveProp(attribute);
      if (name) {
        liveProps.add(name);
      }
      if (attribute.kind !== 'value') {
        continue;
      }
      for (const local of valueNames(attribute.value.ast)) {
        const named = importSource(file, local);
        if (named?.endsWith('.brm')) {
          append(components, attribute.name, named);
          continue;
        }
        for (const declaration of graph.model.declarations) {
          if (declaration.kind === 'prop' && declaration.name === local) {
            append(passed, attribute.name, declaration.propKey ?? '*');
          }
        }
      }
    }
    usages.push({ source, liveProps, components, passed, inCreated, host });
  }
  // The bodies that the browser creates, and the markup of the file with its place in them.
  const createdBodies = new Set<Body>();
  for (const scope of graph.created) {
    if (scope.body) {
      createdBodies.add(scope.body);
    }
    if (scope.template) {
      createdBodies.add(scope.template.body);
    }
  }
  function walk(nodes: Markup[], inCreated: boolean, host: string | undefined): void {
    for (const node of nodes) {
      visit(node, inCreated, host);
      let inner = host;
      if (node.kind === 'component') {
        inner = importSource(file, node.name.split('.')[0]!) ?? host;
      }
      const bodies = childBodies(node);
      if (bodies.length === 0) {
        walk(getChildren(node), inCreated, inner);
      }
      for (const body of bodies) {
        walk(body.children, inCreated || createdBodies.has(body), inner);
      }
    }
  }
  walk(file.children, false, undefined);
  for (const template of file.templates) {
    walk(template.body.children, createdBodies.has(template.body), undefined);
  }
  return usages;
}

/** The bodies of a block. Other nodes have none. */
function childBodies(node: Markup): Body[] {
  switch (node.kind) {
    case 'if': {
      const bodies = node.branches.map((branch) => branch.body);
      return node.fallback ? [...bodies, node.fallback] : bodies;
    }
    case 'switch': {
      const bodies = node.cases.map((branch) => branch.body);
      return node.fallback ? [...bodies, node.fallback] : bodies;
    }
    case 'for':
    case 'repeat':
    case 'loading':
    case 'client':
    case 'defer':
      return node.fallback ? [node.body, node.fallback] : [node.body];
    case 'try':
      return [node.body, node.fallback];
    case 'key':
    case 'portal':
    case 'head':
    case 'offscreen':
      return [node.body];
    default:
      return [];
  }
}

/** Resolves an import specifier of a file to a project file, or undefined if it is not one. */
export type Resolve = (specifier: string, importer: string) => string | undefined;

/** Resolves relative imports of `.brm` files. */
export function resolveRelative(specifier: string, importer: string): string | undefined {
  if (!specifier.startsWith('.') || !specifier.endsWith('.brm')) {
    return undefined;
  }
  return joinPosix(importer.slice(0, Math.max(0, importer.lastIndexOf('/'))), specifier);
}

/** For each file, each prop that can change, and the files that change it. */
export type ProjectProps = Map<string, Map<string, Set<string>>>;

/**
 * Finds the props that can change on the client, and the parents that
 * change them, for every file of a project. Props start out unchanged,
 * because code outside `.brm` files renders components only on the server.
 * A prop can change when a parent passes it a value that can change. Files
 * with errors are skipped.
 */
export function analyzeProjectProps(
  files: Map<string, string>,
  resolve: Resolve = resolveRelative,
): ProjectProps {
  return analyzeProjectAll(files, resolve).props;
}

/** What the whole project says about the client. */
export interface ProjectAnalysis {
  props: ProjectProps;
  /**
   * The names of the contexts that the browser may need: a provider sets one from a value that
   * changes, from a function, or in code that the browser runs, or code that the browser runs
   * reads it. `*` means every context. A context that is not here has the same value for
   * everyone who reads it, and only the server reads it.
   */
  contexts: Set<string>;
}

/**
 * Finds the props that can change on the client and the contexts that the browser may need, for
 * every file of a project. Both depend on each other, so they are found together.
 */
export function analyzeProjectAll(
  files: Map<string, string>,
  resolve: Resolve = resolveRelative,
): ProjectAnalysis {
  const parsed = new Map<string, SFCFile>();
  for (const [filename, source] of files) {
    try {
      parsed.set(filename, parse(source, { filename }));
    } catch {
      // The compile of this file reports the error.
    }
  }
  const result: ProjectProps = new Map();
  // For each file and prop, the files of the components that parents give to it, such as `as=Target`.
  const given = new Map<string, Map<string, Set<string>>>();
  const models = new Map<string, SemanticModel>();
  const liveContexts = new Set<string>();
  // The files that the browser may render, and the files with a block or a template that it creates.
  const browserFiles = new Set<string>();
  const createdFiles = new Set<string>();
  for (const [filename, file] of parsed) {
    result.set(filename, new Map());
    models.set(filename, analyze(file));
  }
  // Each round can only add props, so this ends.
  for (let changed = true; changed;) {
    changed = false;
    // The dynamic tags of a file, with the props that can change in this round.
    const tagsOf = new Map<string, DynamicTagUsage[]>();
    function tagsFor(filename: string): DynamicTagUsage[] {
      let tags = tagsOf.get(filename);
      if (!tags) {
        const liveProps = new Set(result.get(filename)!.keys());
        const graph = buildGraph(models.get(filename)!, { liveProps, liveContexts });
        tags = dynamicTags(parsed.get(filename)!, graph);
        tagsOf.set(filename, tags);
      }
      return tags;
    }
    function add(target: string, name: string, parent: string): void {
      const props = result.get(target)!;
      const parents = props.get(name) ?? new Set<string>();
      if (!props.has(name)) {
        props.set(name, parents);
        changed = true;
      }
      parents.add(parent);
    }
    function give(target: string, prop: string, components: Iterable<string>): void {
      let props = given.get(target);
      if (!props) {
        props = new Map();
        given.set(target, props);
      }
      let set = props.get(prop);
      if (!set) {
        set = new Set();
        props.set(prop, set);
      }
      for (const component of components) {
        if (!set.has(component)) {
          set.add(component);
          changed = true;
        }
      }
    }
    function mark(set: Set<string>, value: string): void {
      if (!set.has(value)) {
        set.add(value);
        changed = true;
      }
    }
    for (const [filename, file] of parsed) {
      const liveProps = new Set(result.get(filename)!.keys());
      const model = models.get(filename)!;
      const graph = buildGraph(model, { liveProps, liveContexts });
      if (graph.created.size > 0) {
        mark(createdFiles, filename);
      }
      collectContexts(model, graph, browserFiles.has(filename), (name) => mark(liveContexts, name));
      for (const usage of summarize(file, graph)) {
        const target = resolve(usage.source, filename);
        const props = target === undefined ? undefined : result.get(target);
        if (!props) {
          continue;
        }
        // The browser renders the component when it renders the markup around it, or a component
        // that has it in its children renders them in a block that the browser creates.
        const host = usage.host === undefined ? undefined : resolve(usage.host, filename);
        const browser =
          usage.inCreated === true ||
          browserFiles.has(filename) ||
          (host !== undefined && (browserFiles.has(host) || createdFiles.has(host)));
        if (browser) {
          mark(browserFiles, target!);
        }
        if (browser || createdFiles.has(target!) || browserFiles.has(target!)) {
          for (const specifiers of usage.components?.values() ?? []) {
            for (const specifier of specifiers) {
              const named = resolve(specifier, filename);
              if (named !== undefined && result.has(named)) {
                mark(browserFiles, named);
              }
            }
          }
        }
        for (const name of usage.liveProps) {
          if (usage.dynamic && !declaresProp(models.get(target!)!, name)) {
            continue;
          }
          add(target!, name, filename);
        }
        // A page that gives a component to a prop, such as `as=Target`, or a part that passes on
        // the component it was given, such as `{as}`, sends the live props of the dynamic tags
        // that read that prop to the component.
        for (const [prop, specifiers] of usage.components ?? []) {
          for (const specifier of specifiers) {
            const named = resolve(specifier, filename);
            if (named !== undefined && result.has(named)) {
              give(target!, prop, [named]);
            }
          }
        }
        const received = given.get(filename);
        for (const [prop, names] of usage.passed ?? []) {
          for (const name of names) {
            for (const [key, components] of received ?? []) {
              if (name === '*' || name === key) {
                give(target!, prop, components);
              }
            }
          }
        }
      }
    }
    for (const [target, props] of given) {
      for (const tag of tagsFor(target)) {
        for (const [prop, components] of props) {
          if (!tag.tagProps.has(prop) && !tag.tagProps.has('*')) {
            continue;
          }
          for (const named of components) {
            for (const name of tag.liveProps) {
              if (declaresProp(models.get(named)!, name)) {
                add(named, name, target);
              }
            }
          }
        }
      }
    }
  }
  return { props: result, contexts: liveContexts };
}

/**
 * Names the contexts of a file that the browser may need. A provider counts when its value is
 * live, holds a function, or is set where the browser runs the code; a reader counts when the
 * browser runs the code that reads it. A name that is not a plain name counts as every context.
 */
function collectContexts(
  model: SemanticModel,
  graph: Graph,
  inBrowser: boolean,
  add: (name: string) => void,
): void {
  const live = new Set<Site>();
  for (const node of graph.nodes) {
    if (node.kind !== 'source' && graph.live.has(node)) {
      live.add(node.site);
    }
  }
  for (const site of model.sites) {
    if (site.kind !== 'provide') {
      continue;
    }
    const name = contextName(site.extra![0], site.scope);
    // Which context this sets is not known, so any reader may get its value.
    let needed = name === undefined || inBrowser || live.has(site) || graph.created.has(site.scope);
    for (const other of model.sites) {
      // A function in the value runs in the browser, where a reader calls it.
      if (
        other.kind === 'prop' &&
        other.node.start >= site.node.start &&
        other.node.end <= site.node.end
      ) {
        needed = true;
      }
    }
    if (needed) {
      add(name ?? '*');
    }
  }
  for (const declaration of model.declarations) {
    if (
      declaration.kind === 'context' &&
      declaration.contextKey !== undefined &&
      (inBrowser || graph.created.has(declaration.scope))
    ) {
      add(declaration.contextKey);
    }
  }
}

/** Finds the props that can change on the client, for every file of a project. */
export function analyzeProject(
  files: Map<string, string>,
  resolve: Resolve = resolveRelative,
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const [filename, props] of analyzeProjectAll(files, resolve).props) {
    result.set(filename, new Set(props.keys()));
  }
  return result;
}

/** Joins a directory and a relative path with `/`, resolving `.` and `..`. */
function joinPosix(directory: string, specifier: string): string {
  const parts: string[] = [];
  for (const part of `${directory}/${specifier}`.split('/')) {
    if (part === '..') {
      parts.pop();
    } else if (part && part !== '.') {
      parts.push(part);
    }
  }
  return (directory.startsWith('/') ? '/' : '') + parts.join('/');
}
