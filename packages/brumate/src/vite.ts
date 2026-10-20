import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { normalizePath, transformWithOxc } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';
import { compile } from './compile.ts';
import { defaultExclude, findFiles } from './files.ts';
import type { CompileResult } from './compile.ts';
import { getLocation } from './error.ts';
import { getComponentName, hash } from './plan.ts';
import { analyzeProject } from './project.ts';
import { routeFiles, routeModule } from './routes.ts';

export interface BrumateOptions {
  /** The URL prefix of server function calls. Defaults to `/_brumate`. */
  rpc?: string;
  /** Directories that are not searched for `.brm` files. Defaults to `node_modules`, `dist` and hidden directories. */
  exclude?: (directory: string) => boolean;
  /** The directory of route files, relative to the root. Defaults to `src/routes`. */
  routes?: string;
}

/** `import 'virtual:brumate/start'` in the client entry starts the loader. */
const START = 'virtual:brumate/start';
/** Exports `load(id)`, which imports the client module of a component. */
const MANIFEST = 'virtual:brumate/manifest';
/** Exports `functions` and `handle(request)` for server function calls. */
const SERVER = 'virtual:brumate/server';
/** Exports `routes` and `handle(request, options)` for the files in the routes directory. */
const ROUTES = 'virtual:brumate/routes';

const CLIENT_QUERY = '?brumate-client';
const RENDER_QUERY = '?brumate-render';

/** Reads a request body as bytes, so files in form data stay intact. */
async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/** The Vite plugin for `.brm` files. */
export default function brumate(options: BrumateOptions = {}): Plugin {
  const rpc = options.rpc ?? '/_brumate';
  const exclude = options.exclude ?? defaultExclude;
  let root = process.cwd();
  /** Component IDs to absolute file paths. */
  const files = new Map<string, string>();
  const compiled = new Map<string, { source: string; result: CompileResult }>();
  /** The props that parents can change, by absolute file path. */
  let liveProps = new Map<string, Set<string>>();

  // The ID is computed from the path relative to the root, so it is the same on every machine.
  const relative = (file: string): string => normalizePath(path.relative(root, file));
  const componentId = (file: string): string => {
    const filename = relative(file);
    return `${getComponentName(filename)}_${hash(filename)}`;
  };

  const scan = async (): Promise<void> => {
    files.clear();
    for (const file of await findFiles(root, exclude)) {
      files.set(componentId(file), file);
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
    return [
      "import { handleRequest } from 'brumate/server';",
      ...imports,
      'export const functions = {',
      ...spreads,
      '};',
      'export function handle(request) {',
      `  return handleRequest(functions, request, ${JSON.stringify(rpc)});`,
      '}',
    ].join('\n');
  };

  const routeTree = (): string => {
    const directory = normalizePath(path.resolve(root, options.routes ?? 'src/routes'));
    const paths = [...files.values()]
      .filter((file) => file.startsWith(`${directory}/`))
      .map((file) => file.slice(directory.length + 1));
    return routeModule(routeFiles(paths), (file) => `${directory}/${file}`, rpc);
  };

  const handleDevRPC = async (
    server: ViteDevServer,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    const id = decodeURIComponent((request.url ?? '').slice(rpc.length + 1).split('?')[0]!);
    const file = files.get(id.split('#')[0]!);
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
      const answer: Response = await handleRequest(module.rpc ?? {}, webRequest, rpc);
      response.statusCode = answer.status;
      answer.headers.forEach((value, name) => response.setHeader(name, value));
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

    configResolved(config) {
      root = config.root;
    },

    async buildStart() {
      await scan();
    },

    resolveId(id) {
      if (id === START || id === MANIFEST || id === SERVER || id === ROUTES) {
        return `\0${id}`;
      }
      return undefined;
    },

    async load(id, loadOptions) {
      if (id === `\0${START}`) {
        return [
          "import { start } from 'brumate/loader';",
          `import { load } from ${JSON.stringify(MANIFEST)};`,
          `start({ load, rpc: ${JSON.stringify(rpc)} });`,
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
      const [file, query] = id.split('?');
      if (!file?.endsWith('.brm')) {
        return undefined;
      }
      // Vite can add its own parameters, such as `import`.
      const params = new URLSearchParams(query);
      const isRender = params.has(RENDER_QUERY.slice(1));
      const isClient = params.has(CLIENT_QUERY.slice(1)) || !loadOptions?.ssr;
      const source = await readFile(file, 'utf8');
      // The entry, the parts and the render module of a file come from one compile.
      let cached = compiled.get(file);
      if (cached?.source !== source) {
        cached = {
          source,
          result: compile(source, { filename: relative(file), liveProps: liveProps.get(file) }),
        };
        compiled.set(file, cached);
      }
      const result = cached.result;
      for (const warning of isClient && !params.has('part') ? result.warnings : []) {
        const { line, column } = getLocation(source, warning.range.start);
        this.warn(`${warning.message} (${relative(file)}:${line}:${column})`);
      }
      const part = params.get('part');
      let code: string;
      if (isRender) {
        code = result.render;
      } else if (part) {
        code = result.parts[part] ?? '';
      } else {
        code = isClient ? result.client : result.server;
      }
      return transformWithOxc(code, `${file}.ts`, { lang: 'ts' });
    },

    configureServer(server) {
      server.watcher.on('all', (event, file) => {
        if (!file.endsWith('.brm')) {
          return;
        }
        const update = event === 'add' || event === 'unlink' ? scan() : analyze();
        void update.then(() => {
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
        next();
      });
    },

    handleHotUpdate({ file, server }) {
      // A resumed page cannot swap a component's code, so the page reloads.
      if (file.endsWith('.brm')) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
      return undefined;
    },
  };
}
