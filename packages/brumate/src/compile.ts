import { checkAccessibility } from './a11y.ts';
import { ANY } from './refreshes.ts';
import { checkCaptures } from './captures.ts';
import { checkEnv } from './env-check.ts';
import type { EnvImport } from './env-check.ts';
import { finish } from './sourcemap.ts';
import {
  ModuleError,
  expandModules,
  mayExportFunction,
  relocate,
  resolveFromDisk,
} from './modules.ts';
import type { ModuleCall, Origin, ReactiveModule, ResolveModule } from './modules.ts';
import { expandSignals } from './module-signals.ts';
import type { SignalName } from './module-signals.ts';
import { SHARED_QUERY, sharedSites } from './shared-module.ts';
import type { SharedContext } from './shared-module.ts';
import type { SourceMap } from './sourcemap.ts';
import { checkPendingReads } from './pending-reads.ts';
import { analyze } from './analyze.ts';
import { generateClient } from './codegen/client.ts';
import { generateRender } from './codegen/render.ts';
import { generateServer } from './codegen/server.ts';
import { BrumateError, codeFrame, getLocation, withCode } from './error.ts';
import type { Location } from './error.ts';
import { buildGraph } from './graph.ts';
import { lookup } from './model.ts';
import type { oxc } from './oxc.ts';
import type { Diagnostic } from './model.ts';
import type { BrowserDefer } from './project.ts';
import { parse } from './parser.ts';
import { createPlan } from './plan.ts';
import type { Plan } from './plan.ts';
import type { SFCFile } from './ast.ts';

export interface CompileOptions {
  /** Used for error messages, the component name and the component ID. */
  filename?: string;
  /**
   * The props that a parent can change on the client, from `analyzeProject`.
   * `*` means every prop. Without it, every prop can change.
   */
  liveProps?: Set<string>;
  /**
   * The `#defer` blocks of the file that a component in another file renders in the browser, from
   * `analyzeProjectDefers`. Each one is an error, since its body would never arrive.
   */
  browserDefers?: BrowserDefer[];
  /** The absolute path of the file, so SCSS and Less can import files next to it. */
  path?: string;
  /**
   * When the client parts of a component are smaller than this many bytes
   * in all, they become one module. Defaults to 0, which keeps one module
   * per part.
   */
  merge?: number;
  /** Warns about common accessibility mistakes in the markup. Defaults to true. */
  a11y?: boolean;
  /**
   * The ID of a function that the file imports from a `'use server'` file,
   * or undefined for other imports. Memos that call one load again when a
   * server function calls `refresh` with it. The Vite plugin passes it.
   */
  serverImport?: (specifier: string, name: string) => string | undefined;
  /**
   * The names of the server functions that the project passes to
   * `refresh`, from `refreshedNames`. A memo that calls an imported server
   * function outside it renders on the server only. Without it, any imported
   * server function can be refreshed.
   */
  refreshed?: ReadonlySet<string>;
  /**
   * The names of the server environment variables that an import gives,
   * such as `import env from './env.ts'`, or undefined for other imports.
   * Code that runs in the browser cannot read them. The Vite plugin passes
   * it for the imports that resolve to the env file.
   */
  envImport?: EnvImport;
  /**
   * Classes that the plugins of the serial entry send, such as `Money`, so a
   * signal can hold an instance. The Vite plugin reads them from the entry.
   */
  sendableClasses?: readonly string[];
  /**
   * Server function IDs use a hash of each function's name instead of the
   * name, so the browser does not see it. The Vite plugin sets it in builds.
   */
  hideNames?: boolean;
  /**
   * The stylesheet is a CSS module of its own, which the Vite plugin serves as
   * `<file>?brumate-style&lang.css` in builds, so Vite's CSS pipeline makes it into the stylesheet
   * of a bundle. The render and server modules then leave it out: they write no `$$css` and
   * call no `style`. The CSS is in `css` of the result.
   */
  styleFiles?: boolean;
  /**
   * The CSS of the component after a CSS pipeline, which replaces the scoped CSS that the compiler
   * wrote. The Vite plugin runs the project's PostCSS or Lightning CSS on the CSS of a first
   * compile, and compiles again with the result, where the CSS stays inline (the dev server).
   */
  css?: string;
  /**
   * Reads a module of reactive logic, such as `./counter.brm.ts`, that the
   * component imports. Defaults to reading it from disk next to `path`.
   */
  resolveModule?: ResolveModule;
}

export interface CompileResult {
  /** The server module, as TypeScript. Its default export renders the component. */
  server: string;
  /** The client entry module, as TypeScript. The loader imports it on the first event. */
  client: string;
  /**
   * The parts of the client module, by name. The entry imports them when
   * they are needed. A small component has none: its entry holds the code.
   */
  parts: Record<string, string>;
  /** The ID, the props map and the update tables of the client entry, without code. */
  table: string;
  /** False when nothing of the component runs in the browser, so it needs no client module. */
  clientCode: boolean;
  /**
   * The render module, as TypeScript. It renders the component on the
   * client, inside a parent's block that changes.
   */
  render: string;
  /** The scoped CSS of the component. Server and render modules add it to the page. */
  css: string;
  /** The parsed file. */
  file: SFCFile;
  plan: Plan;
  warnings: Diagnostic[];
  /** The paths of the modules of reactive logic that the component calls into. */
  modules: string[];
  /**
   * Where an offset of `file.source` comes from: the component, or a module
   * whose function the component calls. `file.source` holds the bodies of
   * those functions in place of their calls.
   */
  locate: (offset: number) => { file: string | undefined; offset: number };
  /** Source maps from each module back to the `.brm` file. */
  maps: {
    server: SourceMap;
    client: SourceMap;
    parts: Record<string, SourceMap>;
    render: SourceMap;
  };
}

/** Thrown when a file has errors. Every error is in `diagnostics`. */
export class CompileError extends Error {
  readonly diagnostics: Diagnostic[];
  readonly filename: string;
  /** Where the first error is. */
  readonly location: Location;
  /** The lines around the first error. */
  readonly frame: string;

  constructor(source: string, filename: string, diagnostics: Diagnostic[]) {
    const lines: string[] = [];
    for (const diagnostic of diagnostics) {
      const { line, column } = getLocation(source, diagnostic.range.start);
      lines.push(`${withCode(diagnostic.message)} (${filename}:${line}:${column})`);
    }
    super(lines.join('\n'));
    this.name = 'CompileError';
    this.diagnostics = diagnostics;
    this.filename = filename;
    const start = diagnostics[0]?.range.start ?? 0;
    this.location = getLocation(source, start);
    this.frame = codeFrame(source, start);
  }
}

/** Keeps the diagnostics of one severity. */
function filterBySeverity(
  diagnostics: Diagnostic[],
  severity: Diagnostic['severity'],
): Diagnostic[] {
  const kept: Diagnostic[] = [];
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === severity) {
      kept.push(diagnostic);
    }
  }
  return kept;
}

/** Finds the index of the module with this path, or -1. */
function findModuleIndex(modules: ReactiveModule[], modulePath: string): number {
  for (const [index, module] of modules.entries()) {
    if (module.path === modulePath) {
      return index;
    }
  }
  return -1;
}

/** The origin of an offset of a component that calls no module function. */
function identity(offset: number): Origin {
  return { offset };
}

/** How deep module functions can call module functions, so a function that calls itself stops. */
const MAX_EXPANSIONS = 16;

/**
 * Parses a component, and copies the bodies of the module functions that it
 * calls in place of the calls. Returns the parsed file, which holds the
 * expanded source, and where each offset of that source comes from.
 */
function expand(
  source: string,
  filename: string,
  path: string,
  resolve: ResolveModule,
): {
  file: SFCFile;
  origin: (offset: number) => Origin;
  modules: ReactiveModule[];
  calls: ModuleCall[];
  /** The variables that read a module signal, with the module that holds it. */
  signals: Map<string, SignalName>;
  /** The modules that hold the signals that the component imports. */
  signalModules: ReactiveModule[];
} {
  let file = parse(source, { filename });
  let origin = identity;
  const modules = new Map<string, ReactiveModule>();
  // The calls that the component itself makes. Their offsets are offsets of `source`.
  let calls: ModuleCall[] = [];
  /** Compiles the module signals of the component, which the last round left. */
  function finishSignals() {
    let expansion;
    try {
      expansion = expandSignals(
        file,
        path,
        resolve,
        (offset) => origin(offset).module !== undefined,
      );
    } catch (error) {
      if (error instanceof ModuleError) {
        const at = origin(error.offset);
        throw new CompileError(source, filename, [
          {
            severity: 'error',
            message: error.message,
            range: at.call ?? { start: at.offset, end: at.offset + 1 },
          },
        ]);
      }
      throw error;
    }
    const done = {
      file,
      origin,
      modules: [...modules.values()],
      calls,
      signals: new Map<string, SignalName>(),
      signalModules: [] as ReactiveModule[],
    };
    if (!expansion) {
      return done;
    }
    const previous = origin;
    const next = expansion.origin;
    try {
      done.file = parse(expansion.source, { filename });
    } catch (error) {
      if (error instanceof BrumateError) {
        const at = previous(next(error.offset));
        throw new BrumateError(
          error.message.replace(/ \([^()]*:\d+:\d+\)$/, '').replace(/ \[BRM\d+\]$/, ''),
          source,
          at.call?.start ?? at.offset,
          filename,
        );
      }
      throw error;
    }
    done.origin = (offset) => previous(next(offset));
    done.signals = expansion.names;
    done.signalModules = expansion.modules;
    return done;
  }
  for (let round = 0; ; round++) {
    let expansion;
    try {
      expansion = expandModules(file, path, resolve);
    } catch (error) {
      if (error instanceof ModuleError) {
        const at = origin(error.offset);
        throw new CompileError(source, filename, [
          {
            severity: 'error',
            message: error.message,
            range: at.call ?? { start: at.offset, end: at.offset + 1 },
          },
        ]);
      }
      throw error;
    }
    if (!expansion) {
      return finishSignals();
    }
    if (round === 0) {
      calls = expansion.calls;
    }
    if (round === MAX_EXPANSIONS) {
      throw new CompileError(source, filename, [
        {
          severity: 'error',
          message:
            'Module functions call each other too deeply. A module function cannot call itself',
          range: { start: 0, end: 1 },
        },
      ]);
    }
    for (const module of expansion.modules) {
      modules.set(module.path, module);
    }
    // An offset of the new source maps through this round, then through the earlier ones.
    const outer = origin;
    const inner = expansion.origin;
    origin = (offset) => {
      const found = inner(offset);
      if (!found.module) {
        return outer(found.offset);
      }
      const call = found.call && outer(found.call.start);
      return {
        ...found,
        call: call?.call ?? (call && { start: call.offset, end: outer(found.call!.end).offset }),
        // Code of a module function that a module function calls, rather than the component.
        nested: round > 0,
      };
    };
    try {
      file = parse(expansion.source, { filename });
    } catch (error) {
      if (error instanceof BrumateError) {
        const at = origin(error.offset);
        const where = at.module ? ` (${locationIn(at.module, at.offset)})` : '';
        throw new BrumateError(
          `${error.message.replace(/ \([^()]*:\d+:\d+\)$/, '').replace(/ \[BRM\d+\]$/, '')}${where}`,
          source,
          at.call?.start ?? at.offset,
          filename,
        );
      }
      throw error;
    }
  }
}

/** `file:line:column` of an offset of a module, with the file name only. */
function locationIn(module: ReactiveModule, offset: number): string {
  const { line, column } = getLocation(module.source, offset);
  return `${module.path.split(/[\\/]/).pop()}:${line}:${column}`;
}

/** True for a function node, whose shared code is called with its arguments. */
function isFunction(node: { type: string }): boolean {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

/**
 * Lets code generation call the shared module of a module function for the
 * code that a call of it gave the component, instead of copying the code.
 */
function sharedContext(
  origin: (offset: number) => Origin,
  modules: ReactiveModule[],
  calls: ModuleCall[],
  path: string,
): SharedContext | undefined {
  if (calls.length === 0) {
    return undefined;
  }
  const byStart = new Map<number, ModuleCall>();
  for (const call of calls) {
    byStart.set(call.start, call);
  }
  const specifiers: string[] = [];
  for (const module of modules) {
    specifiers.push(
      `${relocate(`./${module.path.split('/').pop()}`, module.path, path)}${SHARED_QUERY}`,
    );
  }
  return {
    specifiers,
    find(node) {
      const at = origin(node.start);
      if (!at.module || at.nested || !at.call) {
        return undefined;
      }
      const call = byStart.get(at.call.start);
      const site = sharedSites(at.module).get(at.offset);
      if (!call || call.module !== at.module.path || !site) {
        return undefined;
      }
      if ((site.kind === 'function') !== isFunction(node)) {
        return undefined;
      }
      return {
        module: findModuleIndex(modules, at.module.path),
        site,
        names: call.names,
      };
    },
  };
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const filename = options.filename ?? 'Component.brm';
  const { file, origin, modules, calls, signals, signalModules } = expand(
    source,
    filename,
    options.path ?? filename,
    options.resolveModule ?? resolveFromDisk,
  );
  // A diagnostic about code of a module points at its call, and names its place in the module.
  function translate(diagnostic: Diagnostic): Diagnostic {
    const start = origin(diagnostic.range.start);
    if (!start.module) {
      const end = origin(diagnostic.range.end);
      return {
        ...diagnostic,
        range: { start: start.offset, end: end.module ? start.offset + 1 : end.offset },
      };
    }
    return {
      ...diagnostic,
      message: `${diagnostic.message} (in ${locationIn(start.module, start.offset)})`,
      range: start.call ?? { start: 0, end: 1 },
    };
  }
  function fail(errors: Diagnostic[]): never {
    const translated: Diagnostic[] = [];
    for (const error of errors) {
      translated.push(translate(error));
    }
    throw new CompileError(source, filename, translated);
  }
  const model = analyze(file, signals);
  for (const declaration of model.declarations) {
    if (declaration.imported && options.serverImport) {
      declaration.serverImport = options.serverImport(
        declaration.imported.source,
        declaration.imported.name,
      );
      if (declaration.serverImport !== undefined) {
        // A server function that the project refreshes, or any when the project is not known:
        // the memos that call it load again on the client.
        const name = declaration.imported.name;
        declaration.refreshed =
          !options.refreshed || options.refreshed.has(ANY) || options.refreshed.has(name);
        for (const read of declaration.reads) {
          read.site.calls.add(declaration);
        }
      }
    }
  }
  // An import that a prop passes can be a function, which the browser calls through a reference.
  for (const site of model.sites) {
    if (site.kind !== 'prop') {
      continue;
    }
    // The function in a wrapper, such as `$untrack(fn)` or `prevent(fn)`, or in parentheses.
    let node: oxc.Node = site.node;
    while (
      node.type === 'ParenthesizedExpression' ||
      (node.type === 'CallExpression' && node.arguments[0]?.type !== 'SpreadElement')
    ) {
      const inner: oxc.Node | undefined =
        node.type === 'ParenthesizedExpression' ? node.expression : node.arguments[0];
      if (!inner) {
        break;
      }
      node = inner;
    }
    if (node.type !== 'Identifier') {
      continue;
    }
    const declaration = lookup(site.scope, node.name);
    if (
      declaration?.kind === 'import' &&
      declaration.imported &&
      // A server function has its own reference.
      declaration.serverImport === undefined &&
      declaration.callable === undefined
    ) {
      declaration.callable = mayExportFunction(
        declaration.imported.source,
        declaration.imported.name,
        options.path ?? filename,
        options.resolveModule ?? resolveFromDisk,
      );
    }
  }
  checkPendingReads(model.sites, model.pendingCalls, (message, range) =>
    model.diagnostics.push({ severity: 'error', message, range }),
  );
  const graph = buildGraph(model, { liveProps: options.liveProps });
  const deferDiagnostics: Diagnostic[] = [];
  for (const found of options.browserDefers ?? []) {
    deferDiagnostics.push({
      severity: 'error',
      message: `#defer cannot be in the content of <${found.component}>, which can render it in the browser. Use #loading with a server function`,
      range: { start: found.start, end: found.end },
    });
  }
  const diagnostics = [
    ...model.diagnostics,
    ...graph.diagnostics,
    ...deferDiagnostics,
    ...(options.a11y === false ? [] : checkAccessibility(file)),
  ];
  const errors = filterBySeverity(diagnostics, 'error');
  if (errors.length > 0) {
    fail(errors);
  }
  const plan = createPlan(file, graph, options.path, options.hideNames, options.styleFiles);
  if (options.css !== undefined) {
    plan.styles = { ...plan.styles, css: options.css };
  }
  const styleErrors = filterBySeverity([...plan.styles.diagnostics, ...plan.diagnostics], 'error');
  if (styleErrors.length > 0) {
    fail(styleErrors);
  }
  const captures = [
    ...checkCaptures(file, plan, options.sendableClasses),
    ...(options.envImport ? checkEnv(file, plan, options.envImport) : []),
  ];
  if (captures.length > 0) {
    fail(captures);
  }
  const shared = sharedContext(origin, modules, calls, options.path ?? filename);
  const client = generateClient(file, plan, options.merge, shared);
  const clientErrors = filterBySeverity(client.diagnostics, 'error');
  if (clientErrors.length > 0) {
    fail(clientErrors);
  }
  // The generated code marks what it copied from the file. `finish` turns the marks into
  // source maps, which point code that a module function gave back to the module.
  const files = [{ name: filename, content: source }];
  for (const module of modules) {
    files.push({ name: module.path, content: module.source });
  }
  function place(offset: number): { index: number; offset: number } {
    const at = origin(offset);
    return {
      index: at.module ? findModuleIndex(modules, at.module.path) + 1 : 0,
      offset: at.offset,
    };
  }
  function done(code: string) {
    return finish(code, files, place);
  }
  const server = done(generateServer(file, plan));
  const entry = done(client.code);
  const partCodes: Record<string, string> = {};
  const partMaps: Record<string, SourceMap> = {};
  for (const [name, code] of Object.entries(client.parts)) {
    const part = done(code);
    partCodes[name] = part.code;
    partMaps[name] = part.map;
  }
  const warnings: Diagnostic[] = [];
  for (const warning of filterBySeverity(diagnostics, 'warning')) {
    warnings.push(translate(warning));
  }
  const modulePaths: string[] = [];
  for (const module of [...modules, ...signalModules]) {
    modulePaths.push(module.path);
  }
  const render = done(generateRender(file, plan, client.fillOf));
  return {
    server: server.code,
    client: entry.code,
    parts: partCodes,
    table: client.table,
    clientCode: client.clientCode,
    render: render.code,
    maps: {
      server: server.map,
      client: entry.map,
      parts: partMaps,
      render: render.map,
    },
    css: plan.styles.css,
    file,
    plan,
    warnings,
    modules: modulePaths,
    locate: (offset) => {
      const at = origin(offset);
      return at.module
        ? { file: at.module.path, offset: at.offset }
        : { file: undefined, offset: at.offset };
    },
  };
}
