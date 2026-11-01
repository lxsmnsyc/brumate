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
  findPackageServerFile,
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
import { analyzeProject, importedComponents, resolveRelative } from './project.ts';
import {
  allFeatures,
  getFeatures,
  joinFeatures,
  readsFeatures,
  writeFeatures,
} from './features.ts';
import type { Features } from './features.ts';
import { BUILD_FILE, clientBuildDirectory, pruneBuilds, readBuildId } from './builds.ts';
import {
  findPackages,
  packageFileName,
  findPackage,
  reachableFiles,
  resolveComponentPackage,
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
   * The features of the core that the client build keeps. By default it leaves out the code of
   * those that no component of the build uses, such as `#template` values that the browser
   * calls. `'all'` keeps every feature, for an app that compiles components in the browser.
   */
  features?: 'used' | 'all';
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
/** How many files a build reads or compiles at once, so a large project does not run out of file handles. */
const BATCH = 32;

/** Runs `run` for each item, one batch at a time. */
async function inBatches<T, R>(list: T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < list.length; start += BATCH) {
    const batch: Promise<R>[] = [];
    for (const item of list.slice(start, start + BATCH)) {
      batch.push(run(item));
    }
    // oxlint-disable-next-line no-await-in-loop -- Each batch waits for the one before, to bound open files.
    results.push(...(await Promise.all(batch)));
  }
  return results;
}

const START = 'virtual:brumate/start';
/** Exports `load(id)`, which imports the client module of a component. */
const MANIFEST = 'virtual:brumate/manifest';
/** `virtual:brumate/bundle/<id>` imports the client modules of a root component and those it renders. */
const BUNDLE = 'virtual:brumate/bundle/';
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
/** The ID of the module of Vite's preload helper, which a client build gets from `preloadHelper`. */
const PRELOAD_HELPER = '\0vite/preload-helper.js';

/**
 * Vite's preload helper wraps every `import()` of a client build and preloads the scripts and
 * the stylesheets of the chunk. This one waits for the stylesheets only, so a lazy chunk shows
 * styled, and preloads the imports of the chunk. The scripts of a page come with the `Link`
 * headers of the server (see `hints`).
 */
function preloadHelper(base: string, relative: boolean): string {
  return [
    `export const __vitePreload = (load, deps, from) => {`,
    `  const links = [];`,
    `  for (const dep of deps || []) {`,
    `    const href = ${relative ? 'new URL(dep, from)' : `new URL(${JSON.stringify(base)} + dep, location.href)`}.href;`,
    `    const rel = dep.endsWith('.css') ? 'stylesheet' : 'modulepreload';`,
    `    let found = false;`,
    `    for (const link of document.getElementsByTagName('link')) {`,
    `      found ||= link.rel === rel && link.href === href;`,
    `    }`,
    `    if (!found) {`,
    `      const link = document.createElement('link');`,
    `      link.rel = rel;`,
    `      link.crossOrigin = '';`,
    `      link.href = href;`,
    `      document.head.appendChild(link);`,
    `      // A script loads along with the chunk, so only a stylesheet is waited for.`,
    `      if (rel === 'stylesheet') {`,
    `        links.push(new Promise((resolve, reject) => {`,
    `          link.onload = resolve;`,
    `          link.onerror = reject;`,
    `        }));`,
    `      }`,
    `    }`,
    `  }`,
    `  return Promise.all(links).then(load);`,
    `};`,
  ].join('\n');
}

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
  const rows: unknown[][] = [];
  for (const item of list) {
    rows.push([item.prefix, item.root, item.directories]);
  }
  return JSON.stringify(rows);
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
function getMarkup(result: CompileResult): string {
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

function getShape(result: CompileResult): Shape {
  const labels: string[] = [];
  const slots: Record<number, string[]> = {};
  const signals: string[] = [];
  for (const layout of result.plan.scopes.values()) {
    const names: string[] = [];
    for (const slot of layout.slots) {
      names.push(slot.name);
      if (slot.kind === 'signal') {
        signals.push(slot.name);
      }
    }
    labels.push(`${layout.scope.id}:${names.join(',')}`);
    slots[layout.scope.id] = names;
  }
  return {
    layout: JSON.stringify([result.table, labels, getMarkup(result)]),
    css: result.css,
    // The entry of a small component holds its code too.
    code: JSON.stringify([result.client, result.parts]),
    slots,
    signals,
  };
}

/** What Vitest passes to `configureVitest`, the part that this plugin uses. */
interface VitestContext {
  defineCacheKeyGenerator?: (generate: CacheKeyGenerator) => void;
  experimental_defineCacheKeyGenerator?: (generate: CacheKeyGenerator) => void;
}

/** Makes a part of Vitest's cache key of a module, or returns false to keep it out of the cache. */
type CacheKeyGenerator = (context: { id: string }) => string | false;

/**
 * The cache key of a module for Vitest: the hash of this build of brumate. A component is never
 * cached, because its code depends on other files, such as the `.brm.ts` modules that it calls
 * and the props that other components pass it. A key of its own source would go stale.
 */
function cacheKey({ id }: { id: string }): string | false {
  return id.split('?')[0]!.endsWith('.brm') ? false : buildFingerprint();
}

let fingerprint: string | undefined;

/**
 * A hash of the code of this build of brumate. A new build can compile the
 * same `.brm` file to other code, so the hash is part of Vitest's cache key.
 */
function buildFingerprint(): string {
  if (fingerprint === undefined) {
    const digest = createHash('sha1');
    function visit(directory: string): void {
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
    }
    visit(path.dirname(fileURLToPath(import.meta.url)));
    fingerprint = digest.digest('hex').slice(0, 16);
  }
  return fingerprint;
}

/** The Vite plugin for `.brm` files. */
export default function brumate(options: BrumateOptions = {}): Plugin {
  const rpc = options.rpc ?? '/_brumate';
  /** The entry middleware, when the app has one. */
  function middlewareFile(): string | undefined {
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
  }
  /** The serial entry, when the app has one. */
  function serialFile(): string | undefined {
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
  }
  /** The classes that the plugins of the serial entry send, read from its `instanceof` checks. */
  let serialRead: { source: string; classes: string[] } | undefined;
  function serialClasses(): string[] {
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
  }
  /** The lines that give the server the serial entry, before anything is written or read. */
  function serialImports(): string[] {
    const file = serialFile();
    return file
      ? [
          `import * as $$serial from ${JSON.stringify(file)};`,
          "import { useSerialEntry } from 'brumate/server';",
          'useSerialEntry($$serial);',
        ]
      : [];
  }
  /** The file of environment variables, when the app has one. */
  function envFile(): string | undefined {
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
  }
  /** The names of the server variables, read from the env file, by its source. */
  let envKeys: { source: string; server: string[] } | undefined;
  function serverEnvKeys(): string[] | undefined {
    const file = envFile();
    if (!file) {
      return undefined;
    }
    const source = readFileSync(file, 'utf8');
    if (envKeys?.source !== source) {
      envKeys = { source, server: parseEnvFile(source, file).server };
    }
    return envKeys.server;
  }
  const exclude = options.exclude ?? defaultExclude;
  let root = process.cwd();
  let outDir = '';
  /** The ID of the build, for skew protection. Undefined on the dev server. */
  let buildId: string | undefined;
  let base = '/';
  /** Whether a build writes URLs that need the URL of the importing chunk to resolve. */
  let relativeUrls = false;
  let isSsrBuild = false;
  let isServe = false;
  /** Component IDs to absolute file paths. */
  const files = new Map<string, string>();
  const compiled = new Map<string, { source: string; result: CompileResult }>();
  /** Files that a component depends on, such as SCSS that it imports or modules that it calls into, with the components. */
  const dependents = new Map<string, Set<string>>();
  /** What the browser has of each component, from its last compile. See `getShape`. */
  const shapes = new Map<string, Shape>();
  /** The props that parents can change, by absolute file path. */
  let liveProps = new Map<string, Set<string>>();
  /** The names of the server functions that the app refreshes, or undefined before the first scan. */
  let refreshed: Set<string> | undefined;

  /** The dependencies of the app that ship `.brm` files. See `packages.ts`. */
  let packages: BrumatePackage[] = [];

  // The ID is computed from the path relative to the root, so it is the same on every machine.
  function relative(file: string): string {
    return normalizePath(path.relative(root, file));
  }
  /**
   * The name of a file, which its IDs come from: its path relative to the root,
   * or for a file of a package, the name of the package and its path in it.
   */
  function getFileName(file: string): string {
    let normalized = normalizePath(file);
    let owner = findPackage(packages, normalized);
    // With `resolve.preserveSymlinks`, Vite names a file of a package by its link.
    if (!owner && normalized.includes('/node_modules/') && existsSync(normalized)) {
      normalized = normalizePath(realpathSync(normalized));
      owner = findPackage(packages, normalized);
    }
    return owner ? packageFileName(owner, normalized) : relative(file);
  }
  /** Files of server functions: scripts whose first statement is `'use server'`, by ID. */
  const serverFiles = new Map<string, string>();
  /** The scripts of the app, when it uses packages of components. */
  let appScripts: string[] = [];
  /** The ID of a function that a component imports from a 'use server' file, by a relative path. */
  function serverImport(importer: string, specifier: string, name: string): string | undefined {
    // A package of components can export a file of server functions.
    if (!specifier.startsWith('.')) {
      const file = findPackageServerFile(packages, importer, specifier);
      return file ? functionId(serverFileId(file), name, !isServe) : undefined;
    }
    const stem = path.resolve(path.dirname(importer), specifier);
    const candidates = [stem];
    for (const extension of ['.ts', '.tsx', '.js', '.mjs']) {
      candidates.push(stem + extension);
    }
    let found: string | undefined;
    for (const candidate of candidates) {
      if (
        isScriptFile(candidate) &&
        existsSync(candidate) &&
        hasUseServer(readFileSync(candidate, 'utf8'))
      ) {
        found = candidate;
        break;
      }
    }
    return found && functionId(serverFileId(normalizePath(found)), name, !isServe);
  }

  function serverFileId(file: string): string {
    return `${path.basename(file).replace(/\.[^.]+$/, '')}_${hash(getFileName(file))}`;
  }
  function componentId(file: string): string {
    const filename = getFileName(file);
    return `${getComponentName(filename)}_${hash(filename)}`;
  }

  async function scan(): Promise<void> {
    const directories: string[] = [];
    for (const item of packages) {
      for (const directory of item.directories) {
        if (existsSync(directory)) {
          directories.push(directory);
        }
      }
    }
    // A package inside the root, such as one of a workspace, is found once, as a package.
    function ownFile(file: string): boolean {
      return !findPackage(packages, file);
    }
    const searches = [findFiles(root, exclude), findServerFiles(root, exclude)];
    for (const directory of directories) {
      searches.push(
        findFiles(directory, packageExclude),
        findServerFiles(directory, packageExclude),
      );
    }
    const [own, ownServer, ...found] = await Promise.all(searches);
    // The scripts of the app, which can import files of packages.
    // The list is assigned once, after the search, so a lookup during the search sees the last one.
    const scripts: string[] = [];
    if (packages.length > 0) {
      for (const file of await findScripts(root, exclude)) {
        if (ownFile(file)) {
          scripts.push(file);
        }
      }
    }
    appScripts = scripts;
    files.clear();
    serverFiles.clear();
    for (const file of own!) {
      if (ownFile(file)) {
        files.set(componentId(file), file);
      }
    }
    for (const file of ownServer!) {
      if (ownFile(file)) {
        serverFiles.set(serverFileId(file), file);
      }
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
    try {
      await analyze();
    } finally {
      // A list of the workbench made while the scan ran has the files from before it.
      workbenchList = undefined;
    }
  }

  /**
   * The files of packages that the app reaches through its imports. A server
   * function of a package becomes an endpoint of the app only when the app
   * reaches its file, so installing a package does not expose all of them.
   */
  function reachable(): Set<string> {
    const roots: string[] = [];
    for (const file of files.values()) {
      if (!findPackage(packages, file)) {
        roots.push(file);
      }
    }
    return reachableFiles(packages, [...roots, ...appScripts], (file) => {
      try {
        return readFileSync(file, 'utf8');
      } catch {
        return undefined;
      }
    });
  }
  /** The files of packages in the last server registry. */
  let registered = new Set<string>();

  /** Resolves a `.brm` file that a component imports: next to it, or from a package of components. */
  function resolveComponent(specifier: string, importer: string): string | undefined {
    return (
      resolveRelative(specifier, importer) ??
      (specifier.endsWith('.brm')
        ? resolveComponentPackage(packages, specifier, importer)
        : undefined)
    );
  }

  // Props are analyzed across the project, so a change to one file can change the output of others.
  async function analyze(): Promise<void> {
    const list = [...files.values()];
    const contents = await inBatches(list, (file) => readFile(file, 'utf8'));
    const sources = new Map<string, string>();
    for (const [index, file] of list.entries()) {
      sources.set(file, contents[index]!);
    }
    liveProps = analyzeProject(sources, resolveComponent);
    // The server functions that the app refreshes, from its components and its scripts.
    const scripts = await findScripts(root, exclude);
    const scriptSources = await inBatches(
      [...new Set([...scripts, ...serverFiles.values()])],
      (file) => readFile(file, 'utf8').catch(() => ''),
    );
    refreshed = refreshedNames([...contents, ...scriptSources]);
    compiled.clear();
  }

  /** The features of the core that the components of the build use, once for each build. */
  let builtFeatures: Promise<Features> | undefined;
  /** The files that `builtFeatures` counted, and the features it found. */
  let counted = new Set<string>();
  let knownFeatures: Features | undefined;
  /** The components that the client build loaded. */
  const loadedComponents = new Set<string>();
  function buildFeatures(): Promise<Features> {
    return (builtFeatures ??= (async () => {
      const seen = new Set<string>();
      const all: Features[] = [];
      // The files of the scan, and the components they import from outside it, such as a file
      // of a sibling folder or of a package with no `brumate` field.
      async function visit(file: string): Promise<void> {
        if (seen.has(file)) {
          return;
        }
        seen.add(file);
        const { result } = await compileFile(file);
        all.push(getFeatures(result));
        const imported: string[] = [];
        for (const specifier of importedComponents(result.file)) {
          const target = resolveComponent(specifier, file);
          if (target !== undefined && existsSync(target)) {
            imported.push(target);
          }
        }
        await inBatches(imported, visit);
      }
      await inBatches([...files.values()], visit);
      const features = joinFeatures(all);
      // Client navigation inserts the pages that it loads, and a route with `_loading.brm`
      // streams its body after the page.
      let loading = false;
      for (const file of seen) {
        if (path.basename(file) === '_loading.brm') {
          loading = true;
          break;
        }
      }
      features.lateMarkup ||= options.navigate !== false || loading;
      counted = seen;
      knownFeatures = features;
      return features;
    })());
  }

  /** The options of the compile of a file. */
  function compileOptions(file: string): CompileOptions {
    return {
      filename: getFileName(file),
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
          local === undefined ? resolveComponentPackage(packages, specifier, importer) : undefined;
        return found ? { path: found, source: readFileSync(found, 'utf8') } : local;
      },
    };
  }

  // The entry, the parts and the render module of a file come from one compile.
  async function compileFile(file: string): Promise<{ source: string; result: CompileResult }> {
    const source = await readFile(file, 'utf8');
    let cached = compiled.get(file);
    if (cached?.source !== source) {
      cached = { source, result: compile(source, compileOptions(file)) };
      compiled.set(file, cached);
      shapes.set(file, getShape(cached.result));
    }
    return cached;
  }

  /** The compiles whose imports were checked for the env file. */
  const envChecked = new WeakSet<CompileResult>();
  /**
   * Compiles a component again with the server variables of the env file,
   * when one of its imports resolves to it, by any specifier, such as an
   * alias. The compile fails when code that runs in the browser reads one.
   */
  async function checkEnvReads(
    file: string,
    { source, result }: { source: string; result: CompileResult },
    resolve: (specifier: string, importer: string) => Promise<{ id: string } | null>,
  ): Promise<void> {
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
    const pending: Promise<string | undefined>[] = [];
    for (const specifier of specifiers) {
      pending.push(
        (async () => {
          const found = await resolve(specifier, file);
          return found?.id.split('?')[0] === env ? specifier : undefined;
        })(),
      );
    }
    const imports = new Set<string>();
    for (const specifier of await Promise.all(pending)) {
      if (specifier !== undefined) {
        imports.add(specifier);
      }
    }
    if (imports.size > 0) {
      const server = serverEnvKeys() ?? [];
      compile(source, {
        ...compileOptions(file),
        envImport: (specifier) => (imports.has(specifier) ? server : undefined),
      });
    }
    envChecked.add(result);
  }

  /** The components that a component imports, by file. */
  async function componentImports(file: string): Promise<string[]> {
    const { result } = await compileFile(file);
    const found: string[] = [];
    for (const declaration of result.plan.graph.model.declarations) {
      const source = declaration.imported?.source;
      const target = source?.endsWith('.brm') ? resolveComponent(source, file) : undefined;
      if (target !== undefined) {
        found.push(target);
      }
    }
    return found;
  }

  /**
   * The bundles of a build: for each component that no other component imports, such as a
   * route or a page, the components with client code that it can render. The page loads the
   * bundles of its roots at once, as one chunk each, so its code comes in one request.
   * Components that only import each other get a bundle too.
   */
  async function bundles(kept: Set<string>): Promise<Map<string, string[]>> {
    const imports = new Map<string, string[]>();
    await inBatches([...files.values()], async (file) => {
      try {
        imports.set(file, await componentImports(file));
      } catch {
        imports.set(file, []);
      }
    });
    const imported = new Set<string>();
    for (const targets of imports.values()) {
      for (const target of targets) {
        imported.add(target);
      }
    }
    const result = new Map<string, string[]>();
    // The components that a bundle holds so far.
    const reached = new Set<string>();
    function addRoot(id: string, file: string): void {
      const seen = new Set<string>();
      function walk(current: string): void {
        if (seen.has(current)) {
          return;
        }
        seen.add(current);
        reached.add(current);
        for (const next of imports.get(current) ?? []) {
          walk(next);
        }
      }
      walk(file);
      const members: string[] = [];
      for (const member of seen) {
        if (kept.has(member)) {
          members.push(member);
        }
      }
      if (members.length > 0) {
        result.set(id, members);
      }
    }
    for (const [id, file] of files) {
      if (!imported.has(file)) {
        addRoot(id, file);
      }
    }
    // Components that import each other, with no other component that imports them, have no
    // root of their own, so the first of them is the root of their bundle.
    for (const [id, file] of files) {
      if (!reached.has(file) && kept.has(file)) {
        addRoot(id, file);
      }
    }
    return result;
  }

  /** The ID of each component file. */
  function findComponentId(file: string): string | undefined {
    for (const [id, other] of files) {
      if (other === file) {
        return id;
      }
    }
    return undefined;
  }

  /** A bundle module: the client modules of a root component and of those it renders. */
  async function bundleModule(root: string): Promise<string> {
    const list = [...files];
    const needed = await inBatches(
      list,
      async ([, file]) => (await compileFile(file)).result.clientCode,
    );
    const kept = new Set<string>();
    for (const [index, [, file]] of list.entries()) {
      if (needed[index]) {
        kept.add(file);
      }
    }
    const members = (await bundles(kept)).get(root) ?? [];
    // Each module is a plain object of its exports. A namespace object, from `import * as`,
    // would make the bundler write a getter for each export.
    const imports: string[] = [];
    const objects: string[] = [];
    for (const [index, file] of members.entries()) {
      const { result } = await compileFile(file);
      const codes = [result.client];
      for (const [name, code] of Object.entries(result.parts)) {
        if (name !== 'shared') {
          codes.push(code);
        }
      }
      const names = exportNames(codes);
      const aliased: string[] = [];
      const fields: string[] = [];
      for (const name of names) {
        aliased.push(`${name} as $$c${index}_${name}`);
        fields.push(`${name}: $$c${index}_${name}`);
      }
      imports.push(
        `import { ${aliased.join(', ')} } from ${JSON.stringify(`${file}${CLIENT_QUERY}`)};`,
      );
      objects.push(`  ${JSON.stringify(findComponentId(file))}: { ${fields.join(', ')} },`);
    }
    return [...imports, 'export const modules = {', ...objects, '};'].join('\n');
  }

  async function manifest(): Promise<string> {
    const list = [...files];
    // A build leaves out the components that have no client code. The core treats a
    // component that `load` does not know as one with nothing to update. The dev server
    // keeps every component, because an edit can give one client code.
    const needed = await inBatches(
      list,
      async ([, file]) => isServe || (await compileFile(file)).result.clientCode,
    );
    const kept: [string, string][] = [];
    for (const [index, entry] of list.entries()) {
      if (needed[index]) {
        kept.push(entry);
      }
    }
    if (!isServe) {
      // A build loads code by bundles of roots, so each component's code is in the chunk of
      // the page instead of a chunk of its own.
      const keptFiles = new Set<string>();
      for (const [, file] of kept) {
        keptFiles.add(file);
      }
      const groups = await bundles(keptFiles);
      const owners = new Map<string, string>();
      for (const [root, members] of groups) {
        for (const member of members) {
          const id = findComponentId(member);
          // A root that no earlier bundle holds is its own owner, which the table leaves out.
          if (id !== undefined && !owners.has(id)) {
            owners.set(id, root);
          }
        }
      }
      for (const [id, root] of owners) {
        if (id === root) {
          owners.delete(id);
        }
      }
      const bundleLines: string[] = [];
      for (const root of groups.keys()) {
        bundleLines.push(
          `  ${JSON.stringify(root)}: () => import(${JSON.stringify(`${BUNDLE}${root}`)}),`,
        );
      }
      return [
        'const bundles = {',
        ...bundleLines,
        '};',
        `const owners = ${JSON.stringify(Object.fromEntries(owners))};`,
        'const loaded = new Map();',
        'const pending = new Map();',
        '/** Loads the bundle of a root component of the page. Undefined for a component that is not a root. */',
        'export function loadBundle(root) {',
        '  let promise = pending.get(root);',
        '  if (!promise && bundles[root]) {',
        '    promise = bundles[root]().then((bundle) => {',
        '      for (const [id, module] of Object.entries(bundle.modules)) {',
        '        loaded.set(id, module);',
        '      }',
        '    });',
        '    pending.set(root, promise);',
        '    promise.catch(() => pending.delete(root));',
        '  }',
        '  return promise;',
        '}',
        '/** The client module of a component, from the bundles of the page, or else from a bundle that holds it. */',
        'export function load(id) {',
        '  if (loaded.has(id)) {',
        '    return Promise.resolve(loaded.get(id));',
        '  }',
        '  const waiting = [...pending.values()];',
        '  const root = owners[id] ?? (bundles[id] && id);',
        '  const owner = () => (loaded.has(id) || !root ? loaded.get(id) : loadBundle(root).then(() => loaded.get(id)));',
        '  return waiting.length > 0 ? Promise.allSettled(waiting).then(owner) : root ? owner() : undefined;',
        '}',
      ].join('\n');
    }
    const entries: string[] = [];
    for (const [id, file] of kept) {
      entries.push(
        `  ${JSON.stringify(id)}: () => import(${JSON.stringify(`${file}${CLIENT_QUERY}`)}),`,
      );
    }
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
  }

  /**
   * The module of every server function of the app, by ID. With `server`, in
   * a DOM test, it imports the server code of each file, which that
   * environment would give as browser code.
   */
  function serverRegistry(server = false): string {
    const query = server ? SERVER_QUERY : '';
    registered = packages.length > 0 ? reachable() : new Set();
    function keep(file: string): boolean {
      return registered.has(file) || !findPackage(packages, file);
    }
    const components: string[] = [];
    for (const file of files.values()) {
      if (keep(file)) {
        components.push(file);
      }
    }
    // In development, a file that does not compile leaves out its functions, and the pages that
    // import it show its error, so the other pages still work.
    function importAll(prefix: string, list: string[]): string[] {
      if (!isServe) {
        const lines: string[] = [];
        for (const [index, file] of list.entries()) {
          lines.push(`import * as ${prefix}${index} from ${JSON.stringify(file + query)};`);
        }
        return lines;
      }
      if (list.length === 0) {
        return [];
      }
      const loads: string[] = [];
      const names: string[] = [];
      for (const [index, file] of list.entries()) {
        loads.push(`import(${JSON.stringify(file + query)})`);
        names.push(`${prefix}${index}`);
      }
      return [
        `const [${names.join(', ')}] = (await Promise.allSettled([${loads.join(', ')}])).map((result) => (result.status === 'fulfilled' ? result.value : {}));`,
      ];
    }
    const imports = importAll('m', components);
    const spreads: string[] = [];
    for (const index of components.keys()) {
      spreads.push(`  ...m${index}.rpc,`);
    }
    // Each exported function of a file of server functions, under the ID that its stub calls.
    const functionFiles: [string, string][] = [];
    for (const entry of serverFiles) {
      if (keep(entry[1])) {
        functionFiles.push(entry);
      }
    }
    const functionPaths: string[] = [];
    for (const [, file] of functionFiles) {
      functionPaths.push(file);
    }
    const fileImports = importAll('f', functionPaths);
    // The middleware of a file runs before each of its functions.
    const guards: string[] = [];
    const fileSpreads: string[] = [];
    for (const [index, [id, file]] of functionFiles.entries()) {
      // The IDs are written here, so a build can hash the names of the functions.
      const source = readFileSync(file, 'utf8');
      const names = serverExports(source, file);
      const guarded = hasServerMiddleware(source, file);
      const lines: string[] = [];
      for (const name of names) {
        const key = JSON.stringify(functionId(id, name, !isServe));
        if (guarded) {
          guards.push(`  ${key}: f${index}.middleware,`);
        }
        lines.push(`  ${key}: f${index}[${JSON.stringify(name)}],`);
      }
      fileSpreads.push(lines.join('\n'));
    }
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
  }

  function routesDirectory(): string {
    return normalizePath(path.resolve(root, options.routes ?? 'src/routes'));
  }

  /** The route files, from the `.brm` files found and the `.ts` files of the directory. */
  function currentRoutes(): RouteFiles {
    const directory = routesDirectory();
    const paths: string[] = [];
    for (const file of files.values()) {
      if (file.startsWith(`${directory}/`)) {
        paths.push(file.slice(directory.length + 1));
      }
    }
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
  }

  /**
   * The modules that every page loads early, which the client build wrote,
   * or none before a client build or in development.
   */
  function clientHints(): { all: string[]; bundles: Record<string, string[]> } {
    const file = path.join(clientBuildDirectory(root, options.prerender), HINTS_FILE);
    if (isServe || !existsSync(file)) {
      return { all: [], bundles: {} };
    }
    const read = JSON.parse(readFileSync(file, 'utf8')) as
      | string[]
      | { all: string[]; bundles: Record<string, string[]> };
    return Array.isArray(read) ? { all: read, bundles: {} } : read;
  }

  /** The route tree module. A DOM test gets the server version of each component in it. */
  function routeTree(server = false): string {
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
      clientHints().all,
      clientHints().bundles,
    );
    // The variables are checked when the server starts, before any route loads.
    const serial = serialImports().join('\n');
    const parts: string[] = [];
    for (const part of [env ? `import ${JSON.stringify(env)};` : '', serial, code]) {
      if (part) {
        parts.push(part);
      }
    }
    return parts.join('\n');
  }

  /** Writes the paths of the routes as types for `href`, when they changed. */
  function writeRouteTypes(): void {
    if (options.routeTypes === false || !existsSync(routesDirectory())) {
      return;
    }
    const file = path.resolve(root, options.routeTypes ?? 'src/brumate-routes.d.ts');
    const text = routeTypes(currentRoutes());
    if (!existsSync(file) || readFileSync(file, 'utf8') !== text) {
      writeFileSync(file, text);
    }
  }

  /** What the devtools panel shows about a component: its name, its scopes and its report. */
  async function inspectComponent(id: string): Promise<object | undefined> {
    const file = files.get(id);
    if (!file) {
      return undefined;
    }
    const { source, result } = await compileFile(file);
    const { plan } = result;
    const scopes: Record<number, { label: string; slots: string[]; readers: string[][] }> = {};
    // The code of the browser that reads each slot, such as a handler or an update, which is
    // why its value is in the page state, for the Page state tab.
    function siteLabel(site: Site): string {
      const at = result.locate(site.range.start);
      const where = at.file === undefined ? getLocation(source, at.offset) : undefined;
      return where ? `${site.label} ${where.line}:${where.column}` : site.label;
    }
    // Updates of markup and memos run in the browser as nodes of the graph that can change.
    const liveSites = new Set<Site>();
    for (const node of plan.graph.live) {
      if ('site' in node) {
        liveSites.add(node.site);
      }
    }
    for (const layout of plan.scopes.values()) {
      const slotNames: string[] = [];
      const readers: string[][] = [];
      for (const slot of layout.slots) {
        slotNames.push(slot.name);
        const labels = new Set<string>();
        for (const ref of slot.reads) {
          if (plan.graph.reached.has(ref.site) || liveSites.has(ref.site)) {
            labels.add(siteLabel(ref.site));
          }
        }
        readers.push([...labels]);
      }
      scopes[layout.scope.id] = {
        label: scopeLabel(result.file.source, layout.scope),
        slots: slotNames,
        readers,
      };
    }
    // The nodes that can change in the browser, with the slot of each value, so the panel
    // can mark a node when its slot is written.
    const nodes: (typeof plan.graph.nodes)[number][] = [];
    const indexes = new Map<(typeof nodes)[number], number>();
    for (const node of plan.graph.nodes) {
      if (plan.graph.live.has(node)) {
        indexes.set(node, nodes.length);
        nodes.push(node);
      }
    }
    const graphNodes: object[] = [];
    for (const node of nodes) {
      if (node.kind === 'source' || node.kind === 'memo') {
        graphNodes.push({
          kind: node.kind === 'memo' ? 'memo' : node.declaration.kind,
          label: node.declaration.name,
          scope: instanceScope(plan, node.declaration.scope).id,
          slot: slotIndex(plan, node.declaration),
        });
        continue;
      }
      // Markup has no name, so its place in the file tells nodes apart, such as `insert 9:42`.
      // Code that a module function gave the component has no place in the component's file.
      const at = result.locate(node.site.range.start);
      const where = at.file === undefined ? getLocation(source, at.offset) : undefined;
      graphNodes.push({
        kind: node.kind,
        label: where ? `${node.site.label} ${where.line}:${where.column}` : node.site.label,
        scope: instanceScope(plan, node.site.scope).id,
      });
    }
    const graphEdges: number[][] = [];
    for (const edge of plan.graph.edges) {
      if (indexes.has(edge.from) && indexes.has(edge.to)) {
        graphEdges.push([indexes.get(edge.from)!, indexes.get(edge.to)!]);
      }
    }
    const graph = { nodes: graphNodes, edges: graphEdges };
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
      file: getFileName(file),
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
  }

  /** The components of the app for the workbench, with what each one needs and its controls. */
  /**
   * The stories of a component: the named exports of the `.stories.ts` file next to it, each a
   * set of props. Values that JSON cannot hold, such as functions, are left out.
   */
  async function workbenchStories(
    server: ViteDevServer,
    file: string,
  ): Promise<{ stories: { name: string; props: unknown }[]; storiesError?: string }> {
    const storiesFile = file.replace(/\.brm$/, '.stories.ts');
    if (!existsSync(storiesFile)) {
      return { stories: [] };
    }
    try {
      const module = (await server.ssrLoadModule(storiesFile)) as Record<string, unknown>;
      const stories: { name: string; props: unknown }[] = [];
      for (const [name, props] of Object.entries(module)) {
        if (name !== 'default' && props && typeof props === 'object') {
          stories.push({ name, props: JSON.parse(JSON.stringify(props)) as unknown });
        }
      }
      return { stories };
    } catch (error) {
      return { stories: [], storiesError: error instanceof Error ? error.message : String(error) };
    }
  }

  /** The group of a component of a package: its name, and the folder under the directory of its files. */
  function packageGroup(owner: BrumatePackage, file: string): string {
    let directory = owner.root;
    for (const item of owner.directories) {
      if (file.startsWith(`${item}/`)) {
        directory = item;
        break;
      }
    }
    const folder = path.posix.dirname(file.slice(directory.length + 1));
    return folder === '.' ? owner.name : `${owner.name}/${folder}`;
  }

  async function workbenchComponents(
    server: ViteDevServer,
  ): Promise<{ file: string; selfContained: boolean; [key: string]: unknown }[]> {
    const routes = `${routesDirectory()}/`;
    const list = [...new Set(files.values())];
    const contents = await inBatches(list, (file) => readFile(file, 'utf8'));
    const sources = new Map<string, string>();
    for (const [index, file] of list.entries()) {
      sources.set(file, contents[index]!);
    }
    const classes = classifyComponents(sources, {
      resolve: resolveComponent,
      serverImport: (file, specifier, name) => serverImport(file, specifier, name) !== undefined,
    });
    function relative(file: string): string {
      return normalizePath(path.relative(root, file));
    }
    const shown: string[] = [];
    for (const file of list) {
      if (!file.startsWith(routes) && classes.has(file)) {
        shown.push(file);
      }
    }
    const stories = await inBatches(shown, (file) => workbenchStories(server, file));
    const components: { file: string; selfContained: boolean; [key: string]: unknown }[] = [];
    for (const [index, file] of shown.entries()) {
      const found = classes.get(file)!;
      let controls: unknown[] | undefined = [];
      try {
        controls = propControls(parseComponent(sources.get(file)!, { filename: file }));
      } catch {
        // The compile of the file reports the error. The page says that it has no controls.
        controls = undefined;
      }
      // A component of a package is grouped under the name of the package, and the others by
      // their folder.
      const owner = findPackage(packages, file);
      const needs: (typeof found.needs)[number][] = [];
      for (const need of found.needs) {
        needs.push({ ...need, via: need.via && relative(need.via) });
      }
      components.push({
        file: relative(file),
        group: owner ? packageGroup(owner, file) : path.posix.dirname(relative(file)),
        // The name that the page shows: the import of a component of a package, or its path.
        label: owner ? `${packageGroup(owner, file)}/${path.basename(file)}` : relative(file),
        name: path.basename(file, '.brm'),
        selfContained: found.selfContained,
        needs,
        controls: controls ?? [],
        unreadProps: controls === undefined,
        ...stories[index],
      });
    }
    return components.toSorted((a, b) => a.file.localeCompare(b.file));
  }

  // The last list of the workbench. A frame renders on each change of a prop, so it reads this
  // list, and a change of a file clears it.
  let workbenchList: ReturnType<typeof workbenchComponents> | undefined;

  /** Makes the list of the workbench and keeps it, unless it fails, so a later read tries again. */
  function listWorkbench(server: ViteDevServer): ReturnType<typeof workbenchComponents> {
    const list = workbenchComponents(server);
    workbenchList = list;
    list.catch(() => {
      if (workbenchList === list) {
        workbenchList = undefined;
      }
    });
    return list;
  }

  /**
   * Answers the workbench: its page, the list of components, and the frame that renders one
   * component on the server with props, and resumes it in the browser as a page does.
   */
  async function serveWorkbench(
    server: ViteDevServer,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === WORKBENCH || url.pathname === `${WORKBENCH}/`) {
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(workbenchPage(WORKBENCH));
      return;
    }
    if (url.pathname === `${WORKBENCH}/components`) {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(await listWorkbench(server)));
      return;
    }
    if (url.pathname !== `${WORKBENCH}/frame`) {
      response.statusCode = 404;
      response.end();
      return;
    }
    // Only a component that the workbench lists as self-contained, by its path from the root.
    // Any other renders without the request, the route or the server that it needs, and fails.
    const asked = url.searchParams.get('file') ?? '';
    let listed = false;
    for (const component of await (workbenchList ?? listWorkbench(server))) {
      if (component.file === asked && component.selfContained) {
        listed = true;
        break;
      }
    }
    let file: string | undefined;
    if (listed) {
      for (const candidate of files.values()) {
        if (normalizePath(path.relative(root, candidate)) === asked) {
          file = candidate;
          break;
        }
      }
    }
    if (!file) {
      response.statusCode = 404;
      response.end(`No self-contained component "${asked}"`);
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
      // Once the page has started, its status is sent, and a second document would land inside
      // the first. The error goes to the terminal, and the page ends where it stopped.
      if (response.headersSent) {
        server.config.logger.error(
          error instanceof Error ? (error.stack ?? error.message) : String(error),
        );
        response.end();
        return;
      }
      response.statusCode = 500;
      response.end(errorPage(error, server));
    }
  }

  async function handleDevRPC(
    server: ViteDevServer,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const id = decodeURIComponent((request.url ?? '').slice(rpc.length + 1).split('?')[0]!);
    const owner = id.split('#')[0]!;
    const file = files.get(owner) ?? serverFiles.get(owner);
    // A file of a package that the app does not reach has no endpoints, as in production.
    const reached = file && findPackage(packages, file) ? reachable() : undefined;
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
      const headers: [string, string][] = [];
      for (const [name, value] of Object.entries(request.headers)) {
        if (value !== undefined) {
          headers.push([name, String(value)]);
        }
      }
      const webRequest = new Request(new URL(request.url ?? '/', 'http://localhost'), {
        method: 'POST',
        headers,
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
  }

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
    function invalidate(): void {
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
    }
    function reload(): [] {
      invalidate();
      server.ws.send({ type: 'full-reload' });
      return [];
    }
    await analyze();
    const updates: HotUpdate[] = [];
    for (const target of targets) {
      const before = shapes.get(target);
      let after: Shape;
      try {
        // oxlint-disable-next-line no-await-in-loop -- The first component that cannot update in place reloads the page.
        after = getShape((await compileFile(target)).result);
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
      let entry: (typeof modules)[number] | undefined;
      for (const module of server.moduleGraph.getModulesByFile(target) ?? []) {
        if (module.id?.endsWith(CLIENT_QUERY)) {
          entry = module;
          break;
        }
      }
      const kept: string[] = [];
      for (const name of after.signals) {
        if (before.signals.includes(name)) {
          kept.push(name);
        }
      }
      updates.push({
        id,
        css: before.css === after.css ? undefined : after.css,
        url: before.code === after.code && !remount ? undefined : entry?.url,
        remount: remount
          ? {
              before: before.slots,
              after: after.slots,
              signals: kept,
            }
          : undefined,
      });
    }
    let remounts = false;
    for (const update of updates) {
      if (update.remount) {
        remounts = true;
        break;
      }
    }
    if (remounts) {
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
  function packageConfig(config: UserConfig): UserConfig {
    if (packages.length === 0) {
      return {};
    }
    const nameSet = new Set<string>();
    for (const item of packages) {
      nameSet.add(item.name);
    }
    const names = [...nameSet];
    const result: UserConfig = {
      optimizeDeps: { exclude: names },
      ssr: { noExternal: names },
      // The components of a package and the app share one copy of the runtime.
      resolve: { dedupe: ['brumate'] },
    };
    // The dev server serves files of the workspace. A linked package outside it is allowed too.
    const workspace = normalizePath(searchForWorkspaceRoot(path.resolve(config.root ?? '.')));
    const outside: string[] = [];
    for (const item of packages) {
      if (item.root !== workspace && !item.root.startsWith(`${workspace}/`)) {
        outside.push(item.root);
      }
    }
    if (outside.length > 0) {
      // A list of allowed directories turns off Vite's own, so it names the workspace too.
      result.server = { fs: { allow: [workspace, ...outside] } };
    }
    return result;
  }

  /** The module ID of `brumate/client`, and the chunks of the loader and the core in a client build. */
  let coreModule: string | undefined;
  let loaderChunk: string | undefined;
  let coreChunk: string | undefined;
  /** The chunks that the loader and the core import, which the server hints at, and the chunks of the bundles. */
  let startChunks = new Set<string>();
  let bundleChunks = new Set<string>();

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
        return {
          ...shared,
          build: {
            ...keep.build,
            modulePreload: {
              ...(typeof preload === 'object' ? preload : {}),
              // The replacement of Vite's preload helper (`PRELOAD_HELPER`) waits for stylesheets
              // only. The server sends the hints for the scripts of the page and of the bundles,
              // so the build lists the imports of the other lazy chunks only, which the helper
              // preloads without waiting, so a chunk and its imports load together.
              resolveDependencies(filename, deps) {
                if (bundleChunks.has(filename)) {
                  return [];
                }
                const rest: string[] = [];
                for (const dep of deps) {
                  if (dep !== filename && !startChunks.has(dep)) {
                    rest.push(dep);
                  }
                }
                return rest;
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
        entries = {};
        for (const item of input) {
          entries[path.basename(item).replace(/\.[^.]+$/, '')] = item;
        }
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
      define?.(cacheKey);
    },

    configResolved(config) {
      root = config.root;
      isServe = config.command === 'serve';
      outDir = path.resolve(config.root, config.build.outDir);
      base = config.base;
      relativeUrls =
        config.base === './' || config.base === '' || !!config.experimental.renderBuiltUrl;
      isSsrBuild = Boolean(config.build.ssr);
    },

    async generateBundle(_output, bundle) {
      if (isSsrBuild) {
        return;
      }
      // The core has no code for the features that the counted components do not use, so a
      // component that the count did not reach must not need more of them.
      for (const file of knownFeatures ? loadedComponents : []) {
        if (counted.has(file)) {
          continue;
        }
        const used = getFeatures((await compileFile(file)).result);
        const missing: (keyof Features)[] = [];
        for (const name of Object.keys(used) as (keyof Features)[]) {
          if (used[name] && !knownFeatures![name]) {
            missing.push(name);
          }
        }
        if (missing.length > 0) {
          this.error(
            `${getFileName(file)} uses ${missing.join(', ')}, which the client build left out of the core, since no component that the build found uses them. Import it from a .brm component of the app, or set \`features: 'all'\`.`,
          );
        }
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
      startChunks = new Set();
      bundleChunks = new Set();
      function addStart(name: string | undefined): void {
        const found = name === undefined ? undefined : bundle[name];
        if (found?.type === 'chunk' && !startChunks.has(name!)) {
          startChunks.add(name!);
          for (const imported of found.imports) {
            addStart(imported);
          }
        }
      }
      addStart(loaderChunk);
      addStart(coreChunk);
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk' && item.facadeModuleId?.startsWith(`\0${BUNDLE}`)) {
          bundleChunks.add(item.fileName);
        }
      }
      if (!options.report && !options.budget) {
        return;
      }
      const chunks: ReportChunk[] = [];
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk') {
          const modules: Record<string, number> = {};
          for (const [id, module] of Object.entries(item.modules)) {
            modules[id] = module.renderedLength;
          }
          chunks.push({
            fileName: item.fileName,
            code: item.code,
            isEntry: item.isEntry,
            imports: item.imports,
            moduleIds: item.moduleIds,
            modules,
          });
        }
      }
      const list = [...files.values()];
      const contents = await inBatches(list, (file) => readFile(file, 'utf8'));
      const sources = new Map<string, string>();
      for (const [index, file] of list.entries()) {
        sources.set(file, contents[index]!);
      }
      const measured = buildReport({
        chunks,
        sources,
        routes: existsSync(routesDirectory())
          ? { tree: currentRoutes(), resolve: (file) => `${routesDirectory()}/${file}` }
          : undefined,
        budget: options.budget,
        relative: getFileName,
      });
      if (options.report) {
        this.info(`\n${formatBuildReport(measured, getFileName)}`);
      }
      if (measured.overBudget.length > 0) {
        this.error(measured.overBudget.join('\n'));
      }
    },

    async writeBundle(_output, bundle) {
      if (!isSsrBuild) {
        // The modules that every page loads early, for the `Link` headers of the server build.
        const chunks = new Map<string, Extract<(typeof bundle)[string], { type: 'chunk' }>>();
        for (const item of Object.values(bundle)) {
          if (item.type === 'chunk') {
            chunks.set(item.fileName, item);
          }
        }
        const hints = new Set<string>();
        function add(name: string | undefined): void {
          const chunk = name === undefined ? undefined : chunks.get(name);
          if (chunk && !hints.has(chunk.fileName)) {
            hints.add(chunk.fileName);
            for (const imported of chunk.imports) {
              add(imported);
            }
          }
        }
        add(loaderChunk);
        add(coreChunk);
        // The chunks of the bundle of each root, which its pages load early too.
        const bundleHints: Record<string, string[]> = {};
        for (const chunk of chunks.values()) {
          const facade = chunk.facadeModuleId ?? '';
          if (!facade.startsWith(`\0${BUNDLE}`)) {
            continue;
          }
          const files = new Set<string>();
          function walk(name: string): void {
            const found = chunks.get(name);
            if (found && !files.has(name) && !hints.has(name)) {
              files.add(name);
              for (const imported of found.imports) {
                walk(imported);
              }
            }
          }
          walk(chunk.fileName);
          const urls: string[] = [];
          for (const name of files) {
            urls.push(`${base}${name}`);
          }
          bundleHints[facade.slice(BUNDLE.length + 1)] = urls;
        }
        await mkdir(path.join(outDir, '.brumate'), { recursive: true });
        const all: string[] = [];
        for (const name of hints) {
          all.push(`${base}${name}`);
        }
        await writeFile(
          path.join(outDir, HINTS_FILE),
          JSON.stringify({ all, bundles: bundleHints }),
        );
        if (buildId !== undefined) {
          const written: string[] = [];
          for (const item of Object.values(bundle)) {
            written.push(item.fileName);
          }
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
      let chunk: (typeof bundle)[string] | undefined;
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk' && item.isEntry && item.name === PRERENDER_ENTRY) {
          chunk = item;
          break;
        }
      }
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
      // A rebuild in watch mode counts the features of the components again.
      builtFeatures = undefined;
      knownFeatures = undefined;
      loadedComponents.clear();
      writeRouteTypes();
    },

    async resolveId(id, importer, resolveOptions) {
      if (
        id === START ||
        id === MANIFEST ||
        id === SERVER ||
        id === ROUTES ||
        id === TESTING ||
        id.startsWith(BUNDLE)
      ) {
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
        (resolved.id.includes('/node_modules/') && !findPackage(packages, resolved.id))
      ) {
        return resolved;
      }
      const file = resolved.id;
      return isScriptFile(file) && existsSync(file) && hasUseServer(readFileSync(file, 'utf8'))
        ? { ...resolved, id: `${file}${SERVER_QUERY}` }
        : resolved;
    },

    async load(id, loadOptions) {
      if (id === PRELOAD_HELPER && !isServe) {
        return preloadHelper(base, relativeUrls);
      }
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
          `import { load${isServe ? '' : ', loadBundle'} } from ${JSON.stringify(MANIFEST)};`,
          // On the dev server, an edit of a component can update the page without a reload.
          ...(isServe ? ["import { hotLoad } from 'brumate/hot';"] : []),
          `start({ load${isServe ? ': hotLoad(import.meta.hot, load)' : ', loadBundle'}${serialFile() ? `, serial: () => import(${JSON.stringify(serialFile())})` : ''}, rpc: ${JSON.stringify(rpc)}, navigate: ${JSON.stringify(options.navigate ?? true)}${buildId === undefined ? '' : `, build: ${JSON.stringify(buildId)}`} });`,
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
      if (id.startsWith(`\0${BUNDLE}`)) {
        return await bundleModule(id.slice(BUNDLE.length + 1));
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
      if (!isServe && !isSsrBuild && isClient) {
        loadedComponents.add(file);
      }
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
        this.warn(`${warning.message} (${getFileName(file)}:${line}:${column})`);
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
      const sources: (string | null)[] = [];
      if (map) {
        for (const [index, name] of map.sources.entries()) {
          sources.push(index === 0 ? file : name);
        }
      }
      // The map points at the file by its path, so the browser shows it under its own name. Code
      // that came from modules of reactive logic points at them, by their paths too.
      // `transform` below removes the types, and Vite chains the two maps.
      return {
        code,
        map: map && {
          ...map,
          sources,
        },
      };
    },

    async transform(code, id, transformOptions) {
      // The client build leaves out the code of the features of the core that no component
      // uses. The dev server and the server build keep every feature, and so does a build with
      // `features: 'all'`, such as one that compiles components in the browser.
      if (!isServe && !isSsrBuild && !transformOptions?.ssr && readsFeatures(code)) {
        const features = options.features === 'all' ? allFeatures() : await buildFeatures();
        return { code: writeFeatures(code, features), map: null };
      }
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
      const linked: string[] = [];
      for (const item of packages) {
        if (item.linked) {
          linked.push(...item.directories);
        }
      }
      if (linked.length > 0) {
        server.watcher.add(linked);
      }
      // A change to the dependencies of the app, or to a package's `brumate` field, can change
      // the packages, and with them the config of Vite, so the server restarts.
      const manifests: string[] = [normalizePath(path.join(root, 'package.json'))];
      for (const item of packages) {
        manifests.push(normalizePath(`${item.root}/package.json`));
      }
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
        workbenchList = undefined;
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
          if (packages.length > 0 && !findPackage(packages, normalized)) {
            const rest: string[] = [];
            for (const item of appScripts) {
              if (item !== normalized) {
                rest.push(item);
              }
            }
            appScripts = rest;
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

/** The names that compiled client code exports, such as `h4`, `u5` and `g`. */
function exportNames(codes: string[]): string[] {
  const names = new Set<string>();
  for (const code of codes) {
    for (const match of code.matchAll(
      /^export (?:async )?(?:function\*? |const |let |var )([\w$]+)|^export \{([^}]*)\}/gm,
    )) {
      if (match[1]) {
        names.add(match[1]);
      }
      for (const item of match[2]?.split(',') ?? []) {
        const name = item
          .trim()
          .split(/\s+as\s+/)
          .pop();
        if (name) {
          names.add(name);
        }
      }
    }
  }
  return [...names];
}
