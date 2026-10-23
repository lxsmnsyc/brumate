import { createHash } from 'node:crypto';
import { parseSync } from 'oxc-parser';
import type { Site } from './model.ts';
import type { oxc } from './oxc.ts';
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isRunnableDevEnvironment,
  normalizePath,
  searchForWorkspaceRoot,
  isFileLoadingAllowed,
  transformWithOxc,
  version as viteVersion,
} from 'vite';
import type { EnvironmentModuleNode, Plugin, UserConfig, ViteDevServer } from 'vite';
import { entryClasses } from './captures.ts';
import { refreshedNames } from './refreshes.ts';
import { compile } from './compile.ts';
import { DEFAULT_MERGE } from './codegen/client.ts';
import { defaultExclude, findFiles, findScripts, findServerFiles } from './files.ts';
import { clientEnvModule, parseEnvFile } from './env-file.ts';
import {
  hasServerMiddleware,
  hasUseServer,
  isScriptFile,
  serverExports,
  serverModule,
  serverStubs,
} from './server-files.ts';
import type { CompileOptions, CompileResult } from './compile.ts';
import { getLocation } from './error.ts';
import { functionId, getComponentName, hash } from './plan.ts';
import { analyzeProject, resolveRelative } from './project.ts';
import { BUILD_FILE, clientBuildDirectory, pruneBuilds, readBuildId } from './builds.ts';
import {
  findPackages,
  packageFileName,
  packageOf,
  reachableFiles,
  resolvePackageImport,
  splitSpecifier,
} from './packages.ts';
import type { BrumatePackage } from './packages.ts';
import type { NavigateOptions } from './runtime/boot.ts';
import { anchorLabel, formatReport, report, scopeLabel } from './inspect.ts';
import { instanceScope, slotIndex } from './codegen/scopes.ts';
import { isReactiveModule, resolveFromDisk } from './modules.ts';
import { forEachNode } from './project.ts';
import { SHARED_QUERY, generateShared } from './shared-module.ts';
import { originalPosition } from './sourcemap.ts';
import { toNodeHeaders } from './runtime/cookies.ts';
import { errorPage, errorPayload } from './dev-error.ts';
import type { renderToStream as RenderToStream } from './runtime/server.ts';
import { workbenchPage } from './workbench-page.ts';
import { classifyComponents, propControls } from './workbench.ts';
import { parse as parseComponent } from './parser.ts';
import { BRUMATE_VERSION } from './version.ts';
import { prerender } from './prerender.ts';
import type { HotUpdate } from './runtime/hot.ts';
import type { SourceMap } from './sourcemap.ts';
import { buildReport, formatBuildReport } from './report.ts';
import type { Budget, ReportChunk, ReportEvent } from './report.ts';
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
   * The entry middleware, relative to the root. Its default export runs for
   * every request: pages, endpoints, server function calls, form posts and
   * `#defer` bodies. Defaults to `src/middleware.ts` when the file exists.
   * `false` runs none.
   */
  middleware?: string | false;
  /**
   * The serial entry, relative to the root. It exports `plugins` for values
   * of the app, such as a class, and the options of the serializer that it
   * changes. The server and the browser load it. Defaults to `src/serial.ts`
   * when the file exists. `false` uses none.
   */
  serial?: string | false;
  /**
   * The file of environment variables, relative to the root, which calls
   * `defineEnv` from `brumate/env`. The server checks them when it starts,
   * and the browser gets the file without the server variables. Defaults
   * to `src/env.ts` when the file exists. `false` uses none.
   */
  env?: string | false;
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
   * After the page loads, while the browser is idle, the loader loads the
   * core and the code of the handlers of elements in or near the viewport,
   * so the first event needs no request. It skips elements with
   * `prefetch="none"`, and loads nothing when the browser asks to save data
   * or the connection is 2G. Defaults to true.
   */
  preload?: boolean;
  /**
   * Client parts of a component smaller than this many bytes in all, after
   * minifying, become one module, so its first event loads one file. 0
   * keeps one module per part. Defaults to 4096.
   */
  merge?: number;
  /**
   * Writes the pages as static HTML files after the server build, for a
   * static host. The client build must run first. `true` renders `/` and
   * the pages that its links lead to.
   */
  prerender?: boolean | PrerenderOptions;
  /**
   * Skew protection: a page that was open before a deploy keeps working.
   * Each build has an ID, which the page carries and sends with its calls.
   * A call to a function that is gone, or a page of another build, makes
   * the browser load the page in full. The client build writes its ID to
   * `.brumate/build.json`, and the server build reads it, so build the
   * client first. `BRUMATE_BUILD` in the environment names the ID for both.
   *
   * `keep` is how many earlier builds keep their files in the client
   * output, so a page that is open still finds the code of its handlers
   * after a deploy. The build then does not empty the output directory, and
   * removes the files of older builds itself. Defaults to 0, which empties
   * it as Vite does.
   */
  skew?: { keep?: number };
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
/** The modules that every page loads early, in the client build. See `hints` of `handleRoute`. */
const HINTS_FILE = '.brumate/hints.json';
/** The dev server answers the devtools panel about a component at this path. */
const INSPECT = '/__brumate/inspect';
/** Maps a position of a module that the browser ran to its source, for the Errors tab. */
const POSITION = '/__brumate/position';
/** The dev server sends the source of a file for the Errors tab of the devtools at this path. */
const SOURCE = '/__brumate/source';
/** The workbench of the dev server, which shows the components that depend only on their props. */
const WORKBENCH = '/__brumate/workbench';

/** What tells two lists of packages of components apart. */
function packagesKey(list: BrumatePackage[]): string {
  return JSON.stringify(list.map((item) => [item.prefix, item.root, item.directories]));
}

/** Skips the `node_modules` and hidden directories of a package of components. */
function packageExclude(directory: string): boolean {
  return directory === 'node_modules' || directory.startsWith('.');
}

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
  /** The names of the slots of each scope, by its ID in the component. */
  slots: Record<number, string[]>;
  /** The names of the signals, whose values stay when the markup changes. */
  signals: string[];
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
  const layouts = [...result.plan.scopes.values()];
  return {
    layout: JSON.stringify([result.table, slots, markupOf(result)]),
    css: result.css,
    // The entry of a small component holds its code too.
    code: JSON.stringify([result.client, result.parts]),
    slots: Object.fromEntries(
      layouts.map((layout) => [layout.scope.id, layout.slots.map((slot) => slot.name)]),
    ),
    signals: layouts.flatMap((layout) =>
      layout.slots.filter((slot) => slot.kind === 'signal').map((slot) => slot.name),
    ),
  };
}

/** What Vitest passes to `configureVitest`, the part that this plugin uses. */
interface VitestContext {
  defineCacheKeyGenerator?: (generate: () => string) => void;
  experimental_defineCacheKeyGenerator?: (generate: () => string) => void;
}

let fingerprint: string | undefined;

/**
 * A hash of the code of this build of brumate. A new build can compile the
 * same `.brm` file to other code, so the hash is part of Vitest's cache key.
 */
function buildFingerprint(): string {
  if (fingerprint === undefined) {
    const digest = createHash('sha1');
    const visit = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true }).toSorted((a, b) =>
        a.name < b.name ? -1 : 1,
      )) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(file);
        } else if (/\.[jt]s$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
          digest.update(entry.name).update(readFileSync(file));
        }
      }
    };
    visit(path.dirname(fileURLToPath(import.meta.url)));
    fingerprint = digest.digest('hex').slice(0, 16);
  }
  return fingerprint;
}

/** The Vite plugin for `.brm` files. */
export default function brumate(options: BrumateOptions = {}): Plugin {
  const rpc = options.rpc ?? '/_brumate';
  /** The entry middleware, when the app has one. */
  const middlewareFile = (): string | undefined => {
    if (options.middleware === false) {
      return undefined;
    }
    const file = normalizePath(path.resolve(root, options.middleware ?? 'src/middleware.ts'));
    if (!existsSync(file)) {
      if (options.middleware !== undefined) {
        throw new Error(`The middleware file ${options.middleware} does not exist`);
      }
      return undefined;
    }
    return file;
  };
  /** The serial entry, when the app has one. */
  const serialFile = (): string | undefined => {
    if (options.serial === false) {
      return undefined;
    }
    const file = normalizePath(path.resolve(root, options.serial ?? 'src/serial.ts'));
    if (!existsSync(file)) {
      if (options.serial !== undefined) {
        throw new Error(`The serial entry ${options.serial} does not exist`);
      }
      return undefined;
    }
    return file;
  };
  /** The classes that the plugins of the serial entry send, read from its `instanceof` checks. */
  let serialRead: { source: string; classes: string[] } | undefined;
  const serialClasses = (): string[] => {
    const file = serialFile();
    if (!file) {
      return [];
    }
    const source = readFileSync(file, 'utf8');
    if (serialRead?.source !== source) {
      const { program } = parseSync(file, source, { lang: 'ts' });
      serialRead = { source, classes: entryClasses(program as oxc.Node) };
    }
    return serialRead.classes;
  };
  /** The lines that give the server the serial entry, before anything is written or read. */
  const serialImports = (): string[] => {
    const file = serialFile();
    return file
      ? [
          `import * as $$serial from ${JSON.stringify(file)};`,
          "import { useSerialEntry } from 'brumate/server';",
          'useSerialEntry($$serial);',
        ]
      : [];
  };
  /** The file of environment variables, when the app has one. */
  const envFile = (): string | undefined => {
    if (options.env === false) {
      return undefined;
    }
    const file = normalizePath(path.resolve(root, options.env ?? 'src/env.ts'));
    if (!existsSync(file)) {
      if (options.env !== undefined) {
        throw new Error(`The env file ${options.env} does not exist`);
      }
      return undefined;
    }
    return file;
  };
  /** The names of the server variables, read from the env file, by its source. */
  let envKeys: { source: string; server: string[] } | undefined;
  const serverEnvKeys = (): string[] | undefined => {
    const file = envFile();
    if (!file) {
      return undefined;
    }
    const source = readFileSync(file, 'utf8');
    if (envKeys?.source !== source) {
      envKeys = { source, server: parseEnvFile(source, file).server };
    }
    return envKeys.server;
  };
  const exclude = options.exclude ?? defaultExclude;
  let root = process.cwd();
  let outDir = '';
  /** The ID of the build, for skew protection. Undefined on the dev server. */
  let buildId: string | undefined;
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
  /** The names of the server functions that the app refreshes, or undefined before the first scan. */
  let refreshed: Set<string> | undefined;

  /** The dependencies of the app that ship `.brm` files. See `packages.ts`. */
  let packages: BrumatePackage[] = [];

  // The ID is computed from the path relative to the root, so it is the same on every machine.
  const relative = (file: string): string => normalizePath(path.relative(root, file));
  /**
   * The name of a file, which its IDs come from: its path relative to the root,
   * or for a file of a package, the name of the package and its path in it.
   */
  const nameOf = (file: string): string => {
    let normalized = normalizePath(file);
    let owner = packageOf(packages, normalized);
    // With `resolve.preserveSymlinks`, Vite names a file of a package by its link.
    if (!owner && normalized.includes('/node_modules/') && existsSync(normalized)) {
      normalized = normalizePath(realpathSync(normalized));
      owner = packageOf(packages, normalized);
    }
    return owner ? packageFileName(owner, normalized) : relative(file);
  };
  /** True for a bare specifier that names a package of components. */
  const isPackageSpecifier = (specifier: string): boolean => {
    const name = splitSpecifier(specifier)?.name;
    return name !== undefined && packages.some((item) => item.name === name);
  };
  /** Files of server functions: scripts whose first statement is `'use server'`, by ID. */
  const serverFiles = new Map<string, string>();
  /** The scripts of the app, when it uses packages of components. */
  let appScripts: string[] = [];
  /** The ID of a function that a component imports from a 'use server' file, by a relative path. */
  const serverImport = (importer: string, specifier: string, name: string): string | undefined => {
    // A package of components can export a file of server functions.
    if (!specifier.startsWith('.')) {
      const file = isPackageSpecifier(specifier)
        ? resolvePackageImport(specifier, importer)
        : undefined;
      return file && isScriptFile(file) && hasUseServer(readFileSync(file, 'utf8'))
        ? functionId(serverFileId(file), name, !isServe)
        : undefined;
    }
    const stem = path.resolve(path.dirname(importer), specifier);
    const found = [
      stem,
      ...['.ts', '.tsx', '.js', '.mjs'].map((extension) => stem + extension),
    ].find(
      (candidate) =>
        isScriptFile(candidate) &&
        existsSync(candidate) &&
        hasUseServer(readFileSync(candidate, 'utf8')),
    );
    return found && functionId(serverFileId(normalizePath(found)), name, !isServe);
  };

  const serverFileId = (file: string): string =>
    `${path.basename(file).replace(/\.[^.]+$/, '')}_${hash(nameOf(file))}`;
  const componentId = (file: string): string => {
    const filename = nameOf(file);
    return `${getComponentName(filename)}_${hash(filename)}`;
  };

  const scan = async (): Promise<void> => {
    const directories = packages.flatMap((item) =>
      item.directories.filter((directory) => existsSync(directory)),
    );
    // A package inside the root, such as one of a workspace, is found once, as a package.
    const ownFile = (file: string): boolean => !packageOf(packages, file);
    const [own, ownServer, ...found] = await Promise.all([
      findFiles(root, exclude),
      findServerFiles(root, exclude),
      ...directories.flatMap((directory) => [
        findFiles(directory, packageExclude),
        findServerFiles(directory, packageExclude),
      ]),
    ]);
    // The scripts of the app, which can import files of packages.
    appScripts = packages.length > 0 ? (await findScripts(root, exclude)).filter(ownFile) : [];
    files.clear();
    serverFiles.clear();
    for (const file of own!.filter(ownFile)) {
      files.set(componentId(file), file);
    }
    for (const file of ownServer!.filter(ownFile)) {
      serverFiles.set(serverFileId(file), file);
    }
    for (const [index, list] of found.entries()) {
      for (const file of list) {
        if (index % 2 === 0) {
          files.set(componentId(file), file);
        } else {
          serverFiles.set(serverFileId(file), file);
        }
      }
    }
    await analyze();
  };

  /**
   * The files of packages that the app reaches through its imports. A server
   * function of a package becomes an endpoint of the app only when the app
   * reaches its file, so installing a package does not expose all of them.
   */
  const reachable = (): Set<string> =>
    reachableFiles(
      packages,
      [...[...files.values()].filter((file) => !packageOf(packages, file)), ...appScripts],
      (file) => {
        try {
          return readFileSync(file, 'utf8');
        } catch {
          return undefined;
        }
      },
    );
  /** The files of packages in the last server registry. */
  let registered = new Set<string>();

  /** Resolves a `.brm` file that a component imports: next to it, or from a package of components. */
  const resolveComponent = (specifier: string, importer: string): string | undefined =>
    resolveRelative(specifier, importer) ??
    (specifier.endsWith('.brm') && isPackageSpecifier(specifier)
      ? resolvePackageImport(specifier, importer)
      : undefined);

  // Props are analyzed across the project, so a change to one file can change the output of others.
  const analyze = async (): Promise<void> => {
    const list = [...files.values()];
    const contents = await Promise.all(list.map((file) => readFile(file, 'utf8')));
    const sources = new Map(list.map((file, index) => [file, contents[index]!]));
    liveProps = analyzeProject(sources, resolveComponent);
    // The server functions that the app refreshes, from its components and its scripts.
    const scripts = await findScripts(root, exclude);
    const scriptSources = await Promise.all(
      [...new Set([...scripts, ...serverFiles.values()])].map((file) =>
        readFile(file, 'utf8').catch(() => ''),
      ),
    );
    refreshed = refreshedNames([...contents, ...scriptSources]);
    compiled.clear();
  };

  /** The options of the compile of a file. */
  const compileOptions = (file: string): CompileOptions => ({
    filename: nameOf(file),
    liveProps: liveProps.get(file),
    refreshed,
    path: file,
    merge: options.merge ?? DEFAULT_MERGE,
    a11y: options.a11y,
    // A build does not show the names of server functions in their IDs.
    hideNames: !isServe,
    sendableClasses: serialClasses(),
    serverImport: (specifier, name) => serverImport(file, specifier, name),
    // A module of reactive logic can come from a package of components.
    resolveModule: (specifier, importer) => {
      const local = resolveFromDisk(specifier, importer);
      const found =
        local === undefined && isPackageSpecifier(specifier)
          ? resolvePackageImport(specifier, importer)
          : undefined;
      return found ? { path: found, source: readFileSync(found, 'utf8') } : local;
    },
  });

  // The entry, the parts and the render module of a file come from one compile.
  const compileFile = async (file: string): Promise<{ source: string; result: CompileResult }> => {
    const source = await readFile(file, 'utf8');
    let cached = compiled.get(file);
    if (cached?.source !== source) {
      cached = { source, result: compile(source, compileOptions(file)) };
      compiled.set(file, cached);
      shapes.set(file, shapeOf(cached.result));
    }
    return cached;
  };

  /** The compiles whose imports were checked for the env file. */
  const envChecked = new WeakSet<CompileResult>();
  /**
   * Compiles a component again with the server variables of the env file,
   * when one of its imports resolves to it, by any specifier, such as an
   * alias. The compile fails when code that runs in the browser reads one.
   */
  const checkEnvReads = async (
    file: string,
    { source, result }: { source: string; result: CompileResult },
    resolve: (specifier: string, importer: string) => Promise<{ id: string } | null>,
  ): Promise<void> => {
    const env = envFile();
    if (!env || envChecked.has(result)) {
      return;
    }
    const specifiers = new Set<string>();
    for (const declaration of result.plan.graph.model.declarations) {
      if (declaration.imported) {
        specifiers.add(declaration.imported.source);
      }
    }
    const resolved = await Promise.all(
      [...specifiers].map(async (specifier) => {
        const found = await resolve(specifier, file);
        return found?.id.split('?')[0] === env ? specifier : undefined;
      }),
    );
    const imports = new Set(resolved.filter((specifier) => specifier !== undefined));
    if (imports.size > 0) {
      const server = serverEnvKeys() ?? [];
      compile(source, {
        ...compileOptions(file),
        envImport: (specifier) => (imports.has(specifier) ? server : undefined),
      });
    }
    envChecked.add(result);
  };

  const manifest = async (): Promise<string> => {
    const list = [...files];
    // A build leaves out the components that have no client code. The core treats a
    // component that `load` does not know as one with nothing to update. The dev server
    // keeps every component, because an edit can give one client code.
    const needed = await Promise.all(
      list.map(async ([, file]) => isServe || (await compileFile(file)).result.clientCode),
    );
    const kept = list.filter((_, index) => needed[index]);
    const entries = kept.map(
      ([id, file]) =>
        `  ${JSON.stringify(id)}: () => import(${JSON.stringify(`${file}${CLIENT_QUERY}`)}),`,
    );
    return [
      'const modules = {',
      ...entries,
      '};',
      'export function load(id) {',
      ...(isServe
        ? [
            '  const module = modules[id];',
            '  if (!module) {',
            '    throw new Error(`Unknown component "${id}"`);',
            '  }',
            '  return module();',
          ]
        : ['  return modules[id]?.();']),
      '}',
    ].join('\n');
  };

  /**
   * The module of every server function of the app, by ID. With `server`, in
   * a DOM test, it imports the server code of each file, which that
   * environment would give as browser code.
   */
  const serverRegistry = (server = false): string => {
    const query = server ? SERVER_QUERY : '';
    registered = packages.length > 0 ? reachable() : new Set();
    const keep = (file: string): boolean => registered.has(file) || !packageOf(packages, file);
    const components = [...files.values()].filter(keep);
    // In development, a file that does not compile leaves out its functions, and the pages that
    // import it show its error, so the other pages still work.
    const importAll = (prefix: string, list: string[]): string[] => {
      if (!isServe) {
        return list.map(
          (file, index) => `import * as ${prefix}${index} from ${JSON.stringify(file + query)};`,
        );
      }
      if (list.length === 0) {
        return [];
      }
      const loads = list.map((file) => `import(${JSON.stringify(file + query)})`);
      const names = list.map((_, index) => `${prefix}${index}`);
      return [
        `const [${names.join(', ')}] = (await Promise.allSettled([${loads.join(', ')}])).map((result) => (result.status === 'fulfilled' ? result.value : {}));`,
      ];
    };
    const imports = importAll('m', components);
    const spreads = components.map((_, index) => `  ...m${index}.rpc,`);
    // Each exported function of a file of server functions, under the ID that its stub calls.
    const functionFiles = [...serverFiles.entries()].filter(([, file]) => keep(file));
    const fileImports = importAll(
      'f',
      functionFiles.map(([, file]) => file),
    );
    // The middleware of a file runs before each of its functions.
    const guards: string[] = [];
    const fileSpreads = functionFiles.map(([id, file], index) => {
      // The IDs are written here, so a build can hash the names of the functions.
      const source = readFileSync(file, 'utf8');
      const names = serverExports(source, file);
      const guarded = hasServerMiddleware(source, file);
      return names
        .map((name) => {
          const key = JSON.stringify(functionId(id, name, !isServe));
          if (guarded) {
            guards.push(`  ${key}: f${index}.middleware,`);
          }
          return `  ${key}: f${index}[${JSON.stringify(name)}],`;
        })
        .join('\n');
    });
    const env = envFile();
    const entry = middlewareFile();
    return [
      // The variables are checked when the server starts, before anything else loads.
      ...(env ? [`import ${JSON.stringify(env)};`] : []),
      ...serialImports(),
      "import { handleRequest } from 'brumate/server';",
      ...(entry ? [`import middleware from ${JSON.stringify(entry)};`] : []),
      ...imports,
      ...fileImports,
      'export const functions = {',
      ...spreads,
      ...fileSpreads,
      '};',
      'export const fileMiddleware = {',
      ...guards,
      '};',
      'export function handle(request, options) {',
      `  return handleRequest(functions, request, ${JSON.stringify(rpc)}, { origins: ${JSON.stringify(options.origins ?? [])}, ${entry ? 'middleware, ' : ''}fileMiddleware${buildId === undefined ? '' : `, build: ${JSON.stringify(buildId)}`}, ...options });`,
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

  /**
   * The modules that every page loads early, which the client build wrote,
   * or none before a client build or in development.
   */
  const clientHints = (): string[] => {
    const file = path.join(clientBuildDirectory(root, options.prerender), HINTS_FILE);
    return !isServe && existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as string[]) : [];
  };

  /** The route tree module. A DOM test gets the server version of each component in it. */
  const routeTree = (server = false): string => {
    const env = envFile();
    const code = routeModule(
      currentRoutes(),
      (file) =>
        `${routesDirectory()}/${file}${server && file.endsWith('.brm') ? SERVER_QUERY : ''}`,
      rpc,
      options.origins,
      isServe,
      middlewareFile(),
      buildId,
      clientHints(),
    );
    // The variables are checked when the server starts, before any route loads.
    const serial = serialImports().join('\n');
    return [env ? `import ${JSON.stringify(env)};` : '', serial, code].filter(Boolean).join('\n');
  };

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
    const scopes: Record<number, { label: string; slots: string[]; readers: string[][] }> = {};
    // The code of the browser that reads each slot, such as a handler or an update, which is
    // why its value is in the page state, for the Page state tab.
    const siteLabel = (site: Site): string => {
      const at = result.locate(site.range.start);
      const where = at.file === undefined ? getLocation(source, at.offset) : undefined;
      return where ? `${site.label} ${where.line}:${where.column}` : site.label;
    };
    // Updates of markup and memos run in the browser as nodes of the graph that can change.
    const liveSites = new Set(
      [...plan.graph.live].flatMap((node) => ('site' in node ? [node.site] : [])),
    );
    for (const layout of plan.scopes.values()) {
      scopes[layout.scope.id] = {
        label: scopeLabel(result.file.source, layout.scope),
        slots: layout.slots.map((slot) => slot.name),
        readers: layout.slots.map((slot) => [
          ...new Set(
            slot.reads
              .filter((ref) => plan.graph.reached.has(ref.site) || liveSites.has(ref.site))
              .map((ref) => siteLabel(ref.site)),
          ),
        ]),
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
    // Each anchor of each scope: what it is, its place in the file and the values its updates
    // read, for the Elements tab, which finds them by the `b-b` of an element.
    const anchors: Record<
      number,
      Record<number, { label: string; at?: string; reads: string[] }>
    > = {};
    for (const [target, index] of plan.anchors) {
      const scope = plan.anchorScopes.get(target);
      if (!scope) {
        continue;
      }
      const at = result.locate('range' in target ? target.range.start : target.start);
      const where = at.file === undefined ? getLocation(source, at.offset) : undefined;
      const reads = new Set<string>();
      for (const edge of plan.graph.edges) {
        const node = edge.to;
        if (node.kind === 'source' || node.kind === 'memo') {
          continue;
        }
        const site = node.site;
        const range = !('range' in target) && target.kind === 'insert' ? target : undefined;
        if (
          site === target ||
          site.owner === target ||
          site.block === target ||
          (range && site.range.start >= range.start && site.range.end <= range.end)
        ) {
          if (edge.from.kind === 'source' || edge.from.kind === 'memo') {
            reads.add(edge.from.declaration.name);
          }
        }
      }
      // An insert that is the whole content of its element shares the element's anchor.
      const known = anchors[scope.id]?.[index];
      if (known) {
        known.reads = [...new Set([...known.reads, ...reads])];
        continue;
      }
      (anchors[scope.id] ??= {})[index] = {
        label: anchorLabel(target),
        ...(where ? { at: `${where.line}:${where.column}` } : {}),
        reads: [...reads],
      };
    }
    const text = formatReport(report(source, result, liveProps.get(file)));
    return {
      name: plan.name,
      file: nameOf(file),
      // The absolute path, for the editor, and the URL that the browser loads the code from.
      path: file,
      url: file.startsWith(`${normalizePath(root)}/`)
        ? file.slice(normalizePath(root).length)
        : `/@fs${file}`,
      scopes,
      anchors,
      graph,
      text,
    };
  };

  /** The components of the app for the workbench, with what each one needs and its controls. */
  /**
   * The stories of a component: the named exports of the `.stories.ts` file next to it, each a
   * set of props. Values that JSON cannot hold, such as functions, are left out.
   */
  const workbenchStories = async (
    server: ViteDevServer,
    file: string,
  ): Promise<{ stories: { name: string; props: unknown }[]; storiesError?: string }> => {
    const storiesFile = file.replace(/\.brm$/, '.stories.ts');
    if (!existsSync(storiesFile)) {
      return { stories: [] };
    }
    try {
      const module = (await server.ssrLoadModule(storiesFile)) as Record<string, unknown>;
      const stories = Object.entries(module)
        .filter(([name, props]) => name !== 'default' && props && typeof props === 'object')
        .map(([name, props]) => ({ name, props: JSON.parse(JSON.stringify(props)) as unknown }));
      return { stories };
    } catch (error) {
      return { stories: [], storiesError: error instanceof Error ? error.message : String(error) };
    }
  };

  /** The group of a component of a package: its name, and the folder under the directory of its files. */
  const packageGroup = (owner: BrumatePackage, file: string): string => {
    const directory = owner.directories.find((item) => file.startsWith(`${item}/`)) ?? owner.root;
    const folder = path.posix.dirname(file.slice(directory.length + 1));
    return folder === '.' ? owner.name : `${owner.name}/${folder}`;
  };

  const workbenchComponents = async (server: ViteDevServer): Promise<unknown[]> => {
    const routes = `${routesDirectory()}/`;
    const list = [...new Set(files.values())];
    const contents = await Promise.all(list.map((file) => readFile(file, 'utf8')));
    const sources = new Map(list.map((file, index) => [file, contents[index]!]));
    const classes = classifyComponents(sources, {
      resolve: resolveComponent,
      serverImport: (file, specifier, name) => serverImport(file, specifier, name) !== undefined,
    });
    const relative = (file: string): string => normalizePath(path.relative(root, file));
    const shown = list.filter((file) => !file.startsWith(routes) && classes.has(file));
    const stories = await Promise.all(shown.map((file) => workbenchStories(server, file)));
    return shown
      .map((file, index) => {
        const found = classes.get(file)!;
        let controls: unknown[] = [];
        try {
          controls = propControls(parseComponent(sources.get(file)!, { filename: file }));
        } catch {
          // The compile of the file reports the error.
        }
        // A component of a package is grouped under the name of the package, and the others by
        // their folder.
        const owner = packageOf(packages, file);
        return {
          file: relative(file),
          group: owner ? packageGroup(owner, file) : path.posix.dirname(relative(file)),
          // The name that the page shows: the import of a component of a package, or its path.
          label: owner ? `${packageGroup(owner, file)}/${path.basename(file)}` : relative(file),
          name: path.basename(file, '.brm'),
          selfContained: found.selfContained,
          needs: found.needs.map((need) => ({ ...need, via: need.via && relative(need.via) })),
          controls,
          ...stories[index],
        };
      })
      .sort((a, b) => a.file.localeCompare(b.file));
  };

  /**
   * Answers the workbench: its page, the list of components, and the frame that renders one
   * component on the server with props, and resumes it in the browser as a page does.
   */
  const serveWorkbench = async (
    server: ViteDevServer,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === WORKBENCH || url.pathname === `${WORKBENCH}/`) {
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(workbenchPage(WORKBENCH));
      return;
    }
    if (url.pathname === `${WORKBENCH}/components`) {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(await workbenchComponents(server)));
      return;
    }
    if (url.pathname !== `${WORKBENCH}/frame`) {
      response.statusCode = 404;
      response.end();
      return;
    }
    // Only a component of the app, by its path from the root.
    const asked = url.searchParams.get('file') ?? '';
    const file = [...files.values()].find(
      (candidate) => normalizePath(path.relative(root, candidate)) === asked,
    );
    if (!file) {
      response.statusCode = 404;
      response.end(`Unknown component "${asked}"`);
      return;
    }
    response.setHeader('content-type', 'text/html; charset=utf-8');
    try {
      const props = JSON.parse(url.searchParams.get('props') || '{}') as Record<string, unknown>;
      const component = (await server.ssrLoadModule(file)).default;
      const { renderToStream } = await server.ssrLoadModule('brumate/server');
      const stream = (renderToStream as typeof RenderToStream)(component, props, {
        start: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${path.basename(file, '.brm')}</title></head><body>`,
        end: '</body></html>',
        // The client of Vite and the loader, as the entry of an app starts it.
        scripts: `<script type="module" src="/@vite/client"></script><script type="module" src="/@id/__x00__${START}"></script>`,
      });
      const reader = stream.getReader();
      for (;;) {
        // oxlint-disable-next-line no-await-in-loop -- The page streams in order.
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        response.write(value);
      }
      response.end();
    } catch (error) {
      response.statusCode = 500;
      response.end(errorPage(error, server));
    }
  };

  const handleDevRPC = async (
    server: ViteDevServer,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    const id = decodeURIComponent((request.url ?? '').slice(rpc.length + 1).split('?')[0]!);
    const owner = id.split('#')[0]!;
    const file = files.get(owner) ?? serverFiles.get(owner);
    // A file of a package that the app does not reach has no endpoints, as in production.
    const reached = file && packageOf(packages, file) ? reachable() : undefined;
    if (!file || (reached && !reached.has(file))) {
      response.statusCode = 404;
      response.end(`Unknown server function "${id}"`);
      return;
    }
    // The app reached the file after the registry loaded, such as with a new import.
    if (reached && !registered.has(file)) {
      const module = server.moduleGraph.getModuleById(`\0${SERVER}`);
      if (module) {
        server.moduleGraph.invalidateModule(module);
      }
    }
    try {
      // Every server function of the app, as in production, so `event.refresh` can name a
      // function of another file, such as a component's call that refreshes a 'use server' file.
      const { handle } = await server.ssrLoadModule(SERVER);
      // The same path as production, so server functions can read the request.
      const webRequest = new Request(new URL(request.url ?? '/', 'http://localhost'), {
        method: 'POST',
        headers: Object.entries(request.headers).flatMap(([name, value]) =>
          value === undefined ? [] : [[name, String(value)] as [string, string]],
        ),
        body: new Uint8Array(await readBody(request)),
      });
      const began = performance.now();
      const answer: Response = await handle(webRequest, {
        address: request.socket.remoteAddress,
      });
      // How long the server function took on the server, for the Timeline of the devtools.
      answer.headers.append(
        'server-timing',
        `brumate;dur=${(performance.now() - began).toFixed(1)};desc="server function"`,
      );
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

  /** Updates the page in the browser after a change to a component, or reloads it. */
  async function updateClient(
    file: string,
    server: ViteDevServer,
    timestamp: number,
  ): Promise<[] | undefined> {
    const normalized = normalizePath(file);
    const targets = file.endsWith('.brm') ? [normalized] : [...(dependents.get(normalized) ?? [])];
    if (targets.length === 0) {
      return undefined;
    }
    // A resumed page cannot run a component again. When an edit keeps the markup, the slots
    // and the update table of each changed component, the page keeps its state: new styles
    // replace the old ones, and the next event loads the new code. When the markup changes,
    // the page renders again, and the signals of the component keep their values. A file
    // that does not compile reloads the page, which shows the error.
    const invalidate = (): void => {
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
    };
    const reload = (): [] => {
      invalidate();
      server.ws.send({ type: 'full-reload' });
      return [];
    };
    await analyze();
    const updates: HotUpdate[] = [];
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
      if (!before) {
        return reload();
      }
      const remount = before.layout !== after.layout;
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
        url: before.code === after.code && !remount ? undefined : entry?.url,
        remount: remount
          ? {
              before: before.slots,
              after: after.slots,
              signals: after.signals.filter((name) => before.signals.includes(name)),
            }
          : undefined,
      });
    }
    if (updates.some((update) => update.remount)) {
      // The server renders the page again with the new markup.
      invalidate();
    }
    server.ws.send({ type: 'custom', event: 'brumate:update', data: { updates, timestamp } });
    return [];
  }

  /**
   * The config that packages of components need. Vite must not pre-bundle them,
   * or their `.brm` and `'use server'` files would not reach this plugin, and the
   * server build compiles them instead of importing them from `node_modules`.
   */
  const packageConfig = (config: UserConfig): UserConfig => {
    if (packages.length === 0) {
      return {};
    }
    const names = [...new Set(packages.map((item) => item.name))];
    const result: UserConfig = {
      optimizeDeps: { exclude: names },
      ssr: { noExternal: names },
      // The components of a package and the app share one copy of the runtime.
      resolve: { dedupe: ['brumate'] },
    };
    // The dev server serves files of the workspace. A linked package outside it is allowed too.
    const workspace = normalizePath(searchForWorkspaceRoot(path.resolve(config.root ?? '.')));
    const outside = packages
      .filter((item) => item.root !== workspace && !item.root.startsWith(`${workspace}/`))
      .map((item) => item.root);
    if (outside.length > 0) {
      // A list of allowed directories turns off Vite's own, so it names the workspace too.
      result.server = { fs: { allow: [workspace, ...outside] } };
    }
    return result;
  };

  /** The module ID of `brumate/client`, and the chunks of the loader and the core in a client build. */
  let coreModule: string | undefined;
  let loaderChunk: string | undefined;
  let coreChunk: string | undefined;

  const plugin: Plugin & { configureVitest(context: VitestContext): void } = {
    name: 'brumate',
    enforce: 'pre',

    config(config, env) {
      packages = findPackages(path.resolve(config.root ?? process.cwd()));
      const shared = packageConfig(config);
      // The devtools show the errors of Vite, so its overlay does not cover them.
      const hmr = config.server?.hmr;
      if (
        env.command === 'serve' &&
        options.devtools !== false &&
        hmr !== false &&
        (typeof hmr !== 'object' || hmr.overlay === undefined)
      ) {
        shared.server = { hmr: { overlay: false } };
      }
      if (!env.isSsrBuild) {
        const preload = config.build?.modulePreload;
        // The files of earlier builds stay, and the build removes the ones that are too old itself.
        const keep = options.skew?.keep ? { build: { emptyOutDir: false } } : {};
        if (preload === false) {
          return { ...shared, ...keep };
        }
        const resolve = typeof preload === 'object' ? preload.resolveDependencies : undefined;
        return {
          ...shared,
          build: {
            ...keep.build,
            modulePreload: {
              // The loader imports the core itself when it imports a component's module, so
              // it needs no list of the chunks to preload with it, which it would ship.
              resolveDependencies(filename, deps, context) {
                const list = resolve ? resolve(filename, deps, context) : deps;
                if (context.hostId !== loaderChunk || !coreChunk) {
                  return list;
                }
                const rest = list.filter((dep) => dep !== coreChunk);
                return rest.length === 1 && rest[0] === filename ? [] : rest;
              },
            },
          },
        };
      }
      // The server build gets the route handler as an entry of its own, to render the pages with.
      if (!options.prerender) {
        return shared;
      }
      // `--ssr <file>` names the entry, and wins over the input of the config, which can be the client's.
      const ssr = config.build?.ssr;
      const input = typeof ssr === 'string' ? ssr : config.build?.rolldownOptions?.input;
      let entries: Record<string, string>;
      if (typeof input === 'string') {
        entries = { [path.basename(input).replace(/\.[^.]+$/, '')]: input };
      } else if (Array.isArray(input)) {
        entries = Object.fromEntries(
          input.map((item) => [path.basename(item).replace(/\.[^.]+$/, ''), item]),
        );
      } else {
        entries = { ...(input as Record<string, string> | undefined) };
      }
      return {
        ...shared,
        build: { ssr: true, rolldownOptions: { input: { ...entries, [PRERENDER_ENTRY]: ROUTES } } },
      };
    },

    // Vitest keeps transformed modules between runs. Its cache key does not
    // cover the compiler, so a new build of brumate would reuse old output.
    configureVitest(context: VitestContext) {
      const define =
        context.defineCacheKeyGenerator ?? context.experimental_defineCacheKeyGenerator;
      define?.(buildFingerprint);
    },

    configResolved(config) {
      root = config.root;
      isServe = config.command === 'serve';
      outDir = path.resolve(config.root, config.build.outDir);
      base = config.base;
      isSsrBuild = Boolean(config.build.ssr);
    },

    async generateBundle(_output, bundle) {
      if (isSsrBuild) {
        return;
      }
      // Vite lists the chunks to preload after this hook, with `resolveDependencies` above.
      loaderChunk = undefined;
      coreChunk = undefined;
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk') {
          continue;
        }
        if (item.moduleIds.includes(`\0${MANIFEST}`)) {
          loaderChunk = item.fileName;
        }
        if (coreModule && item.moduleIds.includes(coreModule)) {
          coreChunk = item.fileName;
        }
      }
      if (!options.report && !options.budget) {
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
            modules: Object.fromEntries(
              Object.entries(item.modules).map(([id, module]) => [id, module.renderedLength]),
            ),
          });
        }
      }
      const list = [...files.values()];
      const contents = await Promise.all(list.map((file) => readFile(file, 'utf8')));
      // Each handler of a component, by the label that `brumate inspect` shows.
      const events: ReportEvent[] = [];
      for (const [file, { source, result }] of compiled) {
        for (const [site, symbol] of result.plan.symbols) {
          const loads = result.loaders[symbol];
          if (loads) {
            const { line, column } = getLocation(source, site.range.start);
            events.push({ file, label: `${site.label} (${line}:${column})`, parts: loads });
          }
        }
      }
      const measured = buildReport({
        chunks,
        sources: new Map(list.map((file, index) => [file, contents[index]!])),
        routes: existsSync(routesDirectory())
          ? { tree: currentRoutes(), resolve: (file) => `${routesDirectory()}/${file}` }
          : undefined,
        events,
        budget: options.budget,
        relative: nameOf,
      });
      if (options.report) {
        this.info(`\n${formatBuildReport(measured, nameOf)}`);
      }
      if (measured.overBudget.length > 0) {
        this.error(measured.overBudget.join('\n'));
      }
    },

    async writeBundle(_output, bundle) {
      if (!isSsrBuild) {
        // The modules that every page loads early, for the `Link` headers of the server build.
        const chunks = new Map(
          Object.values(bundle).flatMap((item) =>
            item.type === 'chunk' ? [[item.fileName, item] as const] : [],
          ),
        );
        const hints = new Set<string>();
        const add = (name: string | undefined): void => {
          const chunk = name === undefined ? undefined : chunks.get(name);
          if (chunk && !hints.has(chunk.fileName)) {
            hints.add(chunk.fileName);
            chunk.imports.forEach(add);
          }
        };
        add(loaderChunk);
        add(coreChunk);
        await mkdir(path.join(outDir, '.brumate'), { recursive: true });
        await writeFile(
          path.join(outDir, HINTS_FILE),
          JSON.stringify([...hints].map((name) => `${base}${name}`)),
        );
        if (buildId !== undefined) {
          const written = Object.values(bundle).map((item) => item.fileName);
          const removed = pruneBuilds(outDir, buildId, written, options.skew?.keep ?? 0);
          if (removed.length > 0) {
            this.info(`Removed the files of ${removed.length} older builds`);
          }
        }
        return;
      }
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
      if (!isServe) {
        if (isSsrBuild) {
          // The server build names the build of the client, which must come first.
          const client = clientBuildDirectory(root, options.prerender);
          buildId = process.env.BRUMATE_BUILD || readBuildId(client);
          if (buildId === undefined) {
            this.warn(
              `No ${BUILD_FILE} in ${path.relative(root, client)}, so the server does not know its build ID. Build the client first, or set BRUMATE_BUILD, for skew protection`,
            );
          }
        } else {
          buildId =
            process.env.BRUMATE_BUILD || `${Date.now().toString(36)}${hash(String(Math.random()))}`;
        }
      }
      coreModule = isServe
        ? undefined
        : (await this.resolve('brumate/client', path.join(root, 'index.html')))?.id;
      await scan();
      writeRouteTypes();
    },

    async resolveId(id, importer, resolveOptions) {
      if (id === START || id === MANIFEST || id === SERVER || id === ROUTES || id === TESTING) {
        return `\0${id}`;
      }
      // In code that the browser loads, only components import the env file, because the
      // compiler checks that their browser code reads no server variable. It cannot check scripts.
      const env = resolveOptions?.ssr ? undefined : envFile();
      const from = importer?.split('?')[0];
      if (
        env &&
        importer &&
        from &&
        from !== env &&
        isScriptFile(from) &&
        !importer.startsWith('\0') &&
        !importer.includes(SERVER_QUERY) &&
        !importer.includes('/node_modules/')
      ) {
        const resolved = await this.resolve(id, importer, { ...resolveOptions, skipSelf: true });
        if (resolved?.id.split('?')[0] === env) {
          this.error(
            `${relative(from)} imports ${relative(env)}, and the browser loads it. Only components can import the env file in code that the browser loads, because the compiler checks what they read. Read the variable in a component or a server function, and pass the value on.`,
          );
        }
        return resolved ?? undefined;
      }
      // In a DOM test, the server version of a component, a file of server functions, or the
      // registry imports the server code of a file of server functions, not its stubs. Other
      // modules stay as they are, so the test and the server code share one copy of each.
      if (
        resolveOptions?.ssr ||
        !importer ||
        (!importer.includes(SERVER_QUERY) &&
          importer !== `\0${SERVER}` &&
          importer !== `\0${ROUTES}`) ||
        id.includes(SERVER_QUERY)
      ) {
        return undefined;
      }
      const resolved = await this.resolve(id, importer, { ...resolveOptions, skipSelf: true });
      if (
        !resolved ||
        resolved.external ||
        resolved.id.includes('?') ||
        (resolved.id.includes('/node_modules/') && !packageOf(packages, resolved.id))
      ) {
        return resolved;
      }
      const file = resolved.id;
      return isScriptFile(file) && existsSync(file) && hasUseServer(readFileSync(file, 'utf8'))
        ? { ...resolved, id: `${file}${SERVER_QUERY}` }
        : resolved;
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
          // Without client navigation, the bundle leaves its code out.
          options.navigate === false
            ? "import { startWithoutNavigation as start } from 'brumate/static-loader';"
            : "import { start } from 'brumate/loader';",
          `import { load } from ${JSON.stringify(MANIFEST)};`,
          // On the dev server, an edit of a component can update the page without a reload.
          ...(isServe ? ["import { hotLoad } from 'brumate/hot';"] : []),
          `start({ load${isServe ? ': hotLoad(import.meta.hot, load)' : ''}${serialFile() ? `, serial: () => import(${JSON.stringify(serialFile())})` : ''}, rpc: ${JSON.stringify(rpc)}, navigate: ${JSON.stringify(options.navigate ?? true)}${options.preload === false ? ', preload: false' : ''}${buildId === undefined ? '' : `, build: ${JSON.stringify(buildId)}`} });`,
          // The devtools listen to the core before it starts. Only the dev server has them.
          ...(isServe && options.devtools !== false
            ? [
                // They show the errors of Vite, such as a compile error after an edit, in place of its overlay.
                `import('brumate/devtools').then((m) => m.installDevtools(${JSON.stringify(INSPECT)}, ${JSON.stringify(rpc)}, ${JSON.stringify({ version: BRUMATE_VERSION, vite: viteVersion })}, import.meta.hot));`,
              ]
            : []),
        ].join('\n');
      }
      if (id === `\0${MANIFEST}`) {
        return await manifest();
      }
      if (id === `\0${SERVER}`) {
        // A DOM test gets the server code of each file too, so its calls can run in the test.
        return serverRegistry(!loadOptions?.ssr);
      }
      if (id === `\0${ROUTES}`) {
        return routeTree(!loadOptions?.ssr);
      }
      if (id === `\0${TESTING}`) {
        const entry = middlewareFile();
        return [
          "import { answerCalls as answer, createMount, createVisit } from 'brumate/testing';",
          `import { load } from ${JSON.stringify(MANIFEST)};`,
          ...(entry ? [`import middleware from ${JSON.stringify(entry)};`] : []),
          `export const mount = createMount({ load, rpc: ${JSON.stringify(rpc)} });`,
          // The routes and the server code load on the first visit, so a test of components skips them.
          'export const visit = createVisit({',
          '  load,',
          `  rpc: ${JSON.stringify(rpc)},`,
          `  routes: async () => (await import(${JSON.stringify(ROUTES)})).handle,`,
          `  calls: async () => (await import(${JSON.stringify(SERVER)})).handle,`,
          '});',
          // The server code of the app loads on the first call, so a test that makes none skips it.
          'export function answerCalls(options) {',
          `  const server = import(${JSON.stringify(SERVER)});`,
          `  return answer(async () => (await server).functions, { rpc: ${JSON.stringify(rpc)}, ${entry ? 'middleware, ' : ''}fileMiddleware: async () => (await server).fileMiddleware, ...options });`,
          '}',
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
      let output: Awaited<ReturnType<typeof compileFile>>;
      try {
        output = await compileFile(file);
        await checkEnvReads(file, output, (specifier, importer) =>
          this.resolve(specifier, importer),
        );
      } catch (error) {
        // The overlay shows the file, the line and the lines around it.
        const { message, frame, loc } = errorPayload(error, root);
        // The file of a package is not under the root, which `errorPayload` resolves its name against.
        this.error({ message, frame, loc: loc && { ...loc, file }, id: file });
      }
      const { source, result } = output;
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
        this.warn(`${warning.message} (${nameOf(file)}:${line}:${column})`);
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
      // The browser gets the env file without the server variables, and with the values of the
      // public ones, read now.
      if (file && !transformOptions?.ssr && file === envFile()) {
        try {
          return { code: clientEnvModule(code, file, process.env), map: null };
        } catch (error) {
          this.error((error as Error).message);
        }
      }
      // A file of server functions: the browser gets stubs that call the server instead.
      if (file && isScriptFile(file) && hasUseServer(code)) {
        try {
          const fileId = serverFileId(normalizePath(file));
          // The server runs the file, with calls while a page renders sharing their results.
          if (transformOptions?.ssr) {
            return { code: serverModule(code, file, fileId), map: null };
          }
          // A DOM test imports the server code with the query, which Vite strips no types for.
          if (id.includes(SERVER_QUERY)) {
            let lang: 'ts' | 'tsx' | 'jsx' = 'jsx';
            if (/\.[cm]?ts$/.test(file)) {
              lang = 'ts';
            } else if (file.endsWith('.tsx')) {
              lang = 'tsx';
            }
            const result = await transformWithOxc(serverModule(code, file, fileId), file, {
              lang,
              sourcemap: true,
            });
            return { code: result.code, map: result.map };
          }
          return { code: serverStubs(code, file, fileId, !isServe), map: null };
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
      // Vite watches the root. An edit of a linked package, such as one of a workspace, updates the page too.
      const linked = packages.filter((item) => item.linked).flatMap((item) => item.directories);
      if (linked.length > 0) {
        server.watcher.add(linked);
      }
      // A change to the dependencies of the app, or to a package's `brumate` field, can change
      // the packages, and with them the config of Vite, so the server restarts.
      const manifests = [
        path.join(root, 'package.json'),
        ...packages.map((item) => `${item.root}/package.json`),
      ].map((file) => normalizePath(file));
      server.watcher.add(manifests);
      server.watcher.on('change', (file) => {
        if (
          manifests.includes(normalizePath(file)) &&
          packagesKey(findPackages(root)) !== packagesKey(packages)
        ) {
          void server.restart();
        }
      });
      server.watcher.on('all', (event, file) => {
        // The names of the server variables are part of what each component compiles with.
        if (normalizePath(file) === envFile()) {
          compiled.clear();
        }
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
          if (packages.length > 0 && !packageOf(packages, normalized)) {
            appScripts = appScripts.filter((item) => item !== normalized);
            if (event !== 'unlink') {
              appScripts.push(normalized);
            }
          }
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
        // When the server code runs in Vite, the plugin answers calls with it. A framework that
        // runs it elsewhere, such as Nitro in a worker, answers them in its own server entry.
        const ssr = server.environments.ssr;
        if (
          request.method === 'POST' &&
          request.url?.startsWith(`${rpc}/`) &&
          ssr &&
          isRunnableDevEnvironment(ssr)
        ) {
          void handleDevRPC(server, request, response);
          return;
        }
        // The source of a file that an error names, for the code of the Errors tab. Only files
        // that Vite would serve, by its `server.fs` options.
        if (request.method === 'GET' && request.url?.startsWith(`${SOURCE}?`)) {
          const asked = new URL(request.url, 'http://localhost').searchParams.get('file') ?? '';
          const file = normalizePath(
            path.isAbsolute(asked) && existsSync(asked)
              ? asked
              : path.join(server.config.root, asked),
          );
          if (!existsSync(file) || !isFileLoadingAllowed(server.config, file)) {
            response.statusCode = 404;
            response.end();
            return;
          }
          response.setHeader('content-type', 'text/plain; charset=utf-8');
          response.end(readFileSync(file, 'utf8'));
          return;
        }
        if (request.method === 'GET' && request.url?.startsWith(`${POSITION}?`)) {
          const params = new URL(request.url, 'http://localhost').searchParams;
          void server.environments.client.moduleGraph
            .getModuleByUrl(params.get('url') ?? '')
            .then((module) => {
              const map = module?.transformResult?.map as
                | { sources: (string | null)[]; mappings: string }
                | null
                | undefined;
              const place =
                map && module?.file
                  ? originalPosition(map, Number(params.get('line')), Number(params.get('column')))
                  : undefined;
              // A source that starts with `/` is a path from the root of the app, as Vite writes it.
              const file =
                place &&
                normalizePath(
                  place.source.startsWith('/') && !existsSync(place.source)
                    ? path.join(server.config.root, place.source)
                    : path.resolve(path.dirname(module!.file!), place.source),
                );
              response.setHeader('content-type', 'application/json');
              response.end(JSON.stringify(place ? { ...place, file } : null));
            })
            .catch(next);
          return;
        }
        if (request.method === 'GET' && request.url?.startsWith(WORKBENCH)) {
          void serveWorkbench(server, request, response).catch(next);
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

    // A server environment that runs apart from Vite, such as Nitro's worker, keeps the code
    // of components it loaded. A change to a component or to a file that one reads, such as
    // a stylesheet, reloads its server code, so the next render uses the new code.
    async hotUpdate({ file, server, timestamp }) {
      const environment = this.environment;
      if (environment.config.consumer === 'client') {
        return updateClient(file, server, timestamp);
      }
      const normalized = normalizePath(file);
      if (
        !file.endsWith('.brm') &&
        !dependents.has(normalized) &&
        normalized !== middlewareFile() &&
        normalized !== envFile()
      ) {
        // A module that the server code imports, such as data or Markdown that a page renders,
        // changes the HTML of the page, and the browser has no code that could update it. Vite
        // invalidates the module for the next render, and the page reloads to get it.
        if (environment.moduleGraph.getModulesByFile(normalized)?.size) {
          server.environments.client.hot.send({ type: 'full-reload' });
        }
        return undefined;
      }
      const invalidated = new Set<EnvironmentModuleNode>();
      for (const module of environment.moduleGraph.idToModuleMap.values()) {
        const id = module.id ?? '';
        if (id.includes('.brm') || id.startsWith('\0virtual:brumate')) {
          environment.moduleGraph.invalidateModule(module, invalidated, timestamp, true);
        }
      }
      environment.hot.send({ type: 'full-reload' });
      return [];
    },
  };
  return plugin;
}
export { errorPage } from './dev-error.ts';
export type {
  ManifestChunk,
  PrerenderManifest,
  PrerenderOptions,
  PrerenderedPage,
} from './prerender.ts';
export type { Budget, BuildReport } from './report.ts';
