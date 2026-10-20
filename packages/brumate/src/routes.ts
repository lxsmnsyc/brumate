// Builds the route tree of `virtual:brumate/routes` from the files of a routes directory.

/** A folder of routes, with the files as paths. The runtime `RouteNode` has loaders instead. */
export interface RouteFiles {
  layout?: string;
  page?: string;
  fallback?: string;
  static?: Record<string, RouteFiles>;
  dynamic?: { name: string; node: RouteFiles };
  rest?: { name: string; node: RouteFiles };
  slots?: Record<string, RouteFiles>;
}

const DYNAMIC = /^\[([A-Za-z_$][\w$]*)\]$/;
const REST = /^\[\.\.\.([A-Za-z_$][\w$]*)\]$/;

/** Returns the folder for a path segment, made if missing. */
function child(node: RouteFiles, segment: string): RouteFiles {
  if (segment.startsWith('@')) {
    node.slots ??= {};
    return (node.slots[segment.slice(1)] ??= {});
  }
  const rest = REST.exec(segment);
  if (rest) {
    node.rest ??= { name: rest[1]!, node: {} };
    return node.rest.node;
  }
  const dynamic = DYNAMIC.exec(segment);
  if (dynamic) {
    if (node.dynamic && node.dynamic.name !== dynamic[1]) {
      throw new Error(`Two dynamic segments in one folder: [${node.dynamic.name}] and ${segment}`);
    }
    node.dynamic ??= { name: dynamic[1]!, node: {} };
    return node.dynamic.node;
  }
  node.static ??= {};
  return (node.static[segment] ??= {});
}

/**
 * Builds the route tree from `.brm` paths relative to the routes directory,
 * such as `todos/[id].brm`. `_layout.brm`, `_default.brm` and `index.brm`
 * belong to their folder. Other files starting with `_` are not routes.
 */
export function routeFiles(paths: string[]): RouteFiles {
  const tree: RouteFiles = {};
  for (const file of paths) {
    const segments = file.replace(/\.brm$/, '').split('/');
    const name = segments.pop()!;
    let node = tree;
    for (const segment of segments) {
      node = child(node, segment);
    }
    if (name === '_layout') {
      node.layout = file;
    } else if (name === '_default') {
      node.fallback = file;
    } else if (name === 'index') {
      node.page = file;
    } else if (!name.startsWith('_')) {
      child(node, name).page = file;
    }
  }
  return tree;
}

/**
 * Writes a route tree as module code, with an import for each file. `rpc`
 * is the URL prefix of server function calls, for forms that post to one.
 */
export function routeModule(
  tree: RouteFiles,
  resolve: (file: string) => string,
  rpc = '/_brumate',
): string {
  // Static imports, because the server registry of server functions imports every file anyway.
  const imports: string[] = [];
  const load = (file: string): string => {
    const name = `m${imports.length}`;
    imports.push(`import * as ${name} from ${JSON.stringify(resolve(file))};`);
    return `() => Promise.resolve(${name})`;
  };
  const write = (node: RouteFiles): string => {
    const fields: string[] = [];
    for (const key of ['layout', 'page', 'fallback'] as const) {
      const file = node[key];
      if (file) {
        fields.push(`${key}: ${load(file)}`);
      }
    }
    for (const key of ['static', 'slots'] as const) {
      const children = node[key];
      if (children) {
        const entries = Object.entries(children).map(
          ([name, value]) => `${JSON.stringify(name)}: ${write(value)}`,
        );
        fields.push(`${key}: { ${entries.join(', ')} }`);
      }
    }
    for (const key of ['dynamic', 'rest'] as const) {
      const value = node[key];
      if (value) {
        fields.push(`${key}: { name: ${JSON.stringify(value.name)}, node: ${write(value.node)} }`);
      }
    }
    return `{ ${fields.join(', ')} }`;
  };
  const routes = write(tree);
  return [
    "import { handleRoute } from 'brumate/server';",
    ...imports,
    `export const routes = ${routes};`,
    'export function handle(request, options) {',
    `  return handleRoute(routes, request, { rpc: ${JSON.stringify(rpc)}, ...options });`,
    '}',
  ].join('\n');
}
