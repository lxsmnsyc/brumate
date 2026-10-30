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
  /** The compiled modules of the files, by name, for the output tab. */
  modules: { name: string; code: string; language: 'ts' | 'css'; client: boolean }[];
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
    const names: string[] = [];
    for (const key of Object.keys(RUNTIME[name]!)) {
      if (/^[A-Za-z_$][\w$]*$/.test(key)) {
        names.push(key);
      }
    }
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
const functions: Record<string, (...args: unknown[]) => unknown> = Object.create(null);

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
    const id = decodeURIComponent(url.pathname.slice('/_brumate/'.length));
    // Only the calls of sample functions are answered here. Others go to the server.
    if (
      url.origin === location.origin &&
      url.pathname.startsWith('/_brumate/') &&
      id in functions
    ) {
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
  if (!files[0]?.name.endsWith('.brm')) {
    throw new Error('The first file renders the page, so it must be a component, a .brm file.');
  }
  const run = ++runs;
  const folder = `live${run}`;
  function path(name: string): string {
    return `${folder}/${name}`;
  }
  const sources = new Map<string, string>();
  for (const file of files) {
    sources.set(path(file.name), file.source);
  }
  function clean(message: string): string {
    return message.replaceAll(`${folder}/`, '');
  }

  const compiled = new Map<string, CompileResult>();
  const warnings: string[] = [];
  const brmSources = new Map<string, string>();
  for (const [name, source] of sources) {
    if (name.endsWith('.brm')) {
      brmSources.set(name, source);
    }
  }
  const liveProps = analyzeProject(brmSources);
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
        for (const warning of result.warnings) {
          warnings.push(clean(warning.message));
        }
      }
    }
  } catch (error) {
    throw new Error(clean(error instanceof Error ? error.message : String(error)), {
      cause: error,
    });
  }

  const urls = new Map<string, string>();
  function once(key: string, make: () => string): string {
    let url = urls.get(key);
    if (!url) {
      url = make();
      urls.set(key, url);
    }
    return url;
  }

  /** The file of the sample that a specifier names, relative to `from`. */
  function target(specifier: string, from: string): { file: string; query: URLSearchParams } {
    const [bare, query = ''] = specifier.split('?') as [string, string?];
    const directory = from.slice(0, from.lastIndexOf('/'));
    const file = `${directory}/${bare.replace(/^\.\//, '')}`;
    let found: string | undefined;
    for (const name of [file, `${file}.ts`]) {
      if (sources.has(name)) {
        found = name;
        break;
      }
    }
    if (!found) {
      throw new Error(`A sample can import brumate and its own files. "${specifier}" is not one.`);
    }
    return { file: found, query: new URLSearchParams(query) };
  }

  function resolver(from: string, kind: 'server' | 'client') {
    return (specifier: string): string => {
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
  }

  function script(file: string): string {
    return once(`ts:${file}`, () =>
      blob(rewrite(strip(file, sources.get(file)!), resolver(file, 'server'))),
    );
  }
  // The browser code of the functions of a module of reactive logic, shared by every call.
  function shared(file: string): string {
    return once(`shared:${file}`, () =>
      blob(
        rewrite(
          strip(file, generateShared({ path: file, source: sources.get(file)! }).code),
          resolver(file, 'client'),
        ),
      ),
    );
  }
  function serverModule(file: string): string {
    return once(`server:${file}`, () =>
      blob(rewrite(strip(file, compiled.get(file)!.server), resolver(file, 'server'))),
    );
  }
  function clientEntry(file: string): string {
    return once(`client:${file}`, () =>
      blob(rewrite(strip(file, compiled.get(file)!.client), resolver(file, 'client'))),
    );
  }
  function clientPart(file: string, part: string): string {
    return once(`part:${file}:${part}`, () =>
      blob(rewrite(strip(file, compiled.get(file)!.parts[part]!), resolver(file, 'client'))),
    );
  }
  function render(file: string): string {
    return once(`render:${file}`, () =>
      blob(rewrite(strip(file, compiled.get(file)!.render), resolver(file, 'client'))),
    );
  }

  // The loader of the site asks for the client modules of the sample by component ID.
  for (const [file, result] of compiled) {
    registry().set(result.plan.id, () => import(/* @vite-ignore */ clientEntry(file)));
  }

  const entry = path(files[0]!.name);
  async function loadServer(file: string) {
    return import(/* @vite-ignore */ serverModule(file));
  }
  const loading = [];
  for (const file of compiled.keys()) {
    loading.push(loadServer(file));
  }
  const modules = await Promise.all(loading);
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
      // A sample is a lesson, not a server. In production the render logs the error that a
      // `#catch` renders and hides its message, and the sample shows that error on purpose.
      // Dev mode also turns on the dev-only checks, such as BRM185 for a block in a <p>.
      dev: true,
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
  const outputs: LiveOutput['modules'] = [];
  for (const file of files) {
    const name = path(file.name);
    const result = compiled.get(name);
    if (result) {
      const partOutputs: LiveOutput['modules'] = [];
      for (const [part, code] of Object.entries(result.parts)) {
        partOutputs.push({
          name: `${file.name}: part ${part}`,
          code,
          language: 'ts',
          client: true,
        });
      }
      outputs.push(
        { name: `${file.name}: client entry`, code: result.client, language: 'ts', client: true },
        ...partOutputs,
        { name: `${file.name}: server`, code: result.server, language: 'ts', client: false },
        { name: `${file.name}: render`, code: result.render, language: 'ts', client: true },
      );
      if (result.css) {
        outputs.push({
          name: `${file.name}: css`,
          code: result.css,
          language: 'css',
          client: false,
        });
      }
    } else if (file.name.endsWith('.brm.ts')) {
      // A module of reactive logic: components copy its functions, and the browser shares this code.
      outputs.push({
        name: `${file.name}: shared browser code`,
        code: generateShared({ path: name, source: file.source }).code,
        language: 'ts',
        client: true,
      });
    }
  }
  for (const module of outputs) {
    module.code = clean(module.code);
  }
  return { modules: outputs, warnings };
}
