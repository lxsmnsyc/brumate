import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyzeProject, compile } from '../../src/index.ts';
import { resolveFromDisk } from '../../src/modules.ts';
import { generateShared } from '../../src/shared-module.ts';
import { handleRequest, render as renderParts } from '../../src/runtime/server.ts';
import type { Scope } from '../../src/runtime/client/state.ts';
import { CAUSES, DIVERGENCES, OPT_OUTS, PROPS } from './data.ts';

let input = '';
let output = '';
const file = (name: string): string => pathToFileURL(join(output, name)).href;
const modules = new Map<string, string>();
const planIds = new Map<string, string>();
const pages: string[] = [];
const texts = new Map<string, string>();

function toRender(code: string): string {
  return code
    .replace(/\.brm\?brumate-render"/g, '.brm.render.ts"')
    .replace(/\.brm\?brumate-client&part=(\w+)"/g, '.brm.client.$1.ts"')
    .replace(/\.brm\?brumate-client"/g, '.brm.client.ts"')
    .replace(/\.brm\.ts\?brumate-shared"/g, '.brm.ts.shared.ts"');
}

/** A JavaScript expression for a prop value of the table. */
function expression(value: unknown): string {
  if (value instanceof Date) {
    return `new Date(${JSON.stringify(value.toISOString())})`;
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => expression(item)).join(', ')}]`;
  }
  if (value && typeof value === 'object') {
    const entries: string[] = [];
    for (const [key, item] of Object.entries(value)) {
      entries.push(`${JSON.stringify(key)}: ${expression(item)}`);
    }
    return `{ ${entries.join(', ')} }`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

/** A page that toggles the page under test into the browser's markup, with the same props. */
function wrapper(name: string, props: Record<string, unknown>): string {
  const attributes: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    attributes.push(`${key}=(${expression(value)})`);
  }
  return [
    '<script>',
    "  import { $signal } from 'brumate/signals';",
    `  import Page from './${name}.brm';`,
    '  let on = $signal(false);',
    '</script>',
    '<button class="diff-open" onClick=(() => (on = true))>Open</button>',
    '<div class="diff-host">',
    '  #if (on) {',
    `    <Page ${attributes.join(' ')} />`,
    '  }',
    '</div>',
    '',
  ].join('\n');
}

/** Compiles every test page, and the toggle page of each page of this shard. */
function prepare(): void {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const sources = new Map<string, string>();
  for (const name of readdirSync(input)) {
    copyFileSync(join(input, name), join(output, name));
    if (name.endsWith('.brm.ts')) {
      // The code of a module function that the browser runs, shared by every call.
      const module = { path: join(input, name), source: readFileSync(join(input, name), 'utf8') };
      writeFileSync(join(output, `${name}.shared.ts`), generateShared(module).code);
    }
    if (name.endsWith('.brm')) {
      sources.set(name, readFileSync(join(input, name), 'utf8'));
      texts.set(name.slice(0, -4), sources.get(name)!);
    }
  }
  for (const base of pages) {
    sources.set(`${base}.diff.brm`, wrapper(base, PROPS[base] ?? {}));
  }
  const liveProps = analyzeProject(sources);
  const forms = {
    path: join(output, 'forms.brm.ts'),
    source: readFileSync(resolve(import.meta.dirname, '../../forms/forms.brm.ts'), 'utf8'),
  };
  writeFileSync(join(output, 'forms.brm.ts'), forms.source);
  writeFileSync(join(output, 'forms.brm.ts.shared.ts'), generateShared(forms).code);
  const resolveModule = (specifier: string, importer: string) =>
    specifier === 'brumate/forms' ? forms : resolveFromDisk(specifier, importer);
  for (const [name, source] of sources) {
    if (name.endsWith('.diff.brm')) {
      writeFileSync(join(output, name), source);
    }
    const { server, client, parts, render, plan } = compile(source, {
      filename: name,
      liveProps: liveProps.get(name),
      path: join(output, name),
      resolveModule,
      sendableClasses: ['Money'],
    });
    for (const [part, code] of Object.entries(parts)) {
      writeFileSync(join(output, `${name}.client.${part}.ts`), toRender(code));
    }
    writeFileSync(join(output, `${name}.ts`), server.replace(/\.brm(['"])/g, '.brm.ts$1'));
    writeFileSync(join(output, `${name}.client.ts`), toRender(client));
    writeFileSync(join(output, `${name}.render.ts`), toRender(render));
    modules.set(plan.id, file(`${name}.client.ts`));
    planIds.set(name.slice(0, -4), plan.id);
  }
}

let stop: (() => void) | undefined;
/** Counts the pages, so a stream of an earlier page adds nothing to a later one. */
let generation = 0;

// Client code of the pages fails on purpose, and a page can leave a rejected promise behind. Both
// are part of what a render does, so they are collected for the page, not left to the test runner.
const loose: string[] = [];
const collect = (error: unknown): void => {
  loose.push(String(error));
};
const saved = {
  rejection: process.listeners('unhandledRejection'),
  exception: process.listeners('uncaughtException'),
};

beforeAll(() => {
  process.removeAllListeners('unhandledRejection');
  process.removeAllListeners('uncaughtException');
  process.on('unhandledRejection', collect);
  process.on('uncaughtException', collect);
});

afterAll(() => {
  process.off('unhandledRejection', collect);
  process.off('uncaughtException', collect);
  for (const listener of saved.rejection) {
    process.on('unhandledRejection', listener as never);
  }
  for (const listener of saved.exception) {
    process.on('uncaughtException', listener as never);
  }
});

afterEach(() => {
  stop?.();
  stop = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function run(script: Element): void {
  Object.defineProperty(document, 'currentScript', { configurable: true, value: script });
  try {
    // oxlint-disable-next-line no-eval -- The script is a state record from the server.
    (0, eval)(script.textContent!);
  } finally {
    delete (document as { currentScript?: unknown }).currentScript;
  }
}

function appendChunk(html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const node of Array.from(template.content.childNodes)) {
    document.body.append(node);
    if (node.nodeName === 'SCRIPT' && !(node as Element).hasAttribute('type')) {
      run(node as Element);
    }
  }
}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

interface Seen {
  html: string;
  head: string;
  styles: string[];
  slots: string[];
  errors: string[];
}

/** Plain text for a slot value, without the identity of functions, nodes and scopes. */
function plain(value: unknown, order: Map<unknown, number>, depth = 0): unknown {
  if (typeof value === 'function') {
    return '[function]';
  }
  if (value instanceof Promise) {
    return '[promise]';
  }
  if (typeof Node !== 'undefined' && value instanceof Node) {
    return '[node]';
  }
  if (value instanceof Date) {
    return `[date ${value.toISOString()}]`;
  }
  if (depth > 4) {
    return '[deep]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => plain(item, order, depth + 1));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      // A reference to a scope, such as a `ref`, by the place of the scope in the page.
      result[key] =
        key === 'scope' && (typeof item === 'number' || typeof item === 'string')
          ? `[scope ${order.get(item) ?? '?'}]`
          : plain(item, order, depth + 1);
    }
    return result;
  }
  return value;
}

/**
 * Renames generated IDs by where they first appear. The server and the browser make them from
 * different counters, and only which elements share one matters.
 */
function numberIds(text: string): string {
  const names = new Map<string, string>();
  return text.replace(/\bb-?\d+(?:_\d+)*-\d+\b/g, (id) => {
    if (!names.has(id)) {
      names.set(id, `id${names.size}`);
    }
    return names.get(id)!;
  });
}

/** The text of the style sheets of the document, wherever they are. */
function stylesOf(): string[] {
  const result: string[] = [];
  for (const style of document.querySelectorAll('style')) {
    result.push(style.textContent!.replace(/\s+/g, ' ').trim());
  }
  return result.toSorted();
}

/**
 * The markup the user sees: no comments, no `b-` attributes, no scripts, no style sheets, and
 * attributes in alphabetical order. `unwrap` leaves out the toggle and the host of the browser
 * render, so a page reads the same in both.
 */
function markup(root: Element, unwrap = false): string {
  const copy = root.cloneNode(true) as Element;
  for (const node of copy.querySelectorAll('script, style')) {
    node.remove();
  }
  if (unwrap) {
    copy.querySelector('.diff-open')?.remove();
    const host = copy.querySelector('.diff-host');
    host?.replaceWith(...Array.from(host.childNodes));
  }
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_ALL);
  const comments: Node[] = [];
  const elements: Element[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.COMMENT_NODE) {
      comments.push(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      elements.push(node as Element);
    }
  }
  for (const comment of comments) {
    comment.parentNode!.removeChild(comment);
  }
  for (const element of elements) {
    const attributes: [string, string][] = [];
    for (const name of element.getAttributeNames()) {
      if (!name.startsWith('b-')) {
        attributes.push([name, element.getAttribute(name)!]);
      }
      element.removeAttribute(name);
    }
    attributes.sort((x, y) => (x[0] < y[0] ? -1 : 1));
    for (const [name, value] of attributes) {
      element.setAttribute(name, value);
    }
  }
  copy.normalize();
  return numberIds(copy.innerHTML.replace(/></g, '>\n<'));
}

/**
 * The slot values of the scopes under the root scope of the page, sorted. The browser makes
 * scopes in another order, and makes scopes with no slots, which the server does not send.
 */
async function slotsOf(rootId: string): Promise<string[]> {
  const { scopes } = await import('../../src/runtime/client/state.ts');
  const all = [...scopes.values()];
  const root = all.find((scope) => scope.m === rootId);
  const inside = (scope: Scope): boolean => {
    for (let at: Scope | undefined = scope; at; at = at.p) {
      if (at === root) {
        return true;
      }
    }
    return false;
  };
  const mine = root ? all.filter(inside) : [];
  const order = new Map<unknown, number>();
  for (const [index, scope] of mine.entries()) {
    order.set(scope.id, index);
  }
  const result: string[] = [];
  for (const scope of mine) {
    if (scope.s.length > 0) {
      result.push(`${scope.m ?? scope.k}: ${numberIds(JSON.stringify(plain(scope.s, order)))}`);
    }
  }
  return result.toSorted();
}

/** The modules of the page that the loader is still importing. */
let loading = 0;

/**
 * Waits until the page has not changed for `quiet` milliseconds, with no module in flight. A
 * busy machine slows imports, so the time alone is not a sign that the page is done.
 */
async function settle(quiet: number): Promise<void> {
  let last = '';
  let since = 0;
  for (let tick = 0; tick < 2000 && since < quiet; tick++) {
    // oxlint-disable-next-line no-await-in-loop -- Waits for the page to stop changing.
    await sleep(10);
    const now = document.body.innerHTML;
    since = now === last && loading === 0 ? since + 10 : 0;
    last = now;
  }
}

async function start(errors: string[]): Promise<void> {
  loose.length = 0;
  loading = 0;
  vi.resetModules();
  const { start: begin } = await import('../../src/runtime/loader.ts');
  stop = begin({
    load: async (id) => {
      loading++;
      try {
        return await import(/* @vite-ignore */ modules.get(id)!);
      } finally {
        loading--;
      }
    },
    onError: (error) => errors.push(String(error)),
  });
}

async function show(name: string, props: unknown, errors: string[], page: string): Promise<void> {
  const server = await import(/* @vite-ignore */ file(`${name}.ts`));
  // Server functions of the page answer from the module that the server rendered.
  const { rpc } = await import(/* @vite-ignore */ file(`${page}.brm.ts`));
  vi.stubGlobal('fetch', (url: string, init: RequestInit) =>
    handleRequest(rpc, new Request(`http://localhost${url}`, init)),
  );
  let rendered;
  try {
    rendered = await Promise.race([
      renderParts(server.default, props, { dev: true }),
      sleep(400).then(() => {
        throw new Error('server render did not finish');
      }),
    ]);
  } catch (error) {
    errors.push(`server: ${String(error)}`);
    return;
  }
  document.head.innerHTML = rendered.head;
  document.body.innerHTML = rendered.html + rendered.state;
  document.body.querySelectorAll('script[b-state]').forEach(run);
  await start(errors);
  const mine = generation;
  void (async () => {
    try {
      for await (const chunk of rendered.pending) {
        if (mine !== generation) {
          return;
        }
        appendChunk(chunk);
      }
    } catch (error) {
      errors.push(`pending: ${String(error)}`);
    }
  })();
}

/** How long a page must stay unchanged to count as settled: longer for pages with timers. */
function quietOf(name: string): number {
  return /setTimeout|Data(\.ts)?'/.test(texts.get(name) ?? '') ? 300 : 30;
}

/** The page rendered by the server and resumed. */
async function viaServer(name: string): Promise<Seen> {
  const errors: string[] = [];
  generation++;
  document.head.innerHTML = '';
  await show(`${name}.brm`, PROPS[name] ?? {}, errors, name);
  // The core starts when it has imported itself; a page with state has scopes by then.
  const { scopes } = await import('../../src/runtime/client/state.ts');
  for (
    let tick = 0;
    tick < 1000 && !scopes.size && document.querySelector('script[b-state]');
    tick++
  ) {
    // oxlint-disable-next-line no-await-in-loop -- Waits for the core.
    await sleep(5);
  }
  await settle(quietOf(name));
  return {
    html: markup(document.body),
    head: markup(document.head),
    styles: stylesOf(),
    slots: await slotsOf(planIds.get(name)!),
    errors: [...errors, ...loose.splice(0)],
  };
}

/** The page rendered by the browser, after a click on a toggle. */
async function viaBrowser(name: string): Promise<Seen> {
  const errors: string[] = [];
  generation++;
  document.head.innerHTML = '';
  await show(`${name}.diff.brm`, {}, errors, name);
  document
    .querySelector<HTMLElement>('.diff-open')
    ?.dispatchEvent(new Event('click', { bubbles: true }));
  // The click loads the code of the handler first, which can take a while on the first page.
  const { scopes } = await import('../../src/runtime/client/state.ts');
  const toggle = planIds.get(`${name}.diff`);
  for (let tick = 0; tick < 300; tick++) {
    const opened = [...scopes.values()].some((scope) => scope.m === toggle && scope.s[0] === true);
    if (opened) {
      break;
    }
    // oxlint-disable-next-line no-await-in-loop -- Waits for the handler to run.
    await sleep(5);
  }
  await settle(quietOf(name));
  return {
    html: markup(document.body, true),
    head: markup(document.head),
    styles: stylesOf(),
    slots: await slotsOf(planIds.get(name)!),
    errors: [...errors, ...loose.splice(0)],
  };
}

/** The pages of the shard: every page that is not an opt-out, by name, every `shards`-th one. */
function pagesOf(shard: number, shards: number): string[] {
  const names: string[] = [];
  for (const name of readdirSync(input).toSorted()) {
    if (name.endsWith('.brm') && !OPT_OUTS[name.slice(0, -4)]) {
      names.push(name.slice(0, -4));
    }
  }
  const mine: string[] = [];
  for (const [index, name] of names.entries()) {
    if (index % shards === shard) {
      mine.push(name);
    }
  }
  return mine;
}

/**
 * Renders the pages of one shard twice, as the server and resumed, and as the browser after a
 * toggle, and compares them. A page that is in `DIVERGENCES` must still differ, so a fix shows.
 */
export function differential(shard: number, shards: number): void {
  input = resolve(import.meta.dirname, '../render');
  output = resolve(import.meta.dirname, `../.output/differential-${shard}`);
  pages.push(...pagesOf(shard, shards));
  beforeAll(prepare, 120000);
  const same: string[] = [];
  const differ: string[] = [];
  for (const name of pages) {
    (DIVERGENCES[name] ? differ : same).push(name);
  }
  describe('differential render', () => {
    it.each(same)('%s', async (name) => {
      const server = await viaServer(name);
      stop?.();
      document.body.innerHTML = '';
      expect(await viaBrowser(name)).toEqual(server);
    });
    // The page differs for the cause it names. When the two match, the case is fixed.
    it.each(differ)('%s (known divergence)', async (name) => {
      const server = await viaServer(name);
      stop?.();
      document.body.innerHTML = '';
      const browser = await viaBrowser(name);
      expect(
        CAUSES[DIVERGENCES[name]!],
        `${name} names a cause that is not in CAUSES`,
      ).toBeDefined();
      expect(browser, `${name} no longer differs: remove it from DIVERGENCES`).not.toEqual(server);
    });
  });
}
