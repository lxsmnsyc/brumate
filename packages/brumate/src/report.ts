// A report of what the client build ships: what every page loads before its
// first event, the code that each event loads, and the most that each route
// can load. A budget fails the build when a size goes over it.

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

/** A handler or `$client` callback of a component, and the parts that it loads. */
export interface ReportEvent {
  /** The `.brm` file, as an absolute path. */
  file: string;
  /** Such as `event button.click (12:5)`. */
  label: string;
  /** The parts that the entry loads for it, its own first. None when the entry holds the code. */
  parts: string[];
}

/** Sizes in bytes, after gzip. */
export interface Budget {
  /** What every page loads before its first event. */
  loader?: number;
  /** The most that a route can load after its first event, with the core. */
  route?: number;
  /** What the first run of one handler loads: the component's entry, its part and the updates it runs, with what they import. */
  event?: number;
  /** The client code of one component. */
  component?: number;
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
  /** Each handler, with what its first run loads besides the loader and the core, largest first. */
  events: { file: string; label: string; bytes: number }[];
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
  /**
   * The handlers of each component. Without them, each part of the build
   * counts as a handler, named after the part.
   */
  events?: ReportEvent[];
  budget?: Budget;
  /** A file as the messages show it. Defaults to the path. */
  relative?: (file: string) => string;
}

/** Measures the client build. */
export function buildReport({
  chunks: list,
  sources,
  routes,
  events: handlers,
  budget,
  relative = (file) => file,
}: ReportInput): BuildReport {
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
  // The chunk of each client module, such as `/app/Counter.brm?brumate-client&part=h0`.
  const byModule = new Map<string, string>();
  const everyPage = new Set([...loaderChunks, ...coreChunks]);
  for (const chunk of list) {
    for (const id of chunk.moduleIds) {
      const file = /^(.*\.brm)\?brumate-client/.exec(id)?.[1];
      if (file) {
        const set = byFile.get(file) ?? new Set<string>();
        withImports(chunk.fileName, chunks, set);
        byFile.set(file, set);
        byModule.set(id, chunk.fileName);
      }
    }
  }
  for (const set of byFile.values()) {
    for (const name of everyPage) {
      set.delete(name);
    }
  }
  const components = [...byFile]
    .map(([file, names]) => ({ file, bytes: sum(names) }))
    .toSorted((a, b) => b.bytes - a.bytes);

  // A handler loads the entry of its component and its parts, with what they import.
  const eventChunks = (event: ReportEvent): Set<string> => {
    const names = new Set<string>();
    const entry = byModule.get(`${event.file}?brumate-client`);
    if (entry) {
      withImports(entry, chunks, names);
    }
    for (const part of event.parts) {
      const chunk = byModule.get(`${event.file}?brumate-client&part=${part}`);
      if (chunk) {
        withImports(chunk, chunks, names);
      }
    }
    for (const name of everyPage) {
      names.delete(name);
    }
    return names;
  };
  const measured = (handlers ?? partEvents(byModule.keys())).map((event) => {
    const names = eventChunks(event);
    return { event, names, bytes: sum(names) };
  });
  const events = measured
    .map(({ event, bytes }) => ({ file: event.file, label: event.label, bytes }))
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
  for (const component of components) {
    if (budget?.component !== undefined && component.bytes > budget.component) {
      overBudget.push(
        `The component ${relative(component.file)} ships ${formatBytes(component.bytes)}, over the budget of ${formatBytes(budget.component)}.`,
      );
    }
  }
  for (const { event, names, bytes } of measured.toSorted((a, b) => b.bytes - a.bytes)) {
    if (budget?.event !== undefined && bytes > budget.event) {
      const imports = largestImports(names, chunks);
      overBudget.push(
        `The handler ${event.label} of ${relative(event.file)} loads ${formatBytes(bytes)}, over the budget of ${formatBytes(budget.event)}.${
          imports.length > 0 ? ` Its largest imports are ${imports.map(relative).join(', ')}.` : ''
        }`,
      );
    }
  }
  return { loader, core: sum(coreChunks), components, routes: routeSizes, events, overBudget };
}

/** Each part of a client module as a handler of its own, when the build does not name them. */
function partEvents(ids: Iterable<string>): ReportEvent[] {
  const result: ReportEvent[] = [];
  for (const id of ids) {
    const match = /^(.*\.brm)\?brumate-client&part=(.+)$/.exec(id);
    if (match && match[2] !== 'update' && match[2] !== 'shared') {
      result.push({ file: match[1]!, label: `part ${match[2]}`, parts: [match[2]!] });
    }
  }
  return result;
}

/** The three largest modules in the chunks that are not client modules of components. */
function largestImports(names: Set<string>, chunks: Map<string, ReportChunk>): string[] {
  const sizes: [string, number][] = [];
  for (const name of names) {
    for (const [id, bytes] of Object.entries(chunks.get(name)?.modules ?? {})) {
      if (!id.includes('?brumate-client')) {
        sizes.push([id.replace(/^\0/, ''), bytes]);
      }
    }
  }
  return sizes
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);
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
  if (report.events.length > 0) {
    lines.push('  What the first run of a handler loads, largest first');
    for (const event of report.events.slice(0, 10)) {
      lines.push(`    ${relative(event.file)} ${event.label}: ${formatBytes(event.bytes)}`);
    }
  }
  return lines.join('\n');
}
