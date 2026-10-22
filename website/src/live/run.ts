// Runs a code sample of the docs in the page. The compiler runs in the
// browser, the server runtime renders the sample, and the core of this site
// resumes it, as it resumes the rest of the page.
//
// - The compiler writes TypeScript, which oxc-transform turns into modules.
// - Each module loads from a blob URL. Its imports of `brumate/*` load small
//   modules that re-export the runtime of this site, and its imports of the
//   other files of the sample load their blob URLs.
// - Each run renders with a new path for the files, so its components get
//   new IDs, and with scope IDs far above the IDs of the page.
// - Server functions answer in the page: calls to `/_brumate/` go to them
//   instead of the network.

import { analyzeProject, compile, generateShared } from 'brumate';
import type { CompileResult } from 'brumate';
import * as client from 'brumate/client';
import * as context from 'brumate/context';
import * as events from 'brumate/events';
import * as html from 'brumate/html';
import * as routes from 'brumate/routes';
import * as server from 'brumate/server';
import * as signals from 'brumate/signals';
import { transformSync } from 'oxc-transform';

export interface LiveFile {
  name: string;
  source: string;
}

export interface LiveOutput {
  /** The compiled modules of the entry file, by name, for the output tab. */
  modules: { name: string; code: string }[];
  warnings: string[];
}

/** Component modules of samples, by component ID. The loader of the site reads them first. */
export const LIVE: unique symbol = Symbol.for('brumate.live');

type ClientModule = Awaited<ReturnType<typeof client.loadModule>>;

function registry(): Map<string, () => Promise<ClientModule>> {
  const global = globalThis as Record<symbol, Map<string, () => Promise<ClientModule>> | undefined>;
  return (global[LIVE] ??= new Map());
}

const RUNTIME: Record<string, object> = {
  'brumate/client': client,
  'brumate/context': context,
  'brumate/events': events,
  'brumate/html': html,
  'brumate/routes': routes,
  'brumate/server': server,
  // A module of reactive logic imports it, though its functions run only as copies in components.
  'brumate/signals': signals,
};

function blob(code: string): string {
  return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
}

const RUNTIME_KEY = '__brumateLiveRuntime';
const shims = new Map<string, string>();

/** A module that re-exports a runtime module of this site. */
function shim(name: string): string {
  let url = shims.get(name);
  if (!url) {
    (globalThis as Record<string, unknown>)[RUNTIME_KEY] ??= RUNTIME;
    const names = Object.keys(RUNTIME[name]!).filter((key) => /^[A-Za-z_$][\w$]*$/.test(key));
    url = blob(
      [
        `const m = globalThis.${RUNTIME_KEY}[${JSON.stringify(name)}];`,
        names.length > 0 ? `export const { ${names.join(', ')} } = m;` : '',
      ].join('\n'),
    );
    shims.set(name, url);
  }
  return url;
}

/** TypeScript to a module, as the Vite plugin does with oxc. */
function strip(filename: string, code: string): string {
  const result = transformSync(`${filename}.ts`, code, { lang: 'ts', sourceType: 'module' });
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]!.message);
  }
  return result.code;
}

/** Replaces the import specifiers of a module. */
function rewrite(code: string, resolve: (specifier: string) => string): string {
  return code.replace(
    /(\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"]+)\2/g,
    (_, before: string, quote: string, specifier: string) =>
      `${before}${quote}${resolve(specifier)}${quote}`,
  );
}

let runs = 0;
/** Server functions of every sample on the page, by ID. */
const functions: Record<string, (...args: unknown[]) => unknown> = {};

let answering = false;

/** Sends calls of server functions to the functions of the samples. */
function answerCalls(): void {
  if (answering) {
    return;
  }
  answering = true;
  const original = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin === location.origin && url.pathname.startsWith('/_brumate/')) {
      const answer = await server.handleRequest(functions, request);
      if (answer) {
        return answer;
      }
    }
    return original(input, init);
  };
}

/**
 * Adds markup to `container` and runs its inline scripts: the state records
 * of the render, and the swap of a `#loading` body that streams in later.
 * Markup set with `innerHTML` does not run them, so each one is a new
 * script, which a state record also needs as `document.currentScript`.
 */
function append(container: HTMLElement, markup: string): void {
  const template = document.createElement('template');
  template.innerHTML = markup;
  // A copy, because appending moves nodes out of the live list.
  // oxlint-disable-next-line unicorn/no-useless-spread
  for (const node of [...template.content.childNodes]) {
    if (node.nodeName === 'SCRIPT' && !(node as Element).hasAttribute('type')) {
      const script = document.createElement('script');
      for (const attribute of (node as Element).attributes) {
        script.setAttribute(attribute.name, attribute.value);
      }
      script.textContent = node.textContent;
      container.append(script);
    } else {
      container.append(node);
    }
  }
}

/**
 * Compiles the files of a sample, renders the first one into `container`,
 * and resumes it. Throws the error of the compiler, without the path of the run.
 */
export async function runSample(
  container: HTMLElement,
  files: LiveFile[],
  /** False when a newer run of the same sample started, so this one does not write over it. */
  isLatest: () => boolean = () => true,
): Promise<LiveOutput | undefined> {
  const run = ++runs;
  const folder = `live${run}`;
  const path = (name: string): string => `${folder}/${name}`;
  const sources = new Map(files.map((file) => [path(file.name), file.source]));
  const clean = (message: string): string => message.replaceAll(`${folder}/`, '');

  const compiled = new Map<string, CompileResult>();
  const warnings: string[] = [];
  const liveProps = analyzeProject(new Map([...sources].filter(([name]) => name.endsWith('.brm'))));
  try {
    for (const [name, source] of sources) {
      if (name.endsWith('.brm')) {
        const result = compile(source, {
          filename: name,
          path: name,
          liveProps: liveProps.get(name),
          merge: 2048,
          // A module of reactive logic is another file of the sample, such as counter.brm.ts.
          resolveModule: (specifier, importer) => {
            const file = `${importer.slice(0, importer.lastIndexOf('/'))}/${specifier.replace(/^\.\//, '')}`;
            const text = sources.get(file);
            return text === undefined ? undefined : { path: file, source: text };
          },
        });
        compiled.set(name, result);
        warnings.push(...result.warnings.map((warning) => clean(warning.message)));
      }
    }
  } catch (error) {
    throw new Error(clean(error instanceof Error ? error.message : String(error)), {
      cause: error,
    });
  }

  const urls = new Map<string, string>();
  const once = (key: string, make: () => string): string => {
    let url = urls.get(key);
    if (!url) {
      url = make();
      urls.set(key, url);
    }
    return url;
  };

  /** The file of the sample that a specifier names, relative to `from`. */
  const target = (specifier: string, from: string): { file: string; query: URLSearchParams } => {
    const [bare, query = ''] = specifier.split('?') as [string, string?];
    const directory = from.slice(0, from.lastIndexOf('/'));
    const file = `${directory}/${bare.replace(/^\.\//, '')}`;
    const found = [file, `${file}.ts`].find((name) => sources.has(name));
    if (!found) {
      throw new Error(`A sample can import brumate and its own files. "${specifier}" is not one.`);
    }
    return { file: found, query: new URLSearchParams(query) };
  };

  const resolver =
    (from: string, kind: 'server' | 'client') =>
    (specifier: string): string => {
      if (specifier in RUNTIME) {
        return shim(specifier);
      }
      const { file, query } = target(specifier, from);
      if (query.has('brumate-shared')) {
        return shared(file);
      }
      if (!file.endsWith('.brm')) {
        return script(file);
      }
      if (query.has('brumate-render')) {
        return render(file);
      }
      const part = query.get('part');
      if (part) {
        return clientPart(file, part);
      }
      return kind === 'server' ? serverModule(file) : clientEntry(file);
    };

  const script = (file: string): string =>
    once(`ts:${file}`, () =>
      blob(rewrite(strip(file, sources.get(file)!), resolver(file, 'server'))),
    );
  // The browser code of the functions of a module of reactive logic, shared by every call.
  const shared = (file: string): string =>
    once(`shared:${file}`, () =>
      blob(
        rewrite(
          strip(file, generateShared({ path: file, source: sources.get(file)! }).code),
          resolver(file, 'client'),
        ),
      ),
    );
  const serverModule = (file: string): string =>
    once(`server:${file}`, () =>
      blob(rewrite(strip(file, compiled.get(file)!.server), resolver(file, 'server'))),
    );
  const clientEntry = (file: string): string =>
    once(`client:${file}`, () =>
      blob(rewrite(strip(file, compiled.get(file)!.client), resolver(file, 'client'))),
    );
  const clientPart = (file: string, part: string): string =>
    once(`part:${file}:${part}`, () =>
      blob(rewrite(strip(file, compiled.get(file)!.parts[part]!), resolver(file, 'client'))),
    );
  const render = (file: string): string =>
    once(`render:${file}`, () =>
      blob(rewrite(strip(file, compiled.get(file)!.render), resolver(file, 'client'))),
    );

  // The loader of the site asks for the client modules of the sample by component ID.
  for (const [file, result] of compiled) {
    registry().set(result.plan.id, () => import(/* @vite-ignore */ clientEntry(file)));
  }

  const entry = path(files[0]!.name);
  const modules = await Promise.all(
    [...compiled.keys()].map(async (file) => import(/* @vite-ignore */ serverModule(file))),
  );
  for (const module of modules) {
    Object.assign(functions, module.rpc ?? {});
  }
  answerCalls();
  const component = modules[[...compiled.keys()].indexOf(entry)].default;
  const rendered = await server.render(
    component,
    {},
    {
      base: run * 1_000_000,
      request: new Request(location.href),
    },
  );
  if (!isLatest()) {
    return undefined;
  }
  // The markup goes into its own element, so markup that streams in after a newer run goes nowhere.
  const holder = document.createElement('div');
  container.replaceChildren(holder);
  append(holder, rendered.html + rendered.state);
  void (async () => {
    for await (const chunk of rendered.pending) {
      append(holder, chunk);
    }
  })();

  if (!isLatest()) {
    return undefined;
  }
  // Every file of the sample, in the order of the sample, with each name before its modules.
  const outputs: { name: string; code: string }[] = [];
  for (const file of files) {
    const name = path(file.name);
    const result = compiled.get(name);
    if (result) {
      outputs.push(
        { name: `${file.name}: client entry`, code: result.client },
        ...Object.entries(result.parts).map(([part, code]) => ({
          name: `${file.name}: part ${part}`,
          code,
        })),
        { name: `${file.name}: server`, code: result.server },
      );
    } else if (file.name.endsWith('.brm.ts')) {
      // A module of reactive logic: components copy its functions, and the browser shares this code.
      outputs.push({
        name: `${file.name}: shared browser code`,
        code: generateShared({ path: name, source: file.source }).code,
      });
    }
  }
  return {
    modules: outputs.map((module) => ({ name: module.name, code: clean(module.code) })),
    warnings,
  };
}
