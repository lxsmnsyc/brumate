import { analyze } from './analyze.ts';
import type { Attribute, Markup, SFCFile } from './ast.ts';
import { buildGraph } from './graph.ts';
import type { Graph } from './graph.ts';
import type { SemanticModel, Site } from './model.ts';
import { parse } from './parser.ts';

/** A component that a file renders, and the props it passes that can change. */
export interface ComponentUsage {
  /** The import specifier of the component. */
  source: string;
  /** The props whose values can change on the client. `*` means every prop. */
  liveProps: Set<string>;
  /** True for a dynamic tag, which can name the component. Only a component that declares the prop takes it. */
  dynamic?: boolean;
}

/** True if a component declares a prop by name, or takes the rest or the whole props object. */
function declaresProp(model: SemanticModel, name: string): boolean {
  for (const declaration of model.declarations) {
    if (
      declaration.kind === 'props-rest' ||
      (declaration.kind === 'prop' &&
        (declaration.propKey === undefined || declaration.propKey === name))
    ) {
      return true;
    }
  }
  return false;
}

/** Returns the import specifier of a name that the file imports. */
export function importSource(file: SFCFile, name: string): string | undefined {
  const programs = [file.moduleScript?.program, file.instanceScript?.program];
  for (const program of programs) {
    for (const statement of program?.body ?? []) {
      if (statement.type !== 'ImportDeclaration') {
        continue;
      }
      if (statement.specifiers.some((specifier) => specifier.local.name === name)) {
        return statement.source.value;
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

/** The markup inside a node: the children of an element, or the bodies of a block. */
export function childrenOf(node: Markup): Markup[] {
  switch (node.kind) {
    case 'element':
    case 'component':
    case 'dynamic':
    case 'fragment':
      return node.children;
    case 'if':
      return [
        ...node.branches.flatMap((branch) => branch.body.children),
        ...(node.fallback?.children ?? []),
      ];
    case 'switch':
      return [
        ...node.cases.flatMap((branch) => branch.body.children),
        ...(node.fallback?.children ?? []),
      ];
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
    forEachNode(childrenOf(node), visit);
  }
}

/** Lists the components that a file renders, and the props it passes that can change. */
export function summarize(file: SFCFile, graph: Graph): ComponentUsage[] {
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
  const isLive = (expression: { ast: object }): boolean => {
    const site = sites.get(expression.ast);
    return site !== undefined && live.has(site);
  };
  const liveProp = (attribute: Attribute): string | undefined => {
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
  const visit = (node: Markup): void => {
    if (node.kind === 'dynamic') {
      // The props of a dynamic tag reach the component that it names, so each component that the
      // file reads as a value gets the props that can change.
      const liveProps = new Set<string>();
      for (const attribute of node.attributes) {
        const name = attribute.kind === 'value' ? liveProp(attribute) : undefined;
        if (name) {
          liveProps.add(name);
        }
      }
      if (liveProps.size > 0) {
        for (const source of valueSources) {
          usages.push({ source, liveProps, dynamic: true });
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
    for (const attribute of node.attributes) {
      const name = liveProp(attribute);
      if (name) {
        liveProps.add(name);
      }
    }
    usages.push({ source, liveProps });
  };
  forEachNode(file.children, visit);
  for (const template of file.templates) {
    forEachNode(template.body.children, visit);
  }
  return usages;
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
  const parsed = new Map<string, SFCFile>();
  for (const [filename, source] of files) {
    try {
      parsed.set(filename, parse(source, { filename }));
    } catch {
      // The compile of this file reports the error.
    }
  }
  const result: ProjectProps = new Map();
  const models = new Map<string, SemanticModel>();
  for (const [filename, file] of parsed) {
    result.set(filename, new Map());
    models.set(filename, analyze(file));
  }
  // Each round can only add props, so this ends.
  for (let changed = true; changed;) {
    changed = false;
    for (const [filename, file] of parsed) {
      const liveProps = new Set(result.get(filename)!.keys());
      const graph = buildGraph(models.get(filename)!, { liveProps });
      for (const usage of summarize(file, graph)) {
        const target = resolve(usage.source, filename);
        const props = target === undefined ? undefined : result.get(target);
        if (!props) {
          continue;
        }
        for (const name of usage.liveProps) {
          if (usage.dynamic && !declaresProp(models.get(target!)!, name)) {
            continue;
          }
          const parents = props.get(name) ?? new Set<string>();
          if (!props.has(name)) {
            props.set(name, parents);
            changed = true;
          }
          parents.add(filename);
        }
      }
    }
  }
  return result;
}

/** Finds the props that can change on the client, for every file of a project. */
export function analyzeProject(
  files: Map<string, string>,
  resolve: Resolve = resolveRelative,
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const [filename, props] of analyzeProjectProps(files, resolve)) {
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
