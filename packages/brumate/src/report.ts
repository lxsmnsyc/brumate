// A report of what the client build ships: what every page loads before its
// first event, the code that events load, and the most that each route can
// load. A budget fails the build when a size goes over it.

import { builtin } from './node.ts';
import { parse } from './parser.ts';
import { resolveRelative } from './project.ts';
import type { RouteFiles } from './routes.ts';

/** A chunk of the client build, as the bundler writes it. */
export interface ReportChunk {
  fileName: string;
  code: string;
  isEntry: boolean;
  /** Chunks that this chunk imports statically. */
  imports: string[];
  /** The modules in the chunk. */
  moduleIds: string[];
}

/** Sizes in bytes, after gzip. */
export interface Budget {
  /** What every page loads before its first event. */
  loader?: number;
  /** The most that a route can load after its first event, with the core. */
  route?: number;
}

export interface BuildReport {
  /** The entry and its imports, which every page loads. */
  loader: number;
  /** The runtime that the first event loads. */
  core: number;
  /** Each component, with the size of its client code, largest first. */
  components: { file: string; bytes: number }[];
  /** Each route path, with the most it can load after its first event, largest first. */
  routes: { path: string; bytes: number; components: number }[];
  /** The sizes that go over the budget, as sentences. */
  overBudget: string[];
}

/** The size of a chunk after gzip. Outside Node, the size before it. */
function gzipSize(code: string): number {
  const zlib = builtin('node:zlib');
  return zlib ? zlib.gzipSync(code).length : code.length;
}

/** The chunk and every chunk that it imports statically. */
function withImports(
  name: string,
  chunks: Map<string, ReportChunk>,
  into = new Set<string>(),
): Set<string> {
  if (!into.has(name) && chunks.has(name)) {
    into.add(name);
    for (const imported of chunks.get(name)!.imports) {
      withImports(imported, chunks, into);
    }
  }
  return into;
}

/** The files of the components that a `.brm` file imports. */
function componentImports(file: string, source: string): string[] {
  let parsed;
  try {
    parsed = parse(source, { filename: file });
  } catch {
    return [];
  }
  const result: string[] = [];
  for (const script of [parsed.moduleScript, parsed.instanceScript]) {
    for (const statement of script?.program.body ?? []) {
      if (statement.type === 'ImportDeclaration') {
        const target = resolveRelative(statement.source.value, file);
        if (target) {
          result.push(target);
        }
      }
    }
  }
  return result;
}

/** Each page path, with its page and the layouts around it. */
function routeEntries(
  node: RouteFiles,
  resolve: (file: string) => string,
  path = '',
  layouts: string[] = [],
): { path: string; files: string[] }[] {
  const around = node.layout ? [...layouts, resolve(node.layout)] : layouts;
  const result = node.page ? [{ path: path || '/', files: [...around, resolve(node.page)] }] : [];
  for (const [segment, folder] of Object.entries(node.static ?? {})) {
    result.push(...routeEntries(folder, resolve, `${path}/${segment}`, around));
  }
  if (node.dynamic) {
    result.push(
      ...routeEntries(node.dynamic.node, resolve, `${path}/[${node.dynamic.name}]`, around),
    );
  }
  if (node.rest) {
    result.push(...routeEntries(node.rest.node, resolve, `${path}/[...${node.rest.name}]`, around));
  }
  return result;
}

export interface ReportInput {
  chunks: ReportChunk[];
  /** The source of each `.brm` file, by absolute path. */
  sources: Map<string, string>;
  /** The route files, and the absolute path of a file in them. */
  routes?: { tree: RouteFiles; resolve: (file: string) => string };
  budget?: Budget;
}

/** Measures the client build. */
export function buildReport({ chunks: list, sources, routes, budget }: ReportInput): BuildReport {
  const chunks = new Map(list.map((chunk) => [chunk.fileName, chunk]));
  const sizes = new Map(list.map((chunk) => [chunk.fileName, gzipSize(chunk.code)]));
  const sum = (names: Iterable<string>): number => {
    let total = 0;
    for (const name of names) {
      total += sizes.get(name) ?? 0;
    }
    return total;
  };

  const loaderChunks = new Set<string>();
  for (const chunk of list) {
    if (chunk.isEntry) {
      withImports(chunk.fileName, chunks, loaderChunks);
    }
  }
  const coreChunk = list.find((chunk) =>
    chunk.moduleIds.some((id) => /[\\/]runtime[\\/]client\.[jt]s$/.test(id)),
  );
  const coreChunks = coreChunk ? withImports(coreChunk.fileName, chunks) : new Set<string>();
  for (const name of loaderChunks) {
    coreChunks.delete(name);
  }

  // The chunks of each component: its entry and its parts, with what they import.
  const byFile = new Map<string, Set<string>>();
  for (const chunk of list) {
    for (const id of chunk.moduleIds) {
      const file = /^(.*\.brm)\?brumate-client/.exec(id)?.[1];
      if (file) {
        const set = byFile.get(file) ?? new Set<string>();
        withImports(chunk.fileName, chunks, set);
        byFile.set(file, set);
      }
    }
  }
  for (const set of byFile.values()) {
    for (const name of [...loaderChunks, ...coreChunks]) {
      set.delete(name);
    }
  }
  const components = [...byFile]
    .map(([file, names]) => ({ file, bytes: sum(names) }))
    .toSorted((a, b) => b.bytes - a.bytes);

  // A route can load the code of its page, its layouts, and the components that they render.
  const reachable = (files: string[]): Set<string> => {
    const seen = new Set<string>();
    const visit = (file: string): void => {
      if (!seen.has(file)) {
        seen.add(file);
        for (const imported of componentImports(file, sources.get(file) ?? '')) {
          visit(imported);
        }
      }
    };
    files.forEach(visit);
    return seen;
  };
  const routeSizes = (routes ? routeEntries(routes.tree, routes.resolve) : [])
    .map(({ path, files }) => {
      const reached = reachable(files);
      const names = new Set(coreChunks);
      for (const file of reached) {
        for (const name of byFile.get(file) ?? []) {
          names.add(name);
        }
      }
      return { path, bytes: sum(names), components: reached.size };
    })
    .toSorted((a, b) => b.bytes - a.bytes);

  const loader = sum(loaderChunks);
  const overBudget: string[] = [];
  if (budget?.loader !== undefined && loader > budget.loader) {
    overBudget.push(
      `The loader is ${formatBytes(loader)}, over the budget of ${formatBytes(budget.loader)}.`,
    );
  }
  for (const route of routeSizes) {
    if (budget?.route !== undefined && route.bytes > budget.route) {
      overBudget.push(
        `The route ${route.path} can load ${formatBytes(route.bytes)}, over the budget of ${formatBytes(budget.route)}.`,
      );
    }
  }
  return { loader, core: sum(coreChunks), components, routes: routeSizes, overBudget };
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
}

/** The report as text, with paths relative to `root`. */
export function formatBuildReport(report: BuildReport, relative: (file: string) => string): string {
  const lines = [
    'brumate client report (gzip)',
    `  Every page, before its first event: ${formatBytes(report.loader)}`,
    `  The core, on the first event: ${formatBytes(report.core)}`,
  ];
  if (report.routes.length > 0) {
    lines.push('  The most each route loads after its first event, with the core');
    for (const route of report.routes) {
      lines.push(`    ${route.path}: ${formatBytes(route.bytes)} (${route.components} components)`);
    }
  }
  if (report.components.length > 0) {
    lines.push('  Components, largest first');
    for (const component of report.components) {
      lines.push(`    ${relative(component.file)}: ${formatBytes(component.bytes)}`);
    }
  }
  return lines.join('\n');
}
