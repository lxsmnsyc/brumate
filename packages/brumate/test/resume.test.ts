// @vitest-environment happy-dom
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyzeProject, compile } from '../src/index.ts';
import { generateShared } from '../src/shared-module.ts';
import { render as renderParts, stateScript } from '../src/runtime/server.ts';
import { toChunkStream } from '../src/runtime/stream.ts';

// The DOM environment replaces URL, so paths are plain strings.
const input = resolve(import.meta.dirname, 'render');
const output = resolve(import.meta.dirname, '.output/resume');
const file = (name: string): string => pathToFileURL(join(output, name)).href;
const modules = new Map<string, string>();

beforeAll(() => {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const sources = new Map(
    readdirSync(input)
      .filter((name) => name.endsWith('.brm'))
      .map((name) => [name, readFileSync(join(input, name), 'utf8')]),
  );
  // Compiled as the Vite plugin does, with the props that parents can change.
  const liveProps = analyzeProject(sources);
  for (const name of readdirSync(input)) {
    if (!name.endsWith('.brm')) {
      copyFileSync(join(input, name), join(output, name));
      // The code of a module function that the browser runs, shared by every call.
      if (name.endsWith('.brm.ts')) {
        const module = { path: join(input, name), source: readFileSync(join(input, name), 'utf8') };
        writeFileSync(join(output, `${name}.shared.ts`), generateShared(module).code);
      }
      continue;
    }
    const { server, client, parts, render, plan } = compile(sources.get(name)!, {
      filename: name,
      liveProps: liveProps.get(name),
      path: join(input, name),
    });
    for (const [part, code] of Object.entries(parts)) {
      writeFileSync(join(output, `${name}.client.${part}.ts`), toRender(code));
    }
    writeFileSync(join(output, `${name}.ts`), server.replace(/\.brm'/g, ".brm.ts'"));
    writeFileSync(join(output, `${name}.client.ts`), toRender(client));
    writeFileSync(join(output, `${name}.render.ts`), toRender(render));
    modules.set(plan.id, file(`${name}.client.ts`));
  }
});

let stop: (() => void) | undefined;

/** Points imports of render modules and client parts at the files that the tests write. */
function toRender(code: string): string {
  return code
    .replace(/\.brm\?brumate-render"/g, '.brm.render.ts"')
    .replace(/\.brm\?brumate-client&part=(\w+)"/g, '.brm.client.$1.ts"')
    .replace(/\.brm\.ts\?brumate-shared"/g, '.brm.ts.shared.ts"');
}

/**
 * Runs an inline script, as a browser does. The test DOM does not run
 * scripts, so it runs with a global eval, with the script as
 * `document.currentScript`, which a state record reads.
 */
function run(script: Element): void {
  Object.defineProperty(document, 'currentScript', { configurable: true, value: script });
  try {
    // oxlint-disable-next-line no-eval -- The script is a state record or the swap code from the server.
    (0, eval)(script.textContent!);
  } finally {
    delete (document as { currentScript?: unknown }).currentScript;
  }
}

/** Shows a page and runs its state records, as a browser does while it parses the page. */
function show(html: string): void {
  document.body.innerHTML = html;
  document.body.querySelectorAll('script[data-state]').forEach(run);
}

/** Appends streamed markup and runs its inline scripts in order, as a browser does. */
function appendChunk(html: string, parent: Element = document.body): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  // A copy, because appending moves nodes out of the live list.
  for (const node of Array.from(template.content.childNodes)) {
    parent.append(node);
    if (node.nodeName === 'SCRIPT' && !(node as Element).hasAttribute('type')) {
      run(node as Element);
    }
  }
}

function inputIds(): string[] {
  return [...document.querySelectorAll('input')].map((field) => field.id);
}

function items(): string[] {
  return [...document.querySelectorAll('li')].map((li) => li.textContent!);
}

function buttons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('li button')];
}

afterEach(() => {
  stop?.();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

/** Delays loading some parts, to test the order in which handlers run. */
type PartDelays = Record<string, number>;

/** The parts that the loader and the core loaded, as `<component>:<part>`. */
const loadedParts: string[] = [];

async function resume(name: string, props: unknown, delays: PartDelays = {}): Promise<void> {
  loadedParts.length = 0;
  const server = await import(file(`${name}.brm.ts`));
  const { html, state } = await renderParts(server.default, props);
  show(html + state);
  vi.resetModules();
  const { start } = await import('../src/runtime/loader.ts');
  stop = start({
    load: async (id) => {
      const module = await import(modules.get(id)!);
      return {
        ...module,
        load: async (part: string) => {
          loadedParts.push(`${id}:${part}`);
          await new Promise((done) => setTimeout(done, delays[part] ?? 0));
          return module.load(part);
        },
      };
    },
  });
}

/**
 * Waits for an assertion. The first event in a test imports modules that the
 * test runner transforms on demand, which can take more than a second when
 * other test files run at the same time.
 */
function waitFor(assertion: () => void): Promise<void> {
  return vi.waitFor(assertion, { timeout: 5000 });
}

function text(selector: string): string {
  return document.querySelector(selector)!.textContent!;
}

/**
 * Marks a state record as navigation does for a page whose IDs it moved by 5.
 * It marks every record, also the ones that only settle promises.
 */
function moved(record: string): string {
  return record.replace('<script ', '<script data-offset="5" data-root="5" ');
}

function click(element: Element): void {
  element.dispatchEvent(new Event('click', { bubbles: true }));
}

describe('resume', () => {
  it('reads state records that run after the core starts, also inside other markup', async () => {
    const { streamState } = await import('../src/runtime/server.ts');
    const records: string[] = [];
    await streamState({ 0: { k: 1, m: 'Test', s: [7] } }, (record) => {
      records.push(stateScript(record, records.length === 0, { define: true }));
    });
    document.body.innerHTML = '';
    vi.resetModules();
    const client = await import('../src/runtime/client.ts');
    client.init({
      load: async () => ({ id: 'Test', props: {}, g: {}, load: async () => ({}) }),
      listen: () => {},
    });
    const holder = document.createElement('div');
    document.body.append(holder);
    appendChunk(`<p>Inserted</p>${records[0]!}`, holder);
    // The core reads a record as soon as its script runs.
    expect(client.get(client.scopeOf(0)!, 0)).toBe(7);
    client.dispose();
  });

  it('settles promises from state records that arrive later', async () => {
    const { streamState } = await import('../src/runtime/server.ts');
    let settle!: (value: number) => void;
    const pending = new Promise<number>((done) => {
      settle = done;
    });
    const records: string[] = [];
    const done = streamState({ 0: { k: 1, m: 'Test', s: [pending] } }, (record) => {
      records.push(stateScript(record, records.length === 0, { define: records.length === 0 }));
    });
    expect(records).toHaveLength(1);
    show(records[0]!);

    vi.resetModules();
    const client = await import('../src/runtime/client.ts');
    client.init({
      load: async () => ({ id: 'Test', props: {}, g: {}, load: async () => ({}) }),
      listen: () => {},
    });
    const value = client.get(client.scopeOf(0)!, 0);
    expect(value).toBeInstanceOf(Promise);

    settle(42);
    await done;
    expect(records).toHaveLength(2);
    appendChunk(records[1]!);
    await expect(value).resolves.toBe(42);
    // The slot holds the value once it arrives.
    await waitFor(() => expect(client.get(client.scopeOf(0)!, 0)).toBe(42));
    client.dispose();
  });

  it('moves the IDs of a page whose records start elsewhere, and settles its promises', async () => {
    const { streamState } = await import('../src/runtime/server.ts');
    let settle!: (value: number) => void;
    const pending = new Promise<number>((done) => {
      settle = done;
    });
    const records: string[] = [];
    const done = streamState({ 0: { k: 1, m: 'Test', s: [pending] } }, (record) => {
      records.push(stateScript(record, records.length === 0, { define: records.length === 0 }));
    });
    show(moved(records[0]!));

    vi.resetModules();
    const client = await import('../src/runtime/client.ts');
    client.init({
      load: async () => ({ id: 'Test', props: {}, g: {}, load: async () => ({}) }),
      listen: () => {},
    });
    expect(client.scopeOf(0)).toBeUndefined();
    expect(client.get(client.scopeOf(5)!, 0)).toBeInstanceOf(Promise);

    settle(42);
    await done;
    // Reading this record threw before, as an uncaught error that fails the run.
    appendChunk(moved(records[1]!));
    await waitFor(() => expect(client.get(client.scopeOf(5)!, 0)).toBe(42));
    client.dispose();
  });

  it('swaps in #loading bodies that stream after the page', async () => {
    const server = await import(file('loading.brm.ts'));
    const { html, state, pending } = await renderParts(server.default, {});
    show(html + state);
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });
    expect(text('.fallback')).toBe('Loading');

    server.release('Ada');
    for await (const chunk of pending) {
      appendChunk(chunk);
    }
    expect(document.querySelector('.fallback')).toBeNull();
    expect(text('.greeting')).toBe('Hello Ada');
    expect(document.querySelector('template[data-l]')).toBeNull();

    // The streamed body resumes, and updates with the rest of the page.
    click(document.querySelector('.inner')!);
    await waitFor(() => expect(text('.inner')).toBe('1'));
    expect(text('.outer')).toBe('1');
  });

  it('scopes styles and updates style variables', async () => {
    await resume('styled', {});
    expect(document.querySelectorAll('style[data-brm]')).toHaveLength(1);
    const first = document.querySelector<HTMLElement>('.note')!;
    expect(first.style.getPropertyValue('--s-9wx0az-0')).toBe('blue');
    expect(first.style.getPropertyValue('padding')).toBe('1px');
    expect(first.querySelector('b')!.getAttribute('style')).toBeNull();

    click(document.querySelector('button')!);
    await waitFor(() => expect(first.style.getPropertyValue('--s-9wx0az-0')).toBe('red'));
    expect(first.style.getPropertyValue('--s-9wx0az-1')).toBe('20px');
    // The block that the client renders gets the current values.
    const big = document.querySelector<HTMLElement>('.big')!;
    expect(big.style.getPropertyValue('--s-9wx0az-0')).toBe('red');
    expect(big.hasAttribute('s-9wx0az')).toBe(true);
  });

  it('adds the stylesheet when the client renders a component first', async () => {
    vi.resetModules();
    const render = await import(file('styled.brm.render.ts'));
    document.head.innerHTML = '';
    render.default({});
    render.default({});
    expect(document.head.querySelectorAll('style[data-brm="Styled_9wx0az"]')).toHaveLength(1);
  });

  it('renders portals at the end of the page and into targets', async () => {
    await resume('portal', {});
    // The server writes portal content after the rest of the page.
    expect(document.querySelector('.host')!.textContent!.trim()).toBe('');
    expect(document.body.lastElementChild?.matches('script, p.note')).toBe(true);
    expect(text('p.note')).toBe('Always here');
    // A portal into a target renders when the page loads.
    await waitFor(() => expect(text('#target .targeted')).toBe('In the target'));

    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(document.querySelector('body > dialog.modal')).not.toBeNull());
    expect(document.querySelector('.host dialog')).toBeNull();

    // Content in a portal resumes, and goes away with its block.
    click(document.querySelector('.close')!);
    await waitFor(() => expect(document.querySelector('dialog')).toBeNull());
  });

  it('changes lists with $produce', async () => {
    await resume('produce', {});
    const [first, second] = document.querySelectorAll('li');
    click(second!);
    await waitFor(() => expect(second!.className).toBe('done'));
    expect(text('p')).toBe('1 done');
    expect(first!.getAttribute('class')).toBeNull();

    click(document.querySelector('.add')!);
    await waitFor(() => expect(document.querySelectorAll('li')).toHaveLength(3));
    // Items that stay keep their elements.
    expect(document.querySelectorAll('li')[0]).toBe(first);
    expect(document.querySelectorAll('li')[1]).toBe(second);
    expect(text('li:last-child')).toBe('New');
  });

  it('preloads handlers when the browser is idle', async () => {
    await resume('prefetch', {});
    // Without a click, the idle button's handler part loads, and the other one does not.
    await waitFor(() => expect(loadedParts).toContain('Prefetch_okfwof:h1'));
    expect(loadedParts).not.toContain('Prefetch_okfwof:h3');
  });

  it('renders a #try body again with reset', async () => {
    await resume('retry', {});
    expect(text('.error')).toBe('Error: Not ready');

    // The body still fails, so the fallback renders again, and its button still works.
    click(document.querySelector('.retry')!);
    await waitFor(() => expect(loadedParts).toContain('Retry_pyus3c:update'));
    await waitFor(() => expect(text('.error')).toBe('Error: Not ready'));

    const shared = await import(file('retry.brm.client.shared.ts'));
    shared.heal();
    click(document.querySelector('.retry')!);
    await waitFor(() => expect(text('.ok')).toBe('Ready'));
    expect(document.querySelector('.error')).toBeNull();
  });

  it('calls server functions with errors and redirects', async () => {
    vi.resetModules();
    // The component and the test use the same copy of the runtime, so they share the request.
    const server = await import(file('session.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    // Calls go straight to the server function handler.
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) =>
      runtime.handleRequest(server.rpc, new Request(`http://localhost${url}`, init)),
    );
    const assign = vi.fn<(url: string) => void>();
    vi.stubGlobal('location', { ...window.location, assign });
    const request = new Request('http://localhost/', { headers: { 'x-user': 'Ada' } });
    const { html, state } = await runtime.render(server.default, {}, { request });
    show(html + state);
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });
    expect(text('.user')).toBe('Ada');

    click(document.querySelector('.ok')!);
    await waitFor(() => expect(text('.message')).toBe('Hello Ada'));

    click(document.querySelector('.empty')!);
    await waitFor(() => expect(text('.message')).toBe('A name is required'));

    click(document.querySelector('.admin')!);
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/admin'));
  });

  it('loads async memos again when their inputs change', async () => {
    vi.resetModules();
    const server = await import(file('search.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) =>
      runtime.handleRequest(server.rpc, new Request(`http://localhost${url}`, init)),
    );
    const { html, state } = await runtime.render(server.default, {});
    show(html + state);
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });
    expect(items()).toEqual(['apple', 'apricot', 'banana']);

    const field = document.querySelector('input')!;
    field.value = 'ap';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    // The old results stay while the new ones load.
    await waitFor(() => expect(document.querySelector('.pending')).not.toBeNull());
    expect(items()).toEqual(['apple', 'apricot', 'banana']);

    // "b" answers before "ap", and the answer for "ap" is dropped.
    field.value = 'b';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => expect(items()).toEqual(['banana']));
    await waitFor(() => expect(document.querySelector('.pending')).toBeNull());
    await new Promise((done) => setTimeout(done, 120));
    expect(items()).toEqual(['banana']);
  });

  it('streams server function answers, sends files, and aborts calls that are out of date', async () => {
    vi.resetModules();
    const server = await import(file('stream.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) =>
      runtime.handleRequest(server.rpc, new Request(`http://localhost${url}`, init)),
    );
    const aborted: string[] = [];
    (globalThis as { aborted?: string[] }).aborted = aborted;
    const { html, state } = await runtime.render(
      server.default,
      {},
      { request: new Request('http://localhost/') },
    );
    show(html + state);
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });
    // The server renders the first value of a stream.
    expect(text('.value')).toBe('1');

    // The memo takes each value as it arrives.
    click(document.querySelector('.more')!);
    const seen = new Set<string>();
    await waitFor(() => {
      seen.add(text('.value'));
      expect(text('.value')).toBe('4');
    });
    expect(seen.size).toBeGreaterThan(1);

    // Files and blobs go as parts of form data, in arrays and objects too.
    click(document.querySelector('.upload')!);
    await waitFor(() => expect(text('.uploaded')).toBe('note.txt: hello, blob: world'));

    // A newer input aborts the call of the older one.
    const field = document.querySelector('input')!;
    aborted.length = 0;
    field.value = 'b';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((done) => setTimeout(done, 5));
    field.value = 'c';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => expect(text('.echoed')).toBe('c'));
    // The call for "b" is aborted: on the server, or before it gets there when the test runs slowly.
    await waitFor(() => expect(aborted).toContain('c:false'));
    expect(aborted).not.toContain('b:false');
    delete (globalThis as { aborted?: string[] }).aborted;
  });

  it('runs reactive logic from a module as values of the component', async () => {
    await resume('uses-counter', {});
    expect(text('.a')).toBe('1 2');
    expect(text('.b')).toBe('10');
    click(document.querySelector('.a')!);
    await waitFor(() => expect(text('.a')).toBe('2 4'));
    // Each call has its own values.
    expect(text('.b')).toBe('10');
    click(document.querySelector('.b')!);
    await waitFor(() => expect(text('.b')).toBe('11'));
    // The second call reads `base` through its parameter, so a reset takes its current value.
    click(document.querySelector('.base')!);
    await waitFor(() => expect(text('.base')).toBe('11'));
    click(document.querySelector('.b')!);
    await waitFor(() => expect(text('.b')).toBe('12'));
    click(document.querySelector('.reset')!);
    await waitFor(() => expect(text('.b')).toBe('11'));
  });

  it('updates markup that a #template renders, from an update in the browser', async () => {
    await resume('template-update', {});
    expect(text('.price')).toBe('Subtotal: 1');
    click(document.querySelector('button')!);
    await waitFor(() => expect(text('.price')).toBe('Subtotal: 2'));
    click(document.querySelector('button')!);
    await waitFor(() => expect(text('.price')).toBe('Subtotal: 3'));
    expect(document.querySelectorAll('.price')).toHaveLength(1);
  });

  it('calls functions that a context provides', async () => {
    await resume('provide-functions', {});
    expect(text('.count')).toBe('0');
    click(document.querySelector('.one')!);
    await waitFor(() => expect(text('.count')).toBe('1'));
    click(document.querySelector('.ten')!);
    await waitFor(() => expect(text('.count')).toBe('11'));
    click(document.querySelector('.reset')!);
    await waitFor(() => expect(text('.count')).toBe('0'));
  });

  it('loads a memo that returns a promise without saying so', async () => {
    await resume('doubler', {});
    expect(text('p')).toBe('2');
    click(document.querySelector('button')!);
    await waitFor(() => expect(document.querySelector('.pending')).not.toBeNull());
    expect(text('p')).toBe('2');
    await waitFor(() => expect(text('p')).toBe('4'));
    expect(document.querySelector('.pending')).toBeNull();
  });

  it('provides contexts to components, and updates them', async () => {
    await resume('themes', {});
    expect(text('.a .themed')).toBe('dark');

    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(text('.a .themed')).toBe('light'));

    // A component that the client renders reads the current value.
    click(document.querySelector('.show')!);
    await waitFor(() => expect(text('.b .themed')).toBe('light'));

    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(text('.b .themed')).toBe('dark'));
    expect(text('.a .themed')).toBe('dark');
  });

  it('creates unique IDs with $id', async () => {
    await resume('fields', {});
    expect(inputIds()).toEqual(['b0-0', 'b1-0', 'b2-0']);
    expect(document.querySelector('label')!.htmlFor).toBe('b0-0');
    expect(document.querySelector('input')!.getAttribute('aria-describedby')).toBe('b0-1');

    click(document.querySelector('button')!);
    await waitFor(() => expect(inputIds()).toHaveLength(4));
    // The client makes IDs from its own scope IDs, so they differ from the server's.
    expect(new Set(inputIds()).size).toBe(4);
    const added = document.querySelectorAll('input')[3]!;
    expect(document.querySelectorAll('label')[3]!.htmlFor).toBe(added.id);
  });

  it('updates the title and #head blocks', async () => {
    vi.resetModules();
    const server = await import(file('page.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    const { html, state, head } = await runtime.render(server.default, {});
    document.head.innerHTML = head;
    show(html + state);
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });
    expect(document.title).toBe('Count 0 <');

    click(document.querySelector('.add')!);
    await waitFor(() => expect(document.title).toBe('Count 1 <'));
    expect(document.head.querySelector('meta')!.getAttribute('content')).toBe('Clicked 1 times');

    click(document.querySelector('.open')!);
    await waitFor(() =>
      expect(document.head.querySelector('link[rel="canonical"]')).not.toBeNull(),
    );
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.head.querySelector('link')).toBeNull());
    document.head.innerHTML = '';
  });

  it('shares functions between parts', async () => {
    await resume('shared', {});
    click(document.querySelector('.one')!);
    await waitFor(() => expect(text('p')).toBe('Count: 2'));
    click(document.querySelector('.two')!);
    await waitFor(() => expect(text('p')).toBe('Count: 6'));
  });

  it('updates #loading bodies that the server rendered before a change', async () => {
    vi.resetModules();
    // A fresh copy of the module, because another test released its data.
    const fresh = await import(`${file('loading.brm.ts')}?stale`);
    const { html, state, pending } = await renderParts(fresh.default, {});
    show(html + state);
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });

    // The value changes before the body arrives.
    click(document.querySelector('.outer')!);
    await waitFor(() => expect(text('.outer')).toBe('1'));

    fresh.release('Ada');
    for await (const chunk of pending) {
      appendChunk(chunk);
    }
    expect(text('.greeting')).toBe('Hello Ada');
    // The server rendered 0, but the body shows the current value.
    await waitFor(() => expect(text('.inner')).toBe('1'));
  });

  it('finds the markers of streamed #loading bodies without reading the whole page', async () => {
    vi.resetModules();
    const fresh = await import(`${file('loading.brm.ts')}?markers`);
    const { html, state, pending } = await renderParts(fresh.default, {});
    show(html + state);
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });
    const walkers = vi.spyOn(document, 'createTreeWalker');
    const pageWalks = (): number =>
      walkers.mock.calls.filter(([root]) => root === document.documentElement).length;

    // The core reads the page once when it starts. The update to the body that is not there yet does not.
    click(document.querySelector('.outer')!);
    await waitFor(() => expect(text('.outer')).toBe('1'));
    expect(pageWalks()).toBe(1);

    fresh.release('Ada');
    for await (const chunk of pending) {
      appendChunk(chunk);
    }
    await waitFor(() => expect(text('.inner')).toBe('1'));
    click(document.querySelector('.inner')!);
    await waitFor(() => expect(text('.inner')).toBe('2'));
    expect(text('.outer')).toBe('2');
    expect(pageWalks()).toBe(1);
    walkers.mockRestore();
  });

  it('updates a counter', async () => {
    await resume('counter', {});
    expect(text('p')).toBe('0 / 0');
    click(document.querySelector('button')!);
    await waitFor(() => expect(text('p')).toBe('1 / 2'));
    click(document.querySelector('button')!);
    await waitFor(() => expect(text('p')).toBe('2 / 4'));
  });

  it('adds and toggles todos', async () => {
    const calls: [string, unknown][] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push([url, JSON.parse(init.body as string)]);
      return new Response(toChunkStream(undefined));
    });
    await resume('todos', {
      initial: [
        { id: '1', title: 'Write the docs', done: true, at: new Date('2026-10-01T00:00:00Z') },
        { id: '2', title: 'Build the compiler', done: false, at: new Date('2026-10-20T00:00:00Z') },
      ],
    });
    expect(text('p')).toBe('1 left');
    // Items that stay in place are not moved when the list changes.
    const removed: Node[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        removed.push(...record.removedNodes);
      }
    });
    observer.observe(document.querySelector('ul')!, { childList: true });

    const field = document.querySelector('input')!;
    field.value = 'Ship it';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    document.querySelector('form')!.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);

    await waitFor(() => expect(document.querySelectorAll('li')).toHaveLength(3));
    expect(text('li:last-child')).toContain('Ship it');
    expect(text('p')).toBe('2 left');
    observer.disconnect();
    expect(removed).toEqual([]);
    expect(field.value).toBe('');
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]![0]).toBe('/_brumate/Todos_t3g9lr%23persist');

    click(document.querySelector('li')!);
    await waitFor(() => expect(text('p')).toBe('3 left'));
    expect(document.querySelector('li')!.getAttribute('class')).toBeNull();

    // The new item resumes like the others.
    click(document.querySelector('li:last-child')!);
    await waitFor(() => expect(text('p')).toBe('2 left'));
    expect(document.querySelector('li:last-child')!.getAttribute('class')).toBe('done');
  });

  it('runs handlers in the order of their events', async () => {
    vi.stubGlobal('fetch', async () => new Response(toChunkStream(undefined)));
    // The input handler's part loads after the submit handler's part.
    await resume('todos', { initial: [] }, { h7: 100 });
    const field = document.querySelector('input')!;
    field.value = 'First';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    document
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => expect(document.querySelectorAll('li')).toHaveLength(1));
    expect(text('li')).toContain('First');
  });

  it('updates a child through a function prop', async () => {
    await resume('parent', {});
    const [first, second] = document.querySelectorAll('button');
    expect(first!.textContent).toBe('1');
    click(first!);
    await waitFor(() => expect(first!.textContent).toBe('2'));
    click(first!);
    await waitFor(() => expect(first!.textContent).toBe('3'));
    expect(second!.textContent).toBe('5');
  });

  it('renders components in blocks that change', async () => {
    await resume('list', {});
    expect(buttons().map((button) => button.textContent)).toEqual(['1', '2']);

    click(buttons()[0]!);
    await waitFor(() => expect(buttons()[0]!.textContent).toBe('2'));

    click(document.querySelector('.add')!);
    await waitFor(() => expect(buttons()).toHaveLength(3));
    expect(buttons()[2]!.textContent).toBe('3');
    expect(text('li:last-child span')).toBe('Item 3');

    // The child that the client rendered resumes like the others.
    click(buttons()[2]!);
    await waitFor(() => expect(buttons()[2]!.textContent).toBe('4'));

    click(document.querySelector('.show')!);
    await waitFor(() => expect(document.querySelector('section button')?.textContent).toBe('3'));
    expect(text('section .slot')).toBe('Item');
  });

  it('adds several items at once, around the items that stay', async () => {
    await resume('batch', {});
    const list = document.querySelector('ul')!;
    const removed: Node[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        removed.push(...record.removedNodes);
      }
    });
    observer.observe(list, { childList: true });
    // Each insert parses its markup in a template.
    const create = vi.spyOn(document, 'createElement');

    click(document.querySelector('.fill')!);
    await waitFor(() => expect(document.querySelectorAll('li')).toHaveLength(6));
    observer.disconnect();
    const templates = create.mock.calls.filter(([tag]) => tag === 'template');
    create.mockRestore();
    expect([...list.querySelectorAll('span')].map((span) => span.textContent)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
    ]);
    expect(buttons().map((button) => button.textContent)).toEqual(['1', '2', '3', '4', '5', '6']);
    // The items that stay are not moved, and new items next to each other go in with one insert.
    expect(removed).toEqual([]);
    expect(templates).toHaveLength(3);

    // The new items resume like the others.
    click(buttons()[4]!);
    await waitFor(() => expect(buttons()[4]!.textContent).toBe('6'));
    click(buttons()[0]!);
    await waitFor(() => expect(buttons()[0]!.textContent).toBe('2'));
    click(buttons()[1]!);
    await waitFor(() => expect(buttons()[1]!.textContent).toBe('3'));
    expect(buttons().map((button) => button.textContent)).toEqual(['2', '3', '3', '4', '6', '6']);
  });

  it('switches branches, lists and client blocks', async () => {
    await resume('blocks', { items: ['one', 'two'], tab: 'b' });
    expect(text('body > p')).toBe('B');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await waitFor(() => expect(document.querySelector('body > p')!.textContent).toBe('A'));

    expect(document.querySelectorAll('ul li')).toHaveLength(2);
    click(document.querySelector('section')!);
    await waitFor(() => expect(text('ul')).toBe('Empty'));

    await waitFor(() => expect(document.body.textContent).toContain('Client only'));
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('input')));
  });
});

describe('refs', () => {
  it('writes a ref of an outer scope after its element is in the page', async () => {
    await resume('refs', {});
    expect(text('body')).not.toContain('ready');
    click(document.querySelectorAll('button')[1]!);
    await waitFor(() => expect(text('section')).toBe('ready'));
  });
});

describe('children', () => {
  it('renders children again on the client', async () => {
    await resume('cards', {});
    expect(document.querySelector('.inner')).toBeNull();
    click(document.querySelectorAll('.open')[0]!);
    await waitFor(() => expect(text('.inner')).toBe('Hello'));
    // Closing and opening again renders them once more.
    click(document.querySelectorAll('.open')[0]!);
    await waitFor(() => expect(document.querySelector('.inner')).toBeNull());
    click(document.querySelectorAll('.open')[0]!);
    await waitFor(() => expect(text('.inner')).toBe('Hello'));
  });

  it('keeps the handlers and updates of children that the client renders', async () => {
    await resume('cards', {});
    click(document.querySelectorAll('.open')[1]!);
    await waitFor(() => expect(text('.inc')).toBe('0'));
    click(document.querySelector('.inc')!);
    await waitFor(() => expect(text('.inc')).toBe('1'));
  });

  it('updates children that the server rendered before values changed', async () => {
    await resume('cards', {});
    click(document.querySelector('.outside')!);
    click(document.querySelector('.outside')!);
    await waitFor(() => expect(document.querySelector('.outside')).not.toBeNull());
    click(document.querySelectorAll('.open')[2]!);
    await waitFor(() => expect(text('.seen')).toBe('2'));
  });

  it('skips updates to children in a closed block without reading the whole page', async () => {
    await resume('cards', {});
    const walkers = vi.spyOn(document, 'createTreeWalker');
    const pageWalks = (): number =>
      walkers.mock.calls.filter(([root]) => root === document.documentElement).length;
    click(document.querySelector('.outside')!);
    await waitFor(() => expect(pageWalks()).toBe(1));
    // The core read the page once when it started. Each update to `.seen` misses, and does not read it again.
    click(document.querySelector('.outside')!);
    click(document.querySelector('.outside')!);
    click(document.querySelectorAll('.open')[2]!);
    await waitFor(() => expect(text('.seen')).toBe('3'));
    expect(pageWalks()).toBe(1);
    walkers.mockRestore();
  });
});

describe('head in #loading', () => {
  it('moves the head of a #loading body into the head, and sets the title', async () => {
    const server = await import(file('lateHead.brm.ts'));
    const { html, state, head, pending } = await renderParts(server.default, {});
    expect(head).toBe('<title>Loading</title>');
    document.head.innerHTML = head;
    show(html + state);
    server.release('Ada');
    for await (const chunk of pending) {
      appendChunk(chunk);
    }
    expect(document.title).toBe('Profile of Ada');
    expect(document.head.querySelector('meta[name="author"]')?.getAttribute('content')).toBe('Ada');
    expect(text('.profile')).toBe('Ada');
    expect(document.querySelector('template')).toBeNull();
  });
});

describe('portal targets', () => {
  it('moves the body of a #portal when its target changes', async () => {
    await resume('movingPortal', {});
    await waitFor(() => expect(document.querySelector('#left .moved')).not.toBeNull());
    click(document.querySelector('.move')!);
    await waitFor(() => expect(document.querySelector('#right .moved')).not.toBeNull());
    expect(document.querySelectorAll('.moved')).toHaveLength(1);
    click(document.querySelector('.move')!);
    await waitFor(() => expect(document.querySelector('#left .moved')).not.toBeNull());
    expect(document.querySelectorAll('.moved')).toHaveLength(1);
  });
});

describe('dynamic tags', () => {
  it('renders again when the tag changes on the client', async () => {
    await resume('switcher', {});
    expect(document.querySelector('h1.title')?.textContent).toBe('Title');
    click(document.querySelector('.level')!);
    await waitFor(() => expect(document.querySelector('h2.title')?.textContent).toBe('Title'));
    expect(document.querySelector('h1.title')).toBeNull();
  });

  it('switches between components on the client', async () => {
    await resume('switcher', {});
    expect(text('span.info')).toBe('Hello');
    click(document.querySelector('.kind')!);
    await waitFor(() => expect(text('em.tag')).toBe('Hello'));
    expect(document.querySelector('span.info')).toBeNull();
    click(document.querySelector('.kind')!);
    await waitFor(() => expect(text('span.info')).toBe('Hello'));
  });
});

describe('style variables on dynamic tags', () => {
  it('sets and updates the style variables on a top-level dynamic tag', async () => {
    await resume('styledDynamic', {});
    const box = document.querySelector<HTMLElement>('.box')!;
    expect(box.getAttribute('style')).toMatch(/^--s-\w+-0:12px;color: red$/);
    click(document.querySelector('.grow')!);
    await waitFor(() =>
      expect(box.style.getPropertyValue(box.getAttribute('style')!.split(':')[0]!)).toBe('13px'),
    );
  });
});

describe('effect order', () => {
  it('runs an effect once per write, after the markup updates', async () => {
    const log: string[] = [];
    (globalThis as { effectLog?: string[] }).effectLog = log;
    await resume('effects', {});
    click(document.querySelector('.inc')!);
    await waitFor(() => expect(log).toEqual(['2 3 1']));
    click(document.querySelector('.inc')!);
    await waitFor(() => expect(log).toEqual(['2 3 1', '4 6 2']));
  });
});

describe('several roots', () => {
  it('resumes two roots on one page when the second starts above the first', async () => {
    const counter = await import(file('counter.brm.ts'));
    const first = await renderParts(counter.default, { label: 'One' });
    const second = await renderParts(counter.default, { label: 'Two' }, { base: first.next() });
    show(
      `<div class="one">${first.html}</div><div class="two">${second.html}</div>${first.state}${second.state}`,
    );
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: async (id) => import(modules.get(id)!) });
    const one = document.querySelector('.one button')!;
    const two = document.querySelector('.two button')!;
    click(one);
    await waitFor(() => expect(document.querySelector('.one p')!.textContent).toBe('1 / 2'));
    expect(document.querySelector('.two p')!.textContent).toBe('0 / 0');
    click(two);
    click(two);
    await waitFor(() => expect(document.querySelector('.two p')!.textContent).toBe('2 / 4'));
    expect(document.querySelector('.one p')!.textContent).toBe('1 / 2');
  });
});

describe('pending through memos', () => {
  it('is pending while a memo that the memo reads loads', async () => {
    await resume('pendingChain', {});
    expect(text('.label')).toBe('Value 2');
    expect(document.querySelector('.pending')).toBeNull();
    click(document.querySelector('.next')!);
    await waitFor(() => expect(document.querySelector('.pending')).not.toBeNull());
    expect(text('.label')).toBe('Value 2');
    await waitFor(() => expect(text('.label')).toBe('Value 4'));
    expect(document.querySelector('.pending')).toBeNull();
  });
});

describe('$action', () => {
  it('renders the result of a form post to the page', async () => {
    const server = await import(file('signup.brm.ts'));
    const plain = await renderParts(server.default, {});
    const form = /<form[^>]*>/.exec(plain.html)![0];
    expect(form).toMatch(/action="\?__action=Signup_\w+%23signUp" method="post"/);
    expect(form).toMatch(/data-action="Signup_\w+#signUp" data-result="\d+:\d+"/);
    expect(plain.html).not.toContain('class="error"');
    // A page that renders for a post gets the result of the server function.
    const signUp = Object.values(server.rpc)[0];
    const posted = await renderParts(
      server.default,
      {},
      {
        actions: new Map([[signUp, { error: 'Enter an email address', email: '' }]]),
      },
    );
    expect(posted.html).toContain('<p class="error">');
    expect(posted.html).toContain('Enter an email address');
  });

  it('sends the form with fetch and writes the result into the page', async () => {
    vi.resetModules();
    const server = await import(file('signup.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    let release: (() => void) | undefined;
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      await new Promise<void>((done) => {
        release = done;
      });
      return runtime.handleRequest(server.rpc, new Request(`http://localhost${url}`, init));
    });
    const { html, state } = await runtime.render(server.default, {});
    show(html + state);
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });

    const form = document.querySelector<HTMLFormElement>('.signup')!;
    form.querySelector('input')!.value = 'nope';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => expect(document.querySelector('.pending')).not.toBeNull());
    release!();
    await waitFor(() => expect(text('.error')).toBe('Enter an email address'));
    expect(document.querySelector('.pending')).toBeNull();

    form.querySelector('input')!.value = 'ada@example.com';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => expect(document.querySelector('.pending')).not.toBeNull());
    release!();
    await waitFor(() => expect(text('.welcome')).toBe('Welcome ada@example.com'));
    expect(document.querySelector('.error')).toBeNull();
  });
});

describe('refresh', () => {
  it('loads again the memos that call a server function that another one refreshed', async () => {
    vi.resetModules();
    const server = await import(file('refreshList.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) =>
      runtime.handleRequest(server.rpc, new Request(`http://localhost${url}`, init)),
    );
    const { html, state, pending } = await runtime.render(server.default, {});
    show(html + state);
    for await (const chunk of pending) {
      appendChunk(chunk);
    }
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });
    expect(items()).toEqual(['Ada']);
    click(document.querySelector('.add')!);
    await waitFor(() => expect(items()).toEqual(['Ada', 'Grace']));
  });

  it('lists the memos to load again in the client entry', () => {
    const { client } = compile(readFileSync(join(input, 'refreshList.brm'), 'utf8'), {
      filename: 'refreshList.brm',
    });
    expect(client).toMatch(
      /export const refresh = \{ "RefreshList_\w+#list": \[\[1, "m\d+"\]\] \};/,
    );
  });
});

describe('server functions of the module script', () => {
  it('calls them from client parts', async () => {
    vi.resetModules();
    const server = await import(file('moduleServer.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) =>
      runtime.handleRequest(server.rpc, new Request(`http://localhost${url}`, init)),
    );
    const { html, state } = await runtime.render(server.default, {});
    show(html + state);
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });
    click(document.querySelector('.one')!);
    await waitFor(() => expect(text('.count')).toBe('1'));
    click(document.querySelector('.two')!);
    await waitFor(() => expect(text('.count')).toBe('2'));
  });
});

describe('hot updates of markup', () => {
  it('keeps the values of signals by name when the page renders again', async () => {
    await resume('counter', {});
    click(document.querySelector('button')!);
    click(document.querySelector('button')!);
    await waitFor(() => expect(text('p')).toBe('2 / 4'));
    const { plan } = compile(readFileSync(join(input, 'counter.brm'), 'utf8'), {
      filename: 'counter.brm',
    });
    const id = plan.id;
    const names = Object.fromEntries(
      [...plan.scopes.values()].map((layout) => [
        layout.scope.id,
        layout.slots.map((slot) => slot.name),
      ]),
    );
    // As hot.ts does: the core keeps the values, then the page renders again.
    document.dispatchEvent(
      new CustomEvent('brumate:remount', {
        detail: [{ id, before: names, after: names, signals: ['count'] }],
      }),
    );
    // As the client router does: the core forgets the old page, and reads the new one.
    const core = await import('../src/runtime/client.ts');
    core.leavePage();
    const server = await import(file('counter.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    show(html + state);
    core.init({ load: (name: string) => import(modules.get(name)!) } as never);
    await waitFor(() => expect(text('p')).toBe('2 / 4'));
    click(document.querySelector('button')!);
    await waitFor(() => expect(text('p')).toBe('3 / 6'));
  });
});

describe('$optimistic', () => {
  it('shows a guess while a form posts, and goes back to the source after', async () => {
    vi.resetModules();
    const server = await import(file('optimistic.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    let release: (() => void) | undefined;
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      // Posts of the form wait, and loads of the list answer at once.
      if (url.includes('sign')) {
        await new Promise<void>((done) => {
          release = done;
        });
      }
      return runtime.handleRequest(server.rpc, new Request(`http://localhost${url}`, init));
    });
    const { html, state, pending } = await runtime.render(server.default, {});
    show(html + state);
    for await (const chunk of pending) {
      appendChunk(chunk);
    }
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });
    expect(items()).toEqual(['Ada']);

    const form = document.querySelector<HTMLFormElement>('.sign')!;
    const post = (name: string): void => {
      form.querySelector('input')!.value = name;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    };
    post('Grace');
    await waitFor(() => expect(items()).toEqual(['Ada', 'Grace']));
    release!();
    // The refreshed list replaces the guess, with the same names.
    await new Promise((done) => setTimeout(done, 50));
    expect(items()).toEqual(['Ada', 'Grace']);

    // A post that fails puts the list back.
    post('nobody');
    await waitFor(() => expect(items()).toEqual(['Ada', 'Grace', 'nobody']));
    release!();
    await waitFor(() => expect(items()).toEqual(['Ada', 'Grace']));
  });
});

describe('a promise passed as a prop', () => {
  it('loads a memo of the prop again when the parent passes a new promise', async () => {
    const server = await import(file('promiseParent.brm.ts'));
    const { html, state, pending } = await renderParts(server.default, {});
    show(html + state);
    for await (const chunk of pending) {
      appendChunk(chunk);
    }
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });
    expect(text('.name')).toBe('User 1');
    click(document.querySelector('.next')!);
    await waitFor(() => expect(document.querySelector('.pending')).not.toBeNull());
    expect(text('.name')).toBe('User 1');
    await waitFor(() => expect(text('.name')).toBe('User 2'));
    expect(document.querySelector('.pending')).toBeNull();
  });

  it('does the same for a destructured prop', async () => {
    const server = await import(file('promiseParentDestructured.brm.ts'));
    const { html, state, pending } = await renderParts(server.default, {});
    show(html + state);
    for await (const chunk of pending) {
      appendChunk(chunk);
    }
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });
    expect(text('.name')).toBe('User 1');
    click(document.querySelector('.next')!);
    await waitFor(() => expect(document.querySelector('.pending')).not.toBeNull());
    expect(text('.name')).toBe('User 1');
    await waitFor(() => expect(text('.name')).toBe('User 2'));
    expect(document.querySelector('.pending')).toBeNull();
  });
});

/** The records of the scopes of a render, as the server holds them before it writes them. */
async function serverRecords(name: string, props: unknown): Promise<Record<number, unknown>> {
  const server = await import(file(`${name}.brm.ts`));
  const { Context } = await import('../src/runtime/server.ts');
  const ctx = new Context();
  await server.default(props, ctx);
  return Object.fromEntries(
    Object.entries(ctx.state).map(([id, record]) => [
      id,
      {
        k: record.k,
        p: record.p,
        o: record.o,
        m: record.m,
        i: record.i,
        c: record.c,
        // Both sides hold a function for a client function. They compare by kind.
        s: (record.s ?? []).map((value) => (typeof value === 'function' ? 'fn' : value)),
      },
    ]),
  );
}

/** The same fields of the scopes that the client read from the page, with IDs moved by `by`. */
async function clientRecords(ids: string[], by = 0): Promise<Record<number, unknown>> {
  const client = await import('../src/runtime/client.ts');
  return Object.fromEntries(
    ids.map((id) => {
      const scope = client.scopeOf(Number(id) + by)!;
      const back = (value: number | undefined): number | undefined =>
        value === undefined ? undefined : value - by;
      return [
        id,
        {
          k: scope.k,
          p: back(scope.p?.id),
          o: back(scope.o?.id),
          m: scope.m,
          i: scope.i,
          c:
            scope.c &&
            Object.fromEntries(
              Object.entries(scope.c).map(([anchor, child]) => [anchor, back(child)]),
            ),
          s: scope.s.map((value) => (typeof value === 'function' ? 'fn' : value)),
        },
      ];
    }),
  );
}

/** The labels of the rows of `packed.brm`. */
const labels = (): string[] =>
  [...document.querySelectorAll('.label')].map((label) => label.textContent!);
/** The tags of each row of `packed.brm`. */
const tags = (): string[] =>
  [...document.querySelectorAll('.row')].map((row) =>
    [...row.querySelectorAll('em')].map((em) => em.textContent).join(' '),
  );

describe('scopes in groups', () => {
  const rows = [
    { id: '1', label: 'One', tags: ['a', 'b'] },
    { id: '2', label: 'Two', tags: ['c', 'd'] },
    { id: '3', label: 'Three', tags: ['e', 'f'] },
  ];

  it('writes list items as groups and reads every field of their scopes back', async () => {
    const expected = await serverRecords('packed', { initial: rows });
    const server = await import(file('packed.brm.ts'));
    const { state } = await renderParts(server.default, { initial: rows });
    // The items of each list are in a group, not in a record each.
    expect(state).toContain('g:');
    expect(state).not.toMatch(/k:2,p:0/);
    await resume('packed', { initial: rows });
    // Kinds, parents, owners, items, child components and slots, for every kind of group:
    // items whose item is their first slot, items with their own item, nested lists, the
    // root scopes of components in items, and items of a Set and of #repeat.
    // The core starts on the first event, or when something asks for it.
    const client = await import('../src/runtime/client.ts');
    document.dispatchEvent(new Event('brumate:core'));
    await waitFor(() => expect(client.scopeOf(0)).toBeDefined());
    expect(await clientRecords(Object.keys(expected))).toEqual(expected);
  });

  it('moves the IDs of scopes in groups', async () => {
    const expected = await serverRecords('packed', { initial: rows });
    const server = await import(file('packed.brm.ts'));
    const { html, state } = await renderParts(server.default, { initial: rows });
    show(html + moved(state));
    vi.resetModules();
    const client = await import('../src/runtime/client.ts');
    client.init({
      load: async (id) => ({ id, props: {}, g: {}, load: async () => ({}) }),
      listen: () => {},
    });
    expect(client.scopeOf(1)).toBeUndefined();
    expect(await clientRecords(Object.keys(expected), 5)).toEqual(expected);
    client.dispose();
  });

  it('settles promises in the slots of scopes in groups', async () => {
    const { streamState } = await import('../src/runtime/server.ts');
    let settle!: (value: number) => void;
    const pending = new Promise<number>((done) => {
      settle = done;
    });
    const records: string[] = [];
    const done = streamState(
      {
        0: { k: 1, m: 'Test', s: [] },
        1: { k: 2, p: 0, s: [pending], i: pending },
        2: { k: 2, p: 0, s: [7], i: 7 },
        // A record with fields that groups do not hold keeps its own.
        3: { k: 2, p: 0, s: [8], x: { theme: 0 } },
      },
      (record) => {
        records.push(stateScript(record, records.length === 0, { define: records.length === 0 }));
      },
    );
    expect(records[0]).toContain('g:');
    expect(records[0]).toContain('3:');
    show(records[0]!);
    vi.resetModules();
    const client = await import('../src/runtime/client.ts');
    client.init({
      load: async () => ({ id: 'Test', props: {}, g: {}, load: async () => ({}) }),
      listen: () => {},
    });
    expect(client.scopeOf(2)!.i).toBe(7);
    expect(client.scopeOf(3)!.x).toEqual({ theme: 0 });
    expect(client.scopeOf(3)!.p).toBe(client.scopeOf(0));
    expect(client.get(client.scopeOf(1)!, 0)).toBeInstanceOf(Promise);
    settle(42);
    await done;
    appendChunk(records[1]!);
    await waitFor(() => expect(client.get(client.scopeOf(1)!, 0)).toBe(42));
    client.dispose();
  });

  it('updates, moves, adds and removes items of groups', async () => {
    await resume('packed', { initial: rows });
    // The key of each item is its id, which the client reads from the item of its scope.
    click(document.querySelector('.reverse')!);
    await waitFor(() => expect(labels()).toEqual(['Three', 'Two', 'One']));
    click(document.querySelectorAll('.label')[2]!);
    await waitFor(() => expect(labels()).toEqual(['Three', 'Two', 'One!']));

    // A component in an item calls a function of the item's scope, its owner.
    click(document.querySelectorAll('.row')[1]!.querySelector('button')!);
    await waitFor(() => expect(tags()).toEqual(['0:e 1:f', '0:c 1:d 2:3', '0:a 1:b']));

    click(document.querySelector('.add')!);
    await waitFor(() => expect(labels()).toEqual(['Three', 'Two', 'One!', 'Row 4']));
    click(document.querySelector('.drop')!);
    await waitFor(() => expect(labels()).toEqual(['Two', 'One!', 'Row 4']));
    expect(tags()).toEqual(['0:c 1:d 2:3', '0:a 1:b', '0:new']);

    click(document.querySelector('.pick')!);
    await waitFor(() =>
      expect([...document.querySelectorAll('.picked')].map((li) => li.textContent)).toEqual([
        'a',
        'b',
        'c',
      ]),
    );
    click(document.querySelector('.more')!);
    await waitFor(() =>
      expect([...document.querySelectorAll('b')].map((b) => b.textContent)).toEqual([
        '0',
        '1',
        '2',
      ]),
    );
  });
});
