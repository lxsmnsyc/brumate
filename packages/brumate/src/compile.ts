import { checkAccessibility } from './a11y.ts';
import { finish } from './sourcemap.ts';
import { ModuleError, expandModules, resolveFromDisk } from './modules.ts';
import type { Origin, ReactiveModule, ResolveModule } from './modules.ts';
import type { SourceMap } from './sourcemap.ts';
import { analyze } from './analyze.ts';
import { generateClient } from './codegen/client.ts';
import { generateRender } from './codegen/render.ts';
import { generateServer } from './codegen/server.ts';
import { BrumateError, getLocation } from './error.ts';
import { buildGraph } from './graph.ts';
import type { Diagnostic } from './model.ts';
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
  /** The parts of the client module, by name. The entry imports them when they are needed. */
  parts: Record<string, string>;
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

  constructor(source: string, filename: string, diagnostics: Diagnostic[]) {
    const lines = diagnostics.map((diagnostic) => {
      const { line, column } = getLocation(source, diagnostic.range.start);
      return `${diagnostic.message} (${filename}:${line}:${column})`;
    });
    super(lines.join('\n'));
    this.name = 'CompileError';
    this.diagnostics = diagnostics;
  }
}

/** The origin of an offset of a component that calls no module function. */
const identity = (offset: number): Origin => ({ offset });

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
): { file: SFCFile; origin: (offset: number) => Origin; modules: ReactiveModule[] } {
  let file = parse(source, { filename });
  let origin = identity;
  const modules = new Map<string, ReactiveModule>();
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
      return { file, origin, modules: [...modules.values()] };
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
      };
    };
    try {
      file = parse(expansion.source, { filename });
    } catch (error) {
      if (error instanceof BrumateError) {
        const at = origin(error.offset);
        const where = at.module ? ` (${locationIn(at.module, at.offset)})` : '';
        throw new BrumateError(
          `${error.message.replace(/ \([^()]*:\d+:\d+\)$/, '')}${where}`,
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

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const filename = options.filename ?? 'Component.brm';
  const { file, origin, modules } = expand(
    source,
    filename,
    options.path ?? filename,
    options.resolveModule ?? resolveFromDisk,
  );
  // A diagnostic about code of a module points at its call, and names its place in the module.
  const translate = (diagnostic: Diagnostic): Diagnostic => {
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
  };
  const fail = (errors: Diagnostic[]): never => {
    throw new CompileError(source, filename, errors.map(translate));
  };
  const model = analyze(file);
  const graph = buildGraph(model, { liveProps: options.liveProps });
  const diagnostics = [
    ...model.diagnostics,
    ...graph.diagnostics,
    ...(options.a11y === false ? [] : checkAccessibility(file)),
  ];
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  if (errors.length > 0) {
    fail(errors);
  }
  const plan = createPlan(file, graph, options.path);
  const styleErrors = plan.styles.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
  if (styleErrors.length > 0) {
    fail(styleErrors);
  }
  const client = generateClient(file, plan, options.merge);
  const clientErrors = client.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  if (clientErrors.length > 0) {
    fail(clientErrors);
  }
  // The generated code marks what it copied from the file. `finish` turns the marks into
  // source maps, which point code that a module function gave back to the module.
  const files = [
    { name: filename, content: source },
    ...modules.map((module) => ({ name: module.path, content: module.source })),
  ];
  const place = (offset: number): { index: number; offset: number } => {
    const at = origin(offset);
    return {
      index: at.module ? modules.findIndex((module) => module.path === at.module!.path) + 1 : 0,
      offset: at.offset,
    };
  };
  const done = (code: string) => finish(code, files, place);
  const server = done(generateServer(file, plan));
  const entry = done(client.code);
  const parts = Object.fromEntries(
    Object.entries(client.parts).map(([name, code]) => [name, done(code)]),
  );
  const render = done(generateRender(file, plan));
  return {
    server: server.code,
    client: entry.code,
    parts: Object.fromEntries(Object.entries(parts).map(([name, part]) => [name, part.code])),
    render: render.code,
    maps: {
      server: server.map,
      client: entry.map,
      parts: Object.fromEntries(Object.entries(parts).map(([name, part]) => [name, part.map])),
      render: render.map,
    },
    css: plan.styles.css,
    file,
    plan,
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').map(translate),
    modules: modules.map((module) => module.path),
    locate: (offset) => {
      const at = origin(offset);
      return at.module
        ? { file: at.module.path, offset: at.offset }
        : { file: undefined, offset: at.offset };
    },
  };
}
