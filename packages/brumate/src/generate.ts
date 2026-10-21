// The code generators, for callers that compile without `compile`. Their
// output carries the marks that `compile` turns into source maps, so these
// remove them.

import type { SFCFile } from './ast.ts';
import { generateClient as client } from './codegen/client.ts';
import { generateRender as render } from './codegen/render.ts';
import { generateServer as server } from './codegen/server.ts';
import type { Plan } from './plan.ts';
import { unmarked } from './sourcemap.ts';

/** Generates the server module. */
export function generateServer(file: SFCFile, plan: Plan): string {
  return unmarked(server(file, plan));
}

/** Generates the render module. */
export function generateRender(file: SFCFile, plan: Plan): string {
  return unmarked(render(file, plan));
}

/** Generates the client entry and its parts. */
export function generateClient(
  file: SFCFile,
  plan: Plan,
  merge?: number,
): ReturnType<typeof client> {
  const result = client(file, plan, merge);
  return {
    ...result,
    code: unmarked(result.code),
    parts: Object.fromEntries(
      Object.entries(result.parts).map(([name, code]) => [name, unmarked(code)]),
    ),
  };
}
