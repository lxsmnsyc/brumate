// Builds the route tree of `virtual:brumate/routes` from the files of a routes directory.

/** A folder of routes, with the files as paths. The runtime `RouteNode` has loaders instead. */
export interface RouteFiles {
  layout?: string;
  page?: string;
  fallback?: string;
  /** `_error.brm`: renders when a route of the folder throws, or when no route matches. */
  error?: string;
  /** `_loading.brm`: shows while a route of the folder streams in. */
  loading?: string;
  /** `_middleware.ts`: runs before the routes of the folder. */
  middleware?: string;
  /** A `.ts` file that answers requests at its path, such as `api/todos.ts`. */
  endpoint?: string;
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
 * Builds the route tree from paths relative to the routes directory, such as
 * `todos/[id].brm`. `_layout.brm`, `_default.brm`, `_error.brm`,
 * `_loading.brm`, `_middleware.ts` and `index.brm` belong to their folder.
 * Other files starting with `_` are not routes. A `.ts` file is an endpoint.
 */
export function routeFiles(paths: string[]): RouteFiles {
  const tree: RouteFiles = {};
  for (const file of paths) {
    const typescript = file.endsWith('.ts');
    const segments = file.replace(/\.(brm|ts)$/, '').split('/');
    const name = segments.pop()!;
    let node = tree;
    for (const segment of segments) {
      node = child(node, segment);
    }
    if (typescript) {
      if (name === '_middleware') {
        node.middleware = file;
      } else if (name === 'index') {
        node.endpoint = file;
      } else if (!name.startsWith('_')) {
        child(node, name).endpoint = file;
      }
      continue;
    }
    if (name === '_error') {
      node.error = file;
    } else if (name === '_loading') {
      node.loading = file;
    } else if (name === '_layout') {
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
 * `middleware` is the path of the entry middleware, which runs for every
 * request, when the app has one.
 */
export function routeModule(
  tree: RouteFiles,
  resolve: (file: string) => string,
  rpc = '/_brumate',
  origins: string[] = [],
  /** In development, errors reach the dev server instead of `_error.brm`. */
  dev = false,
  middleware?: string,
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
    for (const key of [
      'layout',
      'page',
      'fallback',
      'error',
      'loading',
      'middleware',
      'endpoint',
    ] as const) {
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
    // Forms without scripts post to their page, which runs the server function.
    "import { functions } from 'virtual:brumate/server';",
    ...(middleware ? [`import middleware from ${JSON.stringify(middleware)};`] : []),
    ...imports,
    `export const routes = ${routes};`,
    'export function handle(request, options) {',
    `  return handleRoute(routes, request, { rpc: ${JSON.stringify(rpc)}, origins: ${JSON.stringify(origins)}, functions${middleware ? ', middleware' : ''}${dev ? ', dev: true' : ''}, ...options });`,
    '}',
  ].join('\n');
}

/** A path that a request can reach, with the names of its params. */
export interface RoutePathInfo {
  /** The path as the route files spell it, such as `/todos/[id]`. */
  path: string;
  params: string[];
}

/** The paths of the pages and endpoints of a tree. Slots render at the paths of their layout. */
export function routePaths(tree: RouteFiles): RoutePathInfo[] {
  const result: RoutePathInfo[] = [];
  const visit = (node: RouteFiles, path: string, params: string[]): void => {
    if (node.page || node.endpoint) {
      result.push({ path: path || '/', params });
    }
    for (const [segment, folder] of Object.entries(node.static ?? {})) {
      visit(folder, `${path}/${segment}`, params);
    }
    if (node.dynamic) {
      visit(node.dynamic.node, `${path}/[${node.dynamic.name}]`, [...params, node.dynamic.name]);
    }
    if (node.rest) {
      visit(node.rest.node, `${path}/[...${node.rest.name}]`, [...params, node.rest.name]);
    }
  };
  visit(tree, '', []);
  return result.toSorted((a, b) => a.path.localeCompare(b.path));
}

/** A declaration file that adds the paths of a tree to `Routes` of `brumate/routes`. */
export function routeTypes(tree: RouteFiles): string {
  const lines = routePaths(tree).map(({ path, params }) => {
    const fields = params.map((name) => `${name}: string`).join('; ');
    // Single quotes, as formatters write them, so a formatted project leaves the file as it is.
    const key = `'${path.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    return `    ${key}: {${fields ? ` ${fields} ` : ''}};`;
  });
  return [
    '// Written by the brumate Vite plugin from the route files. Do not edit.',
    // An export makes this a module, so the block below adds to brumate/routes instead of replacing it.
    'export {};',
    '',
    "declare module 'brumate/routes' {",
    '  interface Routes {',
    ...lines,
    '  }',
    '}',
    '',
  ].join('\n');
}
