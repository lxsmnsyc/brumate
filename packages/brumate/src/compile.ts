import { analyze } from './analyze.ts';
import { generateClient } from './codegen/client.ts';
import { generateRender } from './codegen/render.ts';
import { generateServer } from './codegen/server.ts';
import { getLocation } from './error.ts';
import { buildGraph } from './graph.ts';
import type { Diagnostic } from './model.ts';
import { parse } from './parser.ts';
import { createPlan } from './plan.ts';
import type { Plan } from './plan.ts';

export interface CompileOptions {
  /** Used for error messages, the component name and the component ID. */
  filename?: string;
}

export interface CompileResult {
  /** The server module, as TypeScript. Its default export renders the component. */
  server: string;
  /** The client module, as TypeScript. The loader imports it on the first event. */
  client: string;
  /**
   * The render module, as TypeScript. It renders the component on the
   * client, inside a parent's block that changes.
   */
  render: string;
  plan: Plan;
  warnings: Diagnostic[];
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

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const filename = options.filename ?? 'Component.brm';
  const file = parse(source, { filename });
  const model = analyze(file);
  const graph = buildGraph(model);
  const diagnostics = [...model.diagnostics, ...graph.diagnostics];
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  if (errors.length > 0) {
    throw new CompileError(source, filename, errors);
  }
  const plan = createPlan(file, graph);
  const client = generateClient(file, plan);
  const clientErrors = client.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  if (clientErrors.length > 0) {
    throw new CompileError(source, filename, clientErrors);
  }
  return {
    server: generateServer(file, plan),
    client: client.code,
    render: generateRender(file, plan),
    plan,
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === 'warning'),
  };
}
