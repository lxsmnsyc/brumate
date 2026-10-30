// A report of what the client build ships: what every page loads, the code of
// each component, and what each route loads. A budget fails the build when a
// size goes over it.

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
  /** The size of each module in the chunk, before minifying and gzip. */
  modules?: Record<string, number>;
}

/** Sizes in bytes, after gzip. */
export interface Budget {
  /** The loader, which every page loads. */
  loader?: number;
  /** What a route loads, with the core. */
  route?: number;
  /** The client code of one component. */
  component?: number;
}

export interface BuildReport {
  /** The entry and its imports, which every page loads. */
  loader: number;
  /** The runtime, which every page loads when it starts. */
  core: number;
  /**
   * Each component, with the size of its client code, largest first. A chunk that holds several
   * components, such as the bundle of a page, counts for each by the size of its modules.
   */
  components: { file: string; bytes: number }[];
  /** Each route path, with what it loads besides the loader, largest first. */
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
  /** A file as the messages show it. Defaults to the path. */
  relative?: (file: string) => string;
}

/** Measures the client build. */
export function buildReport({
  chunks: list,
  sources,
  routes,
  budget,
  relative = (file) => file,
}: ReportInput): BuildReport {
  const chunks = new Map<string, (typeof list)[number]>();
  const sizes = new Map<string, number>();
  for (const chunk of list) {
    chunks.set(chunk.fileName, chunk);
    sizes.set(chunk.fileName, gzipSize(chunk.code));
  }
  function sum(names: Iterable<string>): number {
    let total = 0;
    for (const name of names) {
      total += sizes.get(name) ?? 0;
    }
    return total;
  }

  const loaderChunks = new Set<string>();
  for (const chunk of list) {
    if (chunk.isEntry) {
      withImports(chunk.fileName, chunks, loaderChunks);
    }
  }
  let coreChunk: (typeof list)[number] | undefined;
  for (const chunk of list) {
    let isCore = false;
    for (const id of chunk.moduleIds) {
      if (/[\\/]runtime[\\/]client\.[jt]s$/.test(id)) {
        isCore = true;
        break;
      }
    }
    if (isCore) {
      coreChunk = chunk;
      break;
    }
  }
  const coreChunks = coreChunk ? withImports(coreChunk.fileName, chunks) : new Set<string>();
  for (const name of loaderChunks) {
    coreChunks.delete(name);
  }

  // The chunks of each component: those that hold its entry and its parts, with what they
  // import. Its size is its share of each chunk that holds its modules.
  const byFile = new Map<string, Set<string>>();
  const shares = new Map<string, number>();
  const everyPage = new Set([...loaderChunks, ...coreChunks]);
  for (const chunk of list) {
    const owned = new Map<string, number>();
    for (const id of chunk.moduleIds) {
      const file = /^(.*\.brm)\?brumate-client/.exec(id)?.[1];
      if (file) {
        const set = byFile.get(file) ?? new Set<string>();
        withImports(chunk.fileName, chunks, set);
        byFile.set(file, set);
        owned.set(file, (owned.get(file) ?? 0) + (chunk.modules?.[id] ?? 1));
      }
    }
    let total = chunk.moduleIds.length;
    if (chunk.modules) {
      total = 0;
      for (const bytes of Object.values(chunk.modules)) {
        total += bytes;
      }
    }
    for (const [file, bytes] of owned) {
      const share = total > 0 ? ((sizes.get(chunk.fileName) ?? 0) * bytes) / total : 0;
      shares.set(file, (shares.get(file) ?? 0) + share);
    }
  }
  for (const set of byFile.values()) {
    for (const name of everyPage) {
      set.delete(name);
    }
  }
  const components: { file: string; bytes: number }[] = [];
  for (const [file, bytes] of shares) {
    components.push({ file, bytes: Math.round(bytes) });
  }
  components.sort((a, b) => b.bytes - a.bytes);

  // A route can load the code of its page, its layouts, and the components that they render.
  function reachable(files: string[]): Set<string> {
    const seen = new Set<string>();
    function visit(file: string): void {
      if (!seen.has(file)) {
        seen.add(file);
        for (const imported of componentImports(file, sources.get(file) ?? '')) {
          visit(imported);
        }
      }
    }
    for (const file of files) {
      visit(file);
    }
    return seen;
  }
  const routeSizes: { path: string; bytes: number; components: number }[] = [];
  for (const { path, files } of routes ? routeEntries(routes.tree, routes.resolve) : []) {
    const reached = reachable(files);
    const names = new Set(coreChunks);
    for (const file of reached) {
      for (const name of byFile.get(file) ?? []) {
        names.add(name);
      }
    }
    routeSizes.push({ path, bytes: sum(names), components: reached.size });
  }
  routeSizes.sort((a, b) => b.bytes - a.bytes);

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
  for (const component of components) {
    if (budget?.component !== undefined && component.bytes > budget.component) {
      overBudget.push(
        `The component ${relative(component.file)} ships ${formatBytes(component.bytes)}, over the budget of ${formatBytes(budget.component)}.`,
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
    `  The loader, on every page: ${formatBytes(report.loader)}`,
    `  The core, when the page starts: ${formatBytes(report.core)}`,
  ];
  if (report.routes.length > 0) {
    lines.push('  What each route loads when it starts, with the core');
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
