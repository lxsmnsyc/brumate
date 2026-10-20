import path from 'node:path';
import { analyze } from './analyze.ts';
import type { Attribute, Markup, SFCFile } from './ast.ts';
import { buildGraph } from './graph.ts';
import type { Graph } from './graph.ts';
import type { Site } from './model.ts';
import { parse } from './parser.ts';

/** A component that a file renders, and the props it passes that can change. */
export interface ComponentUsage {
  /** The import specifier of the component. */
  source: string;
  /** The props whose values can change on the client. `*` means every prop. */
  liveProps: Set<string>;
}

/** Returns the import specifier of a name that the file imports. */
function importSource(file: SFCFile, name: string): string | undefined {
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

/** Visits every markup node of a file, including blocks and templates. */
export function forEachNode(nodes: Markup[], visit: (node: Markup) => void): void {
  for (const node of nodes) {
    visit(node);
    switch (node.kind) {
      case 'element':
      case 'component':
      case 'dynamic':
      case 'fragment':
        forEachNode(node.children, visit);
        break;
      case 'if':
        node.branches.forEach((branch) => forEachNode(branch.body.children, visit));
        forEachNode(node.fallback?.children ?? [], visit);
        break;
      case 'switch':
        node.cases.forEach((branch) => forEachNode(branch.body.children, visit));
        forEachNode(node.fallback?.children ?? [], visit);
        break;
      case 'for':
      case 'repeat':
      case 'loading':
        forEachNode(node.body.children, visit);
        forEachNode(node.fallback?.children ?? [], visit);
        break;
      case 'try':
        forEachNode(node.body.children, visit);
        forEachNode(node.fallback.children, visit);
        break;
      case 'key':
      case 'portal':
      case 'client':
        forEachNode(node.body.children, visit);
        break;
      default:
        break;
    }
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
  const visit = (node: Markup): void => {
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
  return path.posix.join(path.posix.dirname(importer), specifier);
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
  for (const filename of parsed.keys()) {
    result.set(filename, new Map());
  }
  // Each round can only add props, so this ends.
  for (let changed = true; changed;) {
    changed = false;
    for (const [filename, file] of parsed) {
      const liveProps = new Set(result.get(filename)!.keys());
      const graph = buildGraph(analyze(file), { liveProps });
      for (const usage of summarize(file, graph)) {
        const target = resolve(usage.source, filename);
        const props = target === undefined ? undefined : result.get(target);
        if (!props) {
          continue;
        }
        for (const name of usage.liveProps) {
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
