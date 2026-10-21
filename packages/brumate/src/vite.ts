import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { normalizePath, transformWithOxc } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';
import { compile } from './compile.ts';
import { defaultExclude, findFiles, findServerFiles } from './files.ts';
import { hasUseServer, isScriptFile, serverStubs } from './server-files.ts';
import type { CompileResult } from './compile.ts';
import { getLocation } from './error.ts';
import { getComponentName, hash } from './plan.ts';
import { analyzeProject } from './project.ts';
import type { NavigateOptions } from './runtime/loader.ts';
import { formatReport, report, scopeLabel } from './inspect.ts';
import { instanceScope, slotIndex } from './codegen/scopes.ts';
import { isReactiveModule } from './modules.ts';
import { forEachNode } from './project.ts';
import { SHARED_QUERY, generateShared } from './shared-module.ts';
import { toNodeHeaders } from './runtime/cookies.ts';
import { prerender } from './prerender.ts';
import type { SourceMap } from './sourcemap.ts';
import { buildReport, formatBuildReport } from './report.ts';
import type { Budget, ReportChunk } from './report.ts';
import type { PrerenderOptions } from './prerender.ts';
import { routeFiles, routeModule, routeTypes } from './routes.ts';
import type { RouteFiles } from './routes.ts';

export interface BrumateOptions {
  /** The URL prefix of server function calls. Defaults to `/_brumate`. */
  rpc?: string;
  /**
   * Other origins that may call server functions, such as
   * `https://app.example.com`. Calls from other sites answer 403.
   */
  origins?: string[];
  /** Directories that are not searched for `.brm` files. Defaults to `node_modules`, `dist` and hidden directories. */
  exclude?: (directory: string) => boolean;
  /** The directory of route files, relative to the root. Defaults to `src/routes`. */
  routes?: string;
  /**
   * The declaration file that gives `href` of `brumate/routes` the paths of
   * the routes, relative to the root. The plugin writes it when the routes
   * change. Defaults to `src/brumate-routes.d.ts`. `false` writes none.
   */
  routeTypes?: string | false;
  /**
   * Loads pages without a full page load when a link is clicked or a form
   * posts. Defaults to true. `{ transition: true }` swaps pages inside a
   * view transition.
   */
  navigate?: boolean | NavigateOptions;
  /**
   * Client parts of a component smaller than this many bytes in all become
   * one module, so its first event loads one file. 0 keeps one module per
   * part. Defaults to 2048.
   */
  merge?: number;
  /**
   * Writes the pages as static HTML files after the server build, for a
   * static host. The client build must run first. `true` renders `/` and
   * the pages that its links lead to.
   */
  prerender?: boolean | PrerenderOptions;
  /**
   * Prints what the client build ships: what every page loads before its
   * first event, the core, the most that each route can load, and each
   * component. Sizes are after gzip.
   */
  report?: boolean;
  /** Fails the client build when a size goes over it, in bytes after gzip. */
  budget?: Budget;
  /** Warns about common accessibility mistakes in markup. Defaults to true. */
  a11y?: boolean;
  /**
   * Shows a button that opens the devtools panel, on the dev server only.
   * The panel shows the scopes of the page, a log of events, and the report
   * of each component. Defaults to true.
   */
  devtools?: boolean;
}

/** `import 'virtual:brumate/start'` in the client entry starts the loader. */
const START = 'virtual:brumate/start';
/** Exports `load(id)`, which imports the client module of a component. */
const MANIFEST = 'virtual:brumate/manifest';
/** Exports `functions` and `handle(request)` for server function calls. */
const SERVER = 'virtual:brumate/server';
/** Exports `routes` and `handle(request, options)` for the files in the routes directory. */
const ROUTES = 'virtual:brumate/routes';
/** The entry of the server build that prerendering renders with. */
const PRERENDER_ENTRY = 'brumate-routes';

const CLIENT_QUERY = '?brumate-client';
const RENDER_QUERY = '?brumate-render';
const SERVER_QUERY = '?brumate-server';
/** Exports `mount` from `brumate/testing`, with the loader of this project's client modules. */
const TESTING = 'virtual:brumate/testing';
/** The dev server answers the devtools panel about a component at this path. */
const INSPECT = '/__brumate/inspect';

/** Reads a request body as bytes, so files in form data stay intact. */
async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/** What decides whether an edit of a component can update a page without a reload. */
interface Shape {
  /**
   * The parts of the output that a page in the browser depends on: the
   * client entry with its update table, the slots of each scope, and the
   * markup. When they stay the same, the page keeps working with new code.
   */
  layout: string;
  css: string;
  /** The code of the client parts, which the page loads again when it changes. */
  code: string;
}

/** Removes the scripts, styles and event handlers of a file, which leaves the markup of its page. */
function markupOf(result: CompileResult): string {
  const { file } = result;
  const ranges: { start: number; end: number }[] = [
    ...(file.instanceScript ? [file.instanceScript] : []),
    ...(file.moduleScript ? [file.moduleScript] : []),
    ...file.styles,
  ];
  forEachNode(file.children, (node) => {
    if ('body' in node && node.body && 'script' in node.body && node.body.script) {
      ranges.push(node.body.script);
    }
    // The code of an event handler is not in the page, which only names the handler.
    if ('attributes' in node) {
      for (const attribute of node.attributes) {
        if (attribute.kind === 'event') {
          ranges.push(attribute.handler);
        }
      }
    }
  });
  let markup = '';
  let position = 0;
  for (const range of ranges.toSorted((a, b) => a.start - b.start)) {
    markup += file.source.slice(position, range.start);
    position = Math.max(position, range.end);
  }
  return markup + file.source.slice(position);
}

function shapeOf(result: CompileResult): Shape {
  const slots = [...result.plan.scopes.values()].map(
    (layout) => `${layout.scope.id}:${layout.slots.map((slot) => slot.name).join(',')}`,
  );
  return {
    layout: JSON.stringify([result.client, slots, markupOf(result)]),
    css: result.css,
    code: JSON.stringify(result.parts),
  };
}

/** The functions of a file of server functions, by their IDs, for a module of it. */
function fileFunctions(id: string, module: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(module)
      .filter(([, value]) => typeof value === 'function')
      .map(([name, value]) => [`${id}#${name}`, value]),
  );
}

/** The Vite plugin for `.brm` files. */
export default function brumate(options: BrumateOptions = {}): Plugin {
  const rpc = options.rpc ?? '/_brumate';
  const exclude = options.exclude ?? defaultExclude;
  let root = process.cwd();
  let outDir = '';
  let base = '/';
  let isSsrBuild = false;
  let isServe = false;
  /** Component IDs to absolute file paths. */
  const files = new Map<string, string>();
  const compiled = new Map<string, { source: string; result: CompileResult }>();
  /** Files that a component depends on, such as SCSS that it imports or modules that it calls into, with the components. */
  const dependents = new Map<string, Set<string>>();
  /** What the browser has of each component, from its last compile. See `shapeOf`. */
  const shapes = new Map<string, Shape>();
  /** The props that parents can change, by absolute file path. */
  let liveProps = new Map<string, Set<string>>();

  // The ID is computed from the path relative to the root, so it is the same on every machine.
  const relative = (file: string): string => normalizePath(path.relative(root, file));
  /** Files of server functions: scripts whose first statement is `'use server'`, by ID. */
  const serverFiles = new Map<string, string>();
  const serverFileId = (file: string): string =>
    `${path.basename(file).replace(/\.[^.]+$/, '')}_${hash(relative(file))}`;
  const componentId = (file: string): string => {
    const filename = relative(file);
    return `${getComponentName(filename)}_${hash(filename)}`;
  };

  const scan = async (): Promise<void> => {
    files.clear();
    for (const file of await findFiles(root, exclude)) {
      files.set(componentId(file), file);
    }
    serverFiles.clear();
    for (const file of await findServerFiles(root, exclude)) {
      serverFiles.set(serverFileId(file), file);
    }
    await analyze();
  };

  // Props are analyzed across the project, so a change to one file can change the output of others.
  const analyze = async (): Promise<void> => {
    const list = [...files.values()];
    const contents = await Promise.all(list.map((file) => readFile(file, 'utf8')));
    const sources = new Map(list.map((file, index) => [file, contents[index]!]));
    liveProps = analyzeProject(sources);
    compiled.clear();
  };

  // The entry, the parts and the render module of a file come from one compile.
  const compileFile = async (file: string): Promise<{ source: string; result: CompileResult }> => {
    const source = await readFile(file, 'utf8');
    let cached = compiled.get(file);
    if (cached?.source !== source) {
      cached = {
        source,
        result: compile(source, {
          filename: relative(file),
          liveProps: liveProps.get(file),
          path: file,
          merge: options.merge ?? 2048,
          a11y: options.a11y,
        }),
      };
      compiled.set(file, cached);
      shapes.set(file, shapeOf(cached.result));
    }
    return cached;
  };

  const manifest = (): string => {
    const entries = [...files].map(
      ([id, file]) =>
        `  ${JSON.stringify(id)}: () => import(${JSON.stringify(`${file}${CLIENT_QUERY}`)}),`,
    );
    return [
      'const modules = {',
      ...entries,
      '};',
      'export function load(id) {',
      '  const module = modules[id];',
      '  if (!module) {',
      '    throw new Error(`Unknown component "${id}"`);',
      '  }',
      '  return module();',
      '}',
    ].join('\n');
  };

  const serverRegistry = (): string => {
    const imports = [...files.values()].map(
      (file, index) => `import * as m${index} from ${JSON.stringify(file)};`,
    );
    const spreads = [...files.values()].map((_, index) => `  ...m${index}.rpc,`);
    // Each exported function of a file of server functions, under the ID that its stub calls.
    const fileImports = [...serverFiles.values()].map(
      (file, index) => `import * as f${index} from ${JSON.stringify(file)};`,
    );
    const fileSpreads = [...serverFiles.keys()].map(
      (id, index) =>
        `  ...Object.fromEntries(Object.entries(f${index}).filter(([, value]) => typeof value === 'function').map(([name, value]) => [${JSON.stringify(`${id}#`)} + name, value])),`,
    );
    return [
      "import { handleRequest } from 'brumate/server';",
      ...imports,
      ...fileImports,
      'export const functions = {',
      ...spreads,
      ...fileSpreads,
      '};',
      'export function handle(request) {',
      `  return handleRequest(functions, request, ${JSON.stringify(rpc)}, { origins: ${JSON.stringify(options.origins ?? [])} });`,
      '}',
    ].join('\n');
  };

  const routesDirectory = (): string =>
    normalizePath(path.resolve(root, options.routes ?? 'src/routes'));

  /** The route files, from the `.brm` files found and the `.ts` files of the directory. */
  const currentRoutes = (): RouteFiles => {
    const directory = routesDirectory();
    const paths = [...files.values()]
      .filter((file) => file.startsWith(`${directory}/`))
      .map((file) => file.slice(directory.length + 1));
    // Endpoints and middleware are `.ts` files.
    if (existsSync(directory)) {
      for (const entry of readdirSync(directory, { recursive: true, encoding: 'utf8' })) {
        const file = normalizePath(entry);
        if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
          paths.push(file);
        }
      }
    }
    return routeFiles(paths);
  };

  const routeTree = (): string =>
    routeModule(currentRoutes(), (file) => `${routesDirectory()}/${file}`, rpc, options.origins);

  /** Writes the paths of the routes as types for `href`, when they changed. */
  const writeRouteTypes = (): void => {
    if (options.routeTypes === false || !existsSync(routesDirectory())) {
      return;
    }
    const file = path.resolve(root, options.routeTypes ?? 'src/brumate-routes.d.ts');
    const text = routeTypes(currentRoutes());
    if (!existsSync(file) || readFileSync(file, 'utf8') !== text) {
      writeFileSync(file, text);
    }
  };

  /** What the devtools panel shows about a component: its name, its scopes and its report. */
  const inspectComponent = async (id: string): Promise<object | undefined> => {
    const file = files.get(id);
    if (!file) {
      return undefined;
    }
    const { source, result } = await compileFile(file);
    const { plan } = result;
    const scopes: Record<number, { label: string; slots: string[] }> = {};
    for (const layout of plan.scopes.values()) {
      scopes[layout.scope.id] = {
        label: scopeLabel(result.file.source, layout.scope),
        slots: layout.slots.map((slot) => slot.name),
      };
    }
    // The nodes that can change in the browser, with the slot of each value, so the panel
    // can mark a node when its slot is written.
    const nodes = plan.graph.nodes.filter((node) => plan.graph.live.has(node));
    const indexes = new Map(nodes.map((node, index) => [node, index]));
    const graph = {
      nodes: nodes.map((node) => {
        if (node.kind === 'source' || node.kind === 'memo') {
          return {
            kind: node.kind === 'memo' ? 'memo' : node.declaration.kind,
            label: node.declaration.name,
            scope: instanceScope(plan, node.declaration.scope).id,
            slot: slotIndex(plan, node.declaration),
          };
        }
        // Markup has no name, so its place in the file tells nodes apart, such as `insert 9:42`.
        // Code that a module function gave the component has no place in the component's file.
        const at = result.locate(node.site.range.start);
        const where = at.file === undefined ? getLocation(source, at.offset) : undefined;
        return {
          kind: node.kind,
          label: where ? `${node.site.label} ${where.line}:${where.column}` : node.site.label,
          scope: instanceScope(plan, node.site.scope).id,
        };
      }),
      edges: plan.graph.edges
        .filter((edge) => indexes.has(edge.from) && indexes.has(edge.to))
        .map((edge) => [indexes.get(edge.from)!, indexes.get(edge.to)!]),
    };
    const text = formatReport(report(source, result, liveProps.get(file)));
    return { name: plan.name, file: relative(file), scopes, graph, text };
  };

  const handleDevRPC = async (
    server: ViteDevServer,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    const id = decodeURIComponent((request.url ?? '').slice(rpc.length + 1).split('?')[0]!);
    const owner = id.split('#')[0]!;
    const file = files.get(owner) ?? serverFiles.get(owner);
    if (!file) {
      response.statusCode = 404;
      response.end(`Unknown server function "${id}"`);
      return;
    }
    try {
      const module = await server.ssrLoadModule(file);
      const { handleRequest } = await server.ssrLoadModule('brumate/server');
      // The same path as production, so server functions can read the request.
      const webRequest = new Request(new URL(request.url ?? '/', 'http://localhost'), {
        method: 'POST',
        headers: Object.entries(request.headers).flatMap(([name, value]) =>
          value === undefined ? [] : [[name, String(value)] as [string, string]],
        ),
        body: new Uint8Array(await readBody(request)),
      });
      const functions = serverFiles.has(owner) ? fileFunctions(owner, module) : (module.rpc ?? {});
      const answer: Response = await handleRequest(functions, webRequest, rpc, {
        origins: options.origins,
      });
      response.statusCode = answer.status;
      // Each cookie stays apart, as `forEach` would set only the last one.
      for (const [name, value] of Object.entries(toNodeHeaders(answer.headers))) {
        response.setHeader(name, value);
      }
      response.end(await answer.text());
    } catch (error) {
      server.config.logger.error(String((error as Error).stack ?? error));
      response.statusCode = 500;
      response.end(String(error));
    }
  };

  return {
    name: 'brumate',
    enforce: 'pre',

    config(config, env) {
      // The server build gets the route handler as an entry of its own, to render the pages with.
      if (!options.prerender || !env.isSsrBuild) {
        return undefined;
      }
      // `--ssr <file>` names the entry, and wins over the input of the config, which can be the client's.
      const ssr = config.build?.ssr;
      const input = typeof ssr === 'string' ? ssr : config.build?.rolldownOptions?.input;
      const entries =
        typeof input === 'string'
          ? { [path.basename(input).replace(/\.[^.]+$/, '')]: input }
          : Array.isArray(input)
            ? Object.fromEntries(
                input.map((item) => [path.basename(item).replace(/\.[^.]+$/, ''), item]),
              )
            : { ...(input as Record<string, string> | undefined) };
      return {
        build: { ssr: true, rolldownOptions: { input: { ...entries, [PRERENDER_ENTRY]: ROUTES } } },
      };
    },

    configResolved(config) {
      root = config.root;
      isServe = config.command === 'serve';
      outDir = path.resolve(config.root, config.build.outDir);
      base = config.base;
      isSsrBuild = Boolean(config.build.ssr);
    },

    async generateBundle(_output, bundle) {
      if (isSsrBuild || (!options.report && !options.budget)) {
        return;
      }
      const chunks: ReportChunk[] = [];
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk') {
          chunks.push({
            fileName: item.fileName,
            code: item.code,
            isEntry: item.isEntry,
            imports: item.imports,
            moduleIds: item.moduleIds,
          });
        }
      }
      const list = [...files.values()];
      const contents = await Promise.all(list.map((file) => readFile(file, 'utf8')));
      const measured = buildReport({
        chunks,
        sources: new Map(list.map((file, index) => [file, contents[index]!])),
        routes: existsSync(routesDirectory())
          ? { tree: currentRoutes(), resolve: (file) => `${routesDirectory()}/${file}` }
          : undefined,
        budget: options.budget,
      });
      if (options.report) {
        this.info(`\n${formatBuildReport(measured, relative)}`);
      }
      if (measured.overBudget.length > 0) {
        this.error(measured.overBudget.join('\n'));
      }
    },

    async writeBundle(_output, bundle) {
      if (!options.prerender || !isSsrBuild) {
        return;
      }
      const chunk = Object.values(bundle).find(
        (item) => item.type === 'chunk' && item.isEntry && item.name === PRERENDER_ENTRY,
      );
      if (!chunk) {
        return;
      }
      const settings = options.prerender === true ? {} : options.prerender;
      const written = await prerender(path.join(outDir, chunk.fileName), root, base, settings);
      this.info(`Prerendered ${written.length} pages`);
    },

    async buildStart() {
      await scan();
      writeRouteTypes();
    },

    resolveId(id) {
      if (id === START || id === MANIFEST || id === SERVER || id === ROUTES || id === TESTING) {
        return `\0${id}`;
      }
      return undefined;
    },

    async load(id, loadOptions) {
      // The browser code of the functions of a module of reactive logic, shared by every call.
      if (id.endsWith(SHARED_QUERY)) {
        const module = id.slice(0, -SHARED_QUERY.length);
        this.addWatchFile(module);
        const { code, map } = generateShared({
          path: module,
          source: await readFile(module, 'utf8'),
        });
        return { code, map: { ...map, sources: [module] } };
      }
      if (id === `\0${START}`) {
        return [
          "import { start } from 'brumate/loader';",
          `import { load } from ${JSON.stringify(MANIFEST)};`,
          // On the dev server, an edit of a component can update the page without a reload.
          ...(isServe
            ? [
                "import { hotLoad } from 'brumate/hot';",
                `start({ load: hotLoad(import.meta.hot, load), rpc: ${JSON.stringify(rpc)}, navigate: ${JSON.stringify(options.navigate ?? true)} });`,
              ]
            : [
                `start({ load, rpc: ${JSON.stringify(rpc)}, navigate: ${JSON.stringify(options.navigate ?? true)} });`,
              ]),
          // The devtools listen to the core before it starts. Only the dev server has them.
          ...(isServe && options.devtools !== false
            ? [
                `import('brumate/devtools').then((m) => m.installDevtools(${JSON.stringify(INSPECT)}, ${JSON.stringify(rpc)}));`,
              ]
            : []),
        ].join('\n');
      }
      if (id === `\0${MANIFEST}`) {
        return manifest();
      }
      if (id === `\0${SERVER}`) {
        return serverRegistry();
      }
      if (id === `\0${ROUTES}`) {
        return routeTree();
      }
      if (id === `\0${TESTING}`) {
        return [
          "import { createMount } from 'brumate/testing';",
          `import { load } from ${JSON.stringify(MANIFEST)};`,
          `export const mount = createMount({ load, rpc: ${JSON.stringify(rpc)} });`,
        ].join('\n');
      }
      const [file, query] = id.split('?');
      if (!file?.endsWith('.brm')) {
        return undefined;
      }
      // Vite can add its own parameters, such as `import`.
      const params = new URLSearchParams(query);
      const isRender = params.has(RENDER_QUERY.slice(1));
      // A test in a browser environment imports the server version of a component with this query.
      const isServer = params.has(SERVER_QUERY.slice(1));
      const isClient = !isServer && (params.has(CLIENT_QUERY.slice(1)) || !loadOptions?.ssr);
      const { source, result } = await compileFile(file);
      // A stylesheet that the component imports, or a module of reactive logic that it calls into,
      // changes the output of the component.
      for (const dependency of [...result.plan.styles.dependencies, ...result.modules]) {
        const normalized = normalizePath(dependency);
        this.addWatchFile(normalized);
        if (!dependents.has(normalized)) {
          dependents.set(normalized, new Set());
        }
        dependents.get(normalized)!.add(file);
      }
      for (const warning of isClient && !params.has('part') ? result.warnings : []) {
        const { line, column } = getLocation(source, warning.range.start);
        this.warn(`${warning.message} (${relative(file)}:${line}:${column})`);
      }
      const part = params.get('part');
      let code: string;
      let map: SourceMap | undefined;
      if (isRender) {
        code = result.render;
        map = result.maps.render;
      } else if (part) {
        code = result.parts[part] ?? '';
        map = result.maps.parts[part];
      } else if (isServer) {
        // The components that it renders are server versions too. Only import lines change, which have no mappings.
        code = result.server.replace(/(from\s+(['"])[^'"]+\.brm)\2/g, `$1${SERVER_QUERY}$2`);
        map = result.maps.server;
      } else {
        code = isClient ? result.client : result.server;
        map = isClient ? result.maps.client : result.maps.server;
      }
      // The map points at the file by its path, so the browser shows it under its own name. Code
      // that came from modules of reactive logic points at them, by their paths too.
      // `transform` below removes the types, and Vite chains the two maps.
      return {
        code,
        map: map && {
          ...map,
          sources: map.sources.map((name, index) => (index === 0 ? file : name)),
        },
      };
    },

    async transform(code, id, transformOptions) {
      const [file] = id.split('?');
      // A file of server functions: the browser gets stubs that call the server instead.
      if (file && isScriptFile(file) && hasUseServer(code)) {
        try {
          const stubs = serverStubs(code, file, serverFileId(normalizePath(file)));
          return transformOptions?.ssr ? undefined : { code: stubs, map: null };
        } catch (error) {
          this.error((error as Error).message);
        }
      }
      // The shared module of a module of reactive logic is TypeScript too, under a query
      // that Vite does not strip types for.
      const shared = isReactiveModule(file ?? '') && id.endsWith(SHARED_QUERY);
      if (!file?.endsWith('.brm') && !shared) {
        return undefined;
      }
      const result = await transformWithOxc(code, `${file}.ts`, { lang: 'ts', sourcemap: true });
      return { code: result.code, map: result.map };
    },

    configureServer(server) {
      server.watcher.on('all', (event, file) => {
        // A stylesheet that a component imports compiles into that component.
        for (const importer of dependents.get(normalizePath(file)) ?? []) {
          compiled.delete(importer);
          for (const module of server.moduleGraph.getModulesByFile(importer) ?? []) {
            server.moduleGraph.invalidateModule(module);
          }
        }
        // A new or removed endpoint or middleware changes the routes.
        if (
          file.endsWith('.ts') &&
          normalizePath(file).startsWith(`${routesDirectory()}/`) &&
          (event === 'add' || event === 'unlink')
        ) {
          for (const module of server.moduleGraph.idToModuleMap.values()) {
            if (module.id === `\0${ROUTES}`) {
              server.moduleGraph.invalidateModule(module);
            }
          }
          writeRouteTypes();
        }
        // A file that becomes, or stops being, a file of server functions changes the registry.
        if (isScriptFile(file)) {
          const normalized = normalizePath(file);
          const id = serverFileId(normalized);
          const before = serverFiles.has(id);
          const after =
            event !== 'unlink' && existsSync(file) && hasUseServer(readFileSync(file, 'utf8'));
          if (after) {
            serverFiles.set(id, normalized);
          } else {
            serverFiles.delete(id);
          }
          if (before !== after) {
            for (const module of server.moduleGraph.idToModuleMap.values()) {
              if (module.id === `\0${SERVER}` || module.id === `\0${ROUTES}`) {
                server.moduleGraph.invalidateModule(module);
              }
            }
          }
        }
        // A changed component is handled by `handleHotUpdate`, which updates the page in place when it can.
        if (!file.endsWith('.brm') || event === 'change') {
          return;
        }
        void scan()
          .then(writeRouteTypes)
          .then(() => {
            for (const module of server.moduleGraph.idToModuleMap.values()) {
              const id = module.id ?? '';
              if (
                id.includes('.brm') ||
                id === `\0${MANIFEST}` ||
                id === `\0${SERVER}` ||
                id === `\0${ROUTES}`
              ) {
                server.moduleGraph.invalidateModule(module);
              }
            }
          });
      });
      server.middlewares.use((request, response, next) => {
        if (request.method === 'POST' && request.url?.startsWith(`${rpc}/`)) {
          void handleDevRPC(server, request, response);
          return;
        }
        if (request.method === 'GET' && request.url?.startsWith(`${INSPECT}/`)) {
          void inspectComponent(decodeURIComponent(request.url.slice(INSPECT.length + 1)))
            .then((info) => {
              response.statusCode = info ? 200 : 404;
              response.setHeader('content-type', 'application/json');
              response.end(JSON.stringify(info ?? { error: 'Unknown component' }));
            })
            .catch(next);
          return;
        }
        next();
      });
    },

    async handleHotUpdate({ file, server, timestamp }) {
      const normalized = normalizePath(file);
      const targets = file.endsWith('.brm')
        ? [normalized]
        : [...(dependents.get(normalized) ?? [])];
      if (targets.length === 0) {
        return undefined;
      }
      // A resumed page cannot run a component again. When an edit keeps the markup, the slots
      // and the update table of each changed component, the page keeps its state: new styles
      // replace the old ones, and the next event loads the new code. Otherwise the page reloads.
      const reload = (): [] => {
        for (const module of server.moduleGraph.idToModuleMap.values()) {
          const id = module.id ?? '';
          if (
            id.includes('.brm') ||
            id === `\0${MANIFEST}` ||
            id === `\0${SERVER}` ||
            id === `\0${ROUTES}`
          ) {
            server.moduleGraph.invalidateModule(module);
          }
        }
        server.ws.send({ type: 'full-reload' });
        return [];
      };
      await analyze();
      const updates: { id: string; css?: string; url?: string }[] = [];
      for (const target of targets) {
        const before = shapes.get(target);
        let after: Shape;
        try {
          // oxlint-disable-next-line no-await-in-loop -- The first component that cannot update in place reloads the page.
          after = shapeOf((await compileFile(target)).result);
        } catch {
          // The error shows when the page reloads and the module compiles.
          return reload();
        }
        if (!before || before.layout !== after.layout) {
          return reload();
        }
        const id = componentId(target);
        const modules = [
          ...(server.moduleGraph.getModulesByFile(target) ?? []),
          // The shared code of a module of reactive logic that changed.
          ...(target === normalized ? [] : (server.moduleGraph.getModulesByFile(normalized) ?? [])),
        ];
        for (const module of modules) {
          server.moduleGraph.invalidateModule(module, new Set(), timestamp, true);
        }
        const entry = [...(server.moduleGraph.getModulesByFile(target) ?? [])].find((module) =>
          module.id?.endsWith(CLIENT_QUERY),
        );
        updates.push({
          id,
          css: before.css === after.css ? undefined : after.css,
          url: before.code === after.code ? undefined : entry?.url,
        });
      }
      server.ws.send({ type: 'custom', event: 'brumate:update', data: { updates, timestamp } });
      return [];
    },
  };
}
export type { ManifestChunk, PrerenderOptions } from './prerender.ts';
export type { Budget, BuildReport } from './report.ts';
