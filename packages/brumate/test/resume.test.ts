// @vitest-environment happy-dom
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest';
import type { Mock } from 'vitest';
import { analyzeProject, compile } from '../src/index.ts';
import { resolveFromDisk } from '../src/modules.ts';
import { generateShared } from '../src/shared-module.ts';
import {
  handleRoute,
  render as renderParts,
  stateScript,
  useSerialEntry,
} from '../src/runtime/server.ts';
import type { PageState } from '../src/runtime/server.ts';
import type { SerialEntry } from '../src/runtime/values.ts';
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
  // `brumate/forms`, a module function of the package, as if it were next to the components.
  const forms = {
    path: join(input, 'forms.brm.ts'),
    source: readFileSync(resolve(import.meta.dirname, '../forms/forms.brm.ts'), 'utf8'),
  };
  writeFileSync(join(output, 'forms.brm.ts'), forms.source);
  writeFileSync(join(output, 'forms.brm.ts.shared.ts'), generateShared(forms).code);
  const resolveModule = (specifier: string, importer: string) =>
    specifier === 'brumate/forms' ? forms : resolveFromDisk(specifier, importer);
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
      resolveModule,
      // The class of the serial entry of the tests, `render/money.ts`.
      sendableClasses: ['Money'],
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
    .replace(/\.brm\?brumate-client"/g, '.brm.client.ts"')
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
  document.body.querySelectorAll('script[b-state]').forEach(run);
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
/** Milliseconds that the module of each component takes to load, by ID, or `all` for every one. */
type PartDelays = Record<string, number>;

/** The components whose modules the loader and the core loaded, by ID. */
const loadedParts: string[] = [];

async function resume(
  name: string,
  props: unknown,
  delays: PartDelays = {},
  serial?: SerialEntry,
): Promise<void> {
  const server = await import(file(`${name}.brm.ts`));
  const { html, state } = await renderParts(server.default, props);
  show(html + state);
  await startLoader(delays, serial);
}

/** Starts the loader on the page that is shown, with the compiled client modules. */
async function startLoader(delays: PartDelays = {}, serial?: SerialEntry): Promise<void> {
  loadedParts.length = 0;
  vi.resetModules();
  const { start } = await import('../src/runtime/loader.ts');
  stop = start({
    ...(serial ? { serial: async () => serial } : {}),
    load: async (id) => {
      loadedParts.push(id);
      await new Promise((done) => setTimeout(done, delays[id] ?? delays.all ?? 0));
      return import(modules.get(id)!);
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
  return record.replace('<script ', '<script b-offset="5" b-root="5" ');
}

/** Presses a key on the list of the page, and returns the event. */
function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  document.querySelector('.list')!.dispatchEvent(event);
  return event;
}

function click(element: Element): void {
  element.dispatchEvent(new Event('click', { bubbles: true }));
}

/** What `render/runs.ts` recorded, as `<name> <value>`. */
function runs(): string[] {
  return ((globalThis as { runs?: string[] }).runs ??= []);
}

/** What `render/runs.ts` recorded with a name. */
function runsOf(name: string): string[] {
  return runs().filter((entry) => entry.startsWith(`${name} `));
}

/** Forgets the runs so far, such as those of the server render. */
function clearRuns(): void {
  runs().length = 0;
}

/**
 * Shows `boom.brm` of build `b1`, with a server of `server`, and starts the
 * loader with handler parts that fail to load. Returns the calls to
 * `location.reload` and the `brumate:skew` events.
 */
async function failingHandlers(server: string): Promise<{
  reload: Mock<() => void>;
  skews: string[];
  reported: unknown[];
  restart: () => Promise<void>;
}> {
  const component = await import(file('boom.brm.ts'));
  const runtime = await import('../src/runtime/server.ts');
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) =>
    runtime.handleRequest({}, new Request(`http://localhost${url}`, init), '/_brumate', {
      build: server,
    }),
  );
  const reload = vi.fn<() => void>();
  const { href, origin } = window.location;
  vi.stubGlobal('location', { href, origin, reload, assign: vi.fn<(url: string) => void>() });
  const skews: string[] = [];
  const reported: unknown[] = [];
  const onSkew = (event: Event): void => {
    skews.push((event as CustomEvent<string>).detail);
  };
  document.addEventListener('brumate:skew', onSkew);
  const restart = async (): Promise<void> => {
    stop?.();
    const { html, state } = await runtime.render(component.default, {}, { build: 'b1' });
    show(html + state);
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({
      build: 'b1',
      onError: (error) => reported.push(String(error)),
      // The code of the page fails to load, as a module that throws or a file that is gone does.
      load: () => Promise.reject(new Error('Top level')),
    });
  };
  await restart();
  onTestFinished(() => document.removeEventListener('brumate:skew', onSkew));
  return { reload, skews, reported, restart };
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

  it('runs no callback of an element that left the page with its scope', async () => {
    document.body.innerHTML = '';
    vi.resetModules();
    const client = await import('../src/runtime/client.ts');
    const ran: unknown[] = [];
    client.init({
      load: async () => ({
        id: 'Test',
        props: {},
        g: {},
        load: async () => ({ c1: (scope: unknown) => ran.push(scope) }),
      }),
      listen: () => {},
    });
    // A `$client` callback for when the page is idle, whose page went before the browser was.
    const template = document.createElement('template');
    template.setAttribute('b-b', '9:0');
    await client.handle(template, 'Test#c1');
    expect(ran).toEqual([]);
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
    // Navigation marked the records, so the core reads them with this module.
    await (
      await import('../src/runtime/client-routes.ts')
    ).ready;
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
    expect(document.querySelector('template[b-l]')).toBeNull();

    // The streamed body resumes, and updates with the rest of the page.
    click(document.querySelector('.inner')!);
    await waitFor(() => expect(text('.inner')).toBe('1'));
    expect(text('.outer')).toBe('1');
  });

  it('resumes a #loading body that rendered in place, with the rest of the page', async () => {
    const server = await import(file('awaited.brm.ts'));
    const render = renderParts(server.default, {});
    server.release('first', 'Ada');
    server.release('second', 'Grace');
    // The third memo starts once the run of the first two has settled.
    await new Promise((done) => setTimeout(done, 0));
    server.release('third', 'Alan');
    const { html, state } = await render;
    show(html + state);
    await startLoader();
    expect(document.querySelector('.fallback')).toBeNull();
    expect(text('.third')).toBe('Alan 0 users');

    click(document.querySelector('.inner')!);
    await waitFor(() => expect(text('.inner')).toBe('1'));
    expect(text('.third')).toBe('Alan 1 users');
  });

  it('resumes a page whose #loading body rendered in order', async () => {
    const server = await import(file('loading.brm.ts'));
    server.release('Ada');
    const { html, state } = await renderParts(server.default, {}, { inOrder: true });
    show(html + state);
    await startLoader();
    expect(text('.greeting')).toBe('Hello Ada');
    click(document.querySelector('.inner')!);
    await waitFor(() => expect(text('.inner')).toBe('1'));
    expect(text('.outer')).toBe('1');
  });

  it('scopes styles and updates style variables', async () => {
    await resume('styled', {});
    expect(document.querySelectorAll('style[b-style]')).toHaveLength(1);
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
    expect(big.hasAttribute('b-c-9wx0az')).toBe(true);
  });

  it('adds the stylesheet when the client renders a component first', async () => {
    vi.resetModules();
    const render = await import(file('styled.brm.render.ts'));
    document.head.innerHTML = '';
    render.default({});
    render.default({});
    expect(document.head.querySelectorAll('style[b-style="Styled_9wx0az"]')).toHaveLength(1);
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

  // A write runs the readers of each slot that it changes, one slot after another. An
  // update that reads two of those slots runs once for each, and a child can get one
  // new prop before the other. `it.fails` marks what ordered updates in
  // docs/proposals.md would fix.
  describe('updates of a signal and a memo of it', () => {
    it.fails('computes a memo that reads both once', async () => {
      await resume('diamond', {});
      clearRuns();
      click(document.querySelector('.add')!);
      await waitFor(() => expect(text('.label')).toBe('2 + 4 of 4'));
      expect(runsOf('sum')).toEqual(['sum 2 + 4']);
    });

    it.fails('computes a memo of that memo once', async () => {
      await resume('diamond', {});
      clearRuns();
      click(document.querySelector('.add')!);
      await waitFor(() => expect(text('.label')).toBe('2 + 4 of 4'));
      expect(runsOf('label')).toEqual(['label 2 + 4 of 4']);
    });

    it.fails('runs a binding that reads both once', async () => {
      await resume('diamond', {});
      clearRuns();
      click(document.querySelector('.add')!);
      await waitFor(() => expect(text('.both')).toBe('2 4'));
      expect(runsOf('both')).toEqual(['both 2 4']);
    });

    it.fails('computes a memo of a child that gets both as props once', async () => {
      await resume('diamond', {});
      clearRuns();
      click(document.querySelector('.grow')!);
      await waitFor(() => expect(text('.shout')).toBe('C'));
      expect(runsOf('shout')).toEqual(['shout 3 2']);
    });

    it.fails('gives a child the new list with the new index', async () => {
      await resume('diamond', {});
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      onTestFinished(() => errors.mockRestore());
      click(document.querySelector('.grow')!);
      await waitFor(() => expect(text('.shout')).toBe('C'));
      // The update code has loaded, so the write runs its updates at once. The index
      // reaches the child first, and its memo reads past the end of the old list.
      click(document.querySelector('.grow')!);
      await vi.waitFor(() => expect(text('.shout')).toBe('D'), { timeout: 500 });
      expect(errors).not.toHaveBeenCalled();
    });
  });

  it('loads the code of the components on the page when it starts', async () => {
    await resume('disclosure', {});
    const id = 'Disclosure_104dejl';
    // The module loads without an event, with every part, also of the button in the closed #if.
    await waitFor(() => expect(loadedParts).toEqual([id]));
    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(text('.count')).toBe('0'));
    click(document.querySelector('.inc')!);
    await waitFor(() => expect(text('.count')).toBe('1'));
    expect(text('.seen')).toBe('0');
  });

  it('keeps a preference in a cookie, which the server reads for the first render', async () => {
    const server = await import(file('preference.brm.ts'));
    const request = new Request('http://localhost/');
    // The DOM environment drops `cookie` from the headers that a request is made with.
    request.headers.set('cookie', 'theme=dark');
    const { html, state } = await renderParts(server.default, {}, { request });
    expect(html).toContain('data-theme="dark"');
    show(html + state);
    document.cookie = 'theme=; max-age=0; path=/';
    await startLoader();
    window.dispatchEvent(new Event('load'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The effect waits for a change, so loading the page writes no cookie.
    expect(document.cookie).not.toContain('theme=');
    click(document.querySelector('.toggle')!);
    await waitFor(() =>
      expect(document.querySelector('.page')!.getAttribute('data-theme')).toBe('light'),
    );
    await waitFor(() => expect(document.cookie).toContain('theme=light'));
  });

  it('writes a debounced value after a pause, and a throttled one at most once a wait', async () => {
    await resume('timing', {});
    const field = document.querySelector<HTMLInputElement>('.query')!;
    const type = (value: string): void => {
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    };
    // The server renders the value itself.
    expect(text('.settled')).toBe('');
    type('a');
    // The throttled value takes the first change at once, and the debounced one waits.
    await waitFor(() => expect(text('.sampled')).toBe('a'));
    expect(text('.settled')).toBe('');
    expect(text('.pending')).toBe('waiting');
    type('ab');
    type('abc');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(text('.sampled')).toBe('a');
    expect(text('.settled')).toBe('');
    // After the wait, both have the last value.
    await waitFor(() => expect(text('.sampled')).toBe('abc'));
    await waitFor(() => expect(text('.settled')).toBe('abc'));
    expect(text('.pending')).toBe('idle');
  });

  it('runs a visible $client callback when the element that it reads through ref comes into view', async () => {
    const observed: Element[] = [];
    let report: (() => void) | undefined;
    class InView {
      readonly callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element): void {
        observed.push(target);
        report = () =>
          this.callback(
            [{ target, isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('IntersectionObserver', InView);
    const server = await import(file('refVisible.brm.ts'));
    const { html } = await renderParts(server.default, {});
    expect(html).toMatch(
      /<template b-b="[\d:]+" b-client="visible=[^"]+" b-near="[\d:]+"><\/template>/,
    );
    await resume('refVisible', {});
    expect(observed).toEqual([document.querySelector('.chart')]);
    expect(text('.status')).toBe('Waiting');
    report!();
    await waitFor(() => expect(text('.status')).toBe('Drawn'));
    expect(document.querySelector<HTMLElement>('.chart')!.dataset.drawn).toBe('yes');
  });

  it('watches the first element after the markers of visible $client callbacks, not another marker', async () => {
    const observed: Element[] = [];
    class InView {
      readonly callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element): void {
        observed.push(target);
        // A template has no box, so a browser never reports it in view.
        if (target.tagName !== 'TEMPLATE') {
          this.callback(
            [{ target, isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
        }
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('IntersectionObserver', InView);
    const server = await import(file('twoVisible.brm.ts'));
    await renderParts(server.default, {});
    await resume('twoVisible', {});
    expect(observed.map((element) => element.tagName)).toEqual(['P', 'P']);
    await waitFor(() => expect(text('.status')).toBe('first second'));
  });

  it('runs capture handlers first, keeps events that do not bubble on their target, and listens passively', async () => {
    const flags = new Map<string, unknown>();
    const add = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
      flags.set(type, options);
      add(type, listener, options);
    });
    await resume('delegation', {});
    vi.mocked(document.addEventListener).mockRestore();
    // Only the type with prevent needs a listener that is not passive.
    expect(flags.get('click')).toEqual({ capture: true, passive: true });
    expect(flags.get('focus')).toEqual({ capture: true, passive: true });
    expect(flags.get('wheel')).toEqual({ capture: true, passive: false });

    click(document.querySelector('.inner')!);
    await waitFor(() => expect(text('.log')).toBe('outer capture, inner'));
    // Focus does not bubble, so the focus of the button does not reach the handler around it.
    document.querySelector('.inner')!.dispatchEvent(new FocusEvent('focus'));
    document.querySelector('.outer')!.dispatchEvent(new FocusEvent('focus'));
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true });
    document.querySelector('.wheel')!.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    await waitFor(() => expect(text('.log')).toBe('outer capture, inner, outer focus, wheel'));
  });

  it('prevents only the keys that :prevent names, before the handler loads', async () => {
    const server = await import(file('preventKeys.brm.ts'));
    const { html } = await renderParts(server.default, {});
    expect(html).toContain('b-on="keydown:prevent(ArrowDown,ArrowUp,Space,Mod+ArrowUp)=');
    await resume('preventKeys', {});
    // The first press is prevented at once, while the handler's code still loads.
    expect(press('ArrowDown').defaultPrevented).toBe(true);
    expect(press(' ').defaultPrevented).toBe(true);
    expect(press('Tab').defaultPrevented).toBe(false);
    // A key of an input method that composes text keeps its default.
    expect(press('ArrowDown', { isComposing: true }).defaultPrevented).toBe(false);
    expect(press('a').defaultPrevented).toBe(false);
    // A key alone leaves the shortcuts of the browser, such as Cmd+Left or Alt+Left, to it. Shift
    // does not count.
    expect(press('ArrowDown', { metaKey: true }).defaultPrevented).toBe(false);
    expect(press('ArrowDown', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(press('ArrowDown', { altKey: true }).defaultPrevented).toBe(false);
    expect(press('ArrowDown', { shiftKey: true }).defaultPrevented).toBe(true);
    // `Mod+` names a key with Ctrl or Meta held, and only then.
    expect(press('ArrowUp', { metaKey: true }).defaultPrevented).toBe(true);
    expect(press('ArrowUp', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(press('ArrowUp', { altKey: true }).defaultPrevented).toBe(false);
    // The handler still runs for every key, the last of which is ArrowUp with Alt.
    await waitFor(() => expect(text('.last')).toBe('ArrowUp'));
  });

  it('runs a handler that a component passes on with a spread, in the scope of its owner', async () => {
    const server = await import(file('spreadHandlers.brm.ts'));
    const { html } = await renderParts(server.default, {});
    // The element's own handler, then the parent's, with the parent's scope and its wrapper.
    expect(html).toMatch(/b-on="click=Forward_\w+#h\d+ click:prevent=SpreadHandlers_\w+#h\d+@\d+"/);
    expect(html).toContain('title="Hello"');
    await resume('spreadHandlers', {});
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.querySelector('.forward')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(text('.log')).toBe('parent'));
    await waitFor(() => expect(text('.forward')).toBe('Go 1'));
  });

  it('writes the handlers of a spread again when they change, and keeps the own ones', async () => {
    await resume('spreadHandlerChange', {});
    const field = document.querySelector('.field')!;
    const enter = (): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      field.dispatchEvent(event);
      return event;
    };
    expect(enter().defaultPrevented).toBe(false);
    await waitFor(() => expect(text('.presses')).toBe('1'));
    click(field);
    await waitFor(() => expect(field.hasAttribute('data-guarded')).toBe(true));
    expect(field.getAttribute('b-on')).toMatch(/^click=\S+ keydown:prevent\(Enter\)=\S+@\d+$/);
    expect(enter().defaultPrevented).toBe(true);
    await waitFor(() => expect(text('.presses')).toBe('2'));
    // The element's own handler still runs, and the wrapper goes away again.
    click(field);
    await waitFor(() => expect(field.hasAttribute('data-guarded')).toBe(false));
    expect(enter().defaultPrevented).toBe(false);
  });

  it('runs handlers that a script makes with $handler, with their wrappers and arguments', async () => {
    const server = await import(file('scriptHandlers.brm.ts'));
    const { html } = await renderParts(server.default, {});
    expect(html).toMatch(/class="one" b-on="click:prevent=ScriptHandlers_\w+#h\d+@\d+"/);
    expect(html).toMatch(/class="add5" b-on="click=ScriptHandlers_\w+#h\d+@\d+@%5B5%5D"/);
    await resume('scriptHandlers', {});
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.querySelector('.one')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(text('.count')).toBe('1'));
    click(document.querySelector('.add5')!);
    await waitFor(() => expect(text('.count')).toBe('6'));
    click(document.querySelector('.add10')!);
    await waitFor(() => expect(text('.count')).toBe('16'));
  });

  it('passes on the handlers of spreads in markup that the browser renders', async () => {
    await resume('scriptHandlerList', {});
    click(document.querySelector('.add')!);
    click(document.querySelector('.add')!);
    await waitFor(() => expect(texts('.item')).toEqual(['a', 'item1', 'item2']));
    // A button that the browser rendered: its `$handler` with its argument and its wrapper.
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.querySelectorAll('.remove')[2]!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(texts('.item')).toEqual(['a', 'item1']));
    // A handler that the parent passed through the spread of a component the browser rendered.
    const forward = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.querySelectorAll('.forward')[1]!.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(true);
    await waitFor(() => expect(text('.log')).toBe('item1'));
    click(document.querySelectorAll('.remove')[0]!);
    await waitFor(() => expect(texts('.item')).toEqual(['item1']));
  });

  it('removes the attributes that a spread drops, and keeps the element own', async () => {
    await resume('spreadUpdate', {});
    const target = document.querySelector('.target')!;
    expect(target.getAttribute('title')).toBe('Tip');
    // The class of the spread adds to the class of the element.
    expect(target.className).toBe('target tip');
    click(document.querySelector('.drop')!);
    await waitFor(() => expect(target.getAttribute('data-kind')).toBe('b'));
    expect(target.hasAttribute('title')).toBe(false);
    expect(target.id).toBe('fixed');
    expect(target.className).toBe('target');
    click(document.querySelector('.back')!);
    await waitFor(() => expect(target.getAttribute('title')).toBe('Again'));
    expect(target.hasAttribute('data-kind')).toBe(false);
  });

  it('passes handlers through a dynamic tag, also when it names a component', async () => {
    await resume('asPage', {});
    // The class of the caller adds to the class of the tag, for an element and for a component.
    expect(document.querySelector('.plain')!.className).toBe('as-button plain');
    expect(document.querySelector('.link')!.className.split(' ').toSorted()).toEqual([
      'as-button',
      'link',
    ]);
    click(document.querySelector('.plain')!);
    await waitFor(() => expect(text('.outer')).toBe('1'));
    await waitFor(() => expect(text('.plain-box .own')).toBe('1'));
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.querySelector('.link')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(text('.outer')).toBe('2'));
    // The tag's own handler runs in the component that wrote it, not in the link.
    await waitFor(() => expect(text('.link-box .own')).toBe('1'));
  });

  // The `Select` spike of the headless UI components: a select made of generic parts that read
  // its context. `it.fails` marks what brumate cannot do yet, so a fix turns it into a failure.
  describe('Select spike', () => {
    it('gives parts that a caller passes as children the contexts of the component', async () => {
      const server = await import(file('spikePage.brm.ts'));
      const { html } = await renderParts(server.default, {});
      // Children render where the select inserts them, after it provides its context.
      expect(html).toMatch(/<span class="label" id="[^"]+"/);
      expect(html).toContain('aria-expanded="false"');
      // In the browser, the trigger opens the popover of its select, and the list chooses.
      await resume('spikePage', {});
      click(document.querySelector('.select .trigger')!);
      await waitFor(() => expect(document.querySelector('.popover')).not.toBeNull());
      expect(document.querySelector('.select .trigger')!.getAttribute('aria-expanded')).toBe(
        'true',
      );
      click(document.querySelectorAll('.option')[1]!);
      await waitFor(() => expect(text('.value')).toBe('Dog'));
      expect(document.querySelector('.popover')).toBeNull();
    });

    it('gives children that a component passes on the contexts of the component that inserts them', async () => {
      const server = await import(file('spikeWrapped.brm.ts'));
      const { html } = await renderParts(server.default, {});
      expect(html).toMatch(/<span class="label" id="[^"]+"/);
      expect(html).toContain('aria-expanded="false"');
      // In the browser, the trigger opens its select through the same context.
      await resume('spikeWrapped', {});
      click(document.querySelector('.trigger')!);
      await waitFor(() =>
        expect(document.querySelector('.trigger')!.getAttribute('aria-expanded')).toBe('true'),
      );
    });

    it('gives children that a component passes on its contexts in markup that the browser renders', async () => {
      await resume('spikeWrappedLater', {});
      click(document.querySelector('.show')!);
      await waitFor(() => expect(document.querySelector('.label')).not.toBeNull());
      expect(document.querySelector('.label')!.id).not.toBe('');
      expect(document.querySelector('.trigger')!.getAttribute('aria-expanded')).toBe('false');
      click(document.querySelector('.trigger')!);
      await waitFor(() =>
        expect(document.querySelector('.trigger')!.getAttribute('aria-expanded')).toBe('true'),
      );
    });

    it('gives children the contexts of the component in markup that the browser renders', async () => {
      await resume('spikeLater', {});
      click(document.querySelector('.show')!);
      await waitFor(() => expect(document.querySelector('.label')).not.toBeNull());
      expect(document.querySelector('.label')!.id).not.toBe('');
      expect(document.querySelector('.trigger')!.getAttribute('aria-expanded')).toBe('false');
      click(document.querySelector('.trigger')!);
      await waitFor(() => expect(document.querySelector('.popover')).not.toBeNull());
      click(document.querySelectorAll('.option')[0]!);
      await waitFor(() => expect(text('.value')).toBe('Cat'));
    });

    it('gives a part on its own the default value of the context', async () => {
      await resume('spikePage', {});
      const alone = document.querySelector('.alone')!;
      expect(alone.hasAttribute('aria-expanded')).toBe(false);
      click(alone);
      await waitFor(() => expect(text('.alone')).toBe('Alone 1'));
    });

    it('renders a #template prop with the values of the component that wrote it', async () => {
      await resume('spikeTemplateState', {});
      expect(text('.option:nth-child(1) .choice')).toBe('Pet Cat');
      click(document.querySelectorAll('.option')[0]!);
      await waitFor(() => expect(text('.option:nth-child(1) .choice')).toBe('Pet Cat *'));
      // The markup of the template updates with the values of the page too.
      click(document.querySelector('.mark')!);
      await waitFor(() => expect(text('.option:nth-child(1) .choice')).toBe('Pet Cat +'));
    });

    it('renders a #template prop again when the state it was given changes', async () => {
      const server = await import(file('spikeTemplate.brm.ts'));
      const { html } = await renderParts(server.default, {});
      expect(html).toContain('<b class="choice">');
      await resume('spikeTemplate', {});
      expect(text('.option:nth-child(2) .choice')).toBe('Dog');
      // The list calls the template of the page again, in the browser, with the new selection.
      click(document.querySelectorAll('.option')[1]!);
      await waitFor(() => expect(text('.option:nth-child(2) .choice')).toBe('Dog (picked)'));
      expect(text('.option:nth-child(1) .choice')).toBe('Cat');
    });

    it('gives the element of an as component the handlers of the part and of the caller', async () => {
      await resume('spikePage', {});
      const link = document.querySelector('.spike-link')!;
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      await waitFor(() => expect(text('.spike-link')).toBe('Linked 1'));
    });

    it('merges a class of a spread with the class of the element', async () => {
      const server = await import(file('spikePage.brm.ts'));
      const { html } = await renderParts(server.default, {});
      // SpikeLink writes class="spike-link", and the spread of SpikeButton writes class="trigger".
      // The link has live props now, so it carries an anchor before its class.
      expect(html).toMatch(/<a [^>]*class="spike-link trigger"/);
    });
  });

  it('renders a #try body again with reset', async () => {
    await resume('retry', {});
    expect(text('.error')).toBe('Error: Not ready');

    // The body still fails, so the fallback renders again, and its button still works.
    click(document.querySelector('.retry')!);
    await waitFor(() => expect(loadedParts).toContain('Retry_pyus3c'));
    await waitFor(() => expect(text('.error')).toBe('Error: Not ready'));

    const shared = await import(file('retry.brm.client.shared.ts'));
    shared.heal();
    click(document.querySelector('.retry')!);
    await waitFor(() => expect(text('.ok')).toBe('Ready'));
    expect(document.querySelector('.error')).toBeNull();
  });

  it('renders the #catch body when a handler in the #try body throws, and resets', async () => {
    await resume('boom', {});
    expect(text('.count')).toBe('0');
    click(document.querySelector('.throw')!);
    await waitFor(() => expect(text('.caught')).toBe('Error: Clicked'));
    expect(document.querySelector('.count')).toBeNull();
    // The body renders again, with the current values.
    click(document.querySelector('.reset')!);
    await waitFor(() => expect(text('.count')).toBe('0'));
    expect(document.querySelector('.caught')).toBeNull();
    // The error of the promise that an async handler returns counts too.
    click(document.querySelector('.async')!);
    await waitFor(() => expect(text('.caught')).toBe('Error: Later'));
  });

  it('catches the error of a memo that loads, and of an effect, in the #try around them', async () => {
    await resume('boom', {});
    click(document.querySelector('.count-up')!);
    await waitFor(() => expect(text('.loaded')).toBe('Loaded 0'));
    click(document.querySelector('.load')!);
    await waitFor(() => expect(text('.caught')).toBe('Error: Load 1 failed'));
    // Once the load works, the body renders again with the current values.
    const shared = await import(file('boom.brm.client.shared.ts'));
    shared.heal();
    click(document.querySelector('.reset')!);
    await waitFor(() => expect(text('.loaded')).toBe('Loaded 1'));
    expect(text('.count')).toBe('1');
    click(document.querySelector('.count-up')!);
    click(document.querySelector('.count-up')!);
    await waitFor(() => expect(text('.caught')).toBe('Error: Effect at 3'));
  });

  it('reports an error outside every #try with an event, and to onError first', async () => {
    const server = await import(file('boom.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    show(html + state);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const seen: string[] = [];
    const reported: unknown[] = [];
    window.addEventListener('brumate:error', (event) =>
      seen.push(String((event as CustomEvent<{ error: unknown }>).detail.error)),
    );
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({
      load: (id) => import(modules.get(id)!),
      onError: (error, info) => reported.push(`${String(error)} in ${info.scope}`),
    });
    try {
      click(document.querySelector('.outside')!);
      await waitFor(() => expect(seen).toEqual(['Error: Outside']));
      expect(reported).toEqual(['Error: Outside in 0']);
      expect(errors).toHaveBeenCalledWith(new Error('Outside'));
      // An error that a `#try` catches is reported too, without the event.
      click(document.querySelector('.throw')!);
      await waitFor(() => expect(text('.caught')).toBe('Error: Clicked'));
      expect(reported).toHaveLength(2);
      expect(seen).toHaveLength(1);
    } finally {
      errors.mockRestore();
    }
  });

  it('reads the route and the navigation, on the server and after the browser changes them', async () => {
    const server = await import(file('where.brm.ts'));
    const request = new Request('http://localhost:3000/issues/7?q=bug');
    const { html, state } = await renderParts(
      server.default,
      {},
      { request, params: { id: '7' }, route: 'r' },
    );
    expect(html).toContain('<p class="where"');
    expect(state).toContain('b-params="{&quot;id&quot;:&quot;7&quot;}"');
    show(html + state);
    expect(text('.where')).toBe('/issues/7 bug 7');
    expect(text('.pending')).toBe('idle');
    await startLoader();
    // The browser changes them: the core reads the new route, and the navigation that loads.
    const client = await import('../src/runtime/client.ts');
    client.loader.init({ load: (id) => import(modules.get(id)!), listen: () => {} });
    client.setGlobal('brumate.navigation', {
      pending: true,
      from: 'http://localhost:3000/issues/7?q=bug',
      to: 'http://localhost:3000/issues/8',
    });
    await waitFor(() => expect(text('.pending')).toBe('to /issues/8'));
    history.pushState({}, '', '/issues/8?q=open');
    client.updateRoute();
    await waitFor(() => expect(text('.where')).toBe('/issues/8 open 7'));
    history.replaceState({}, '', '/');
    // This copy of the core was started by hand, so it stops by hand.
    client.loader.dispose();
  });

  it('loads a page from navigate(), and marks the page while it loads', async () => {
    document.body.innerHTML = '<p class="old">Old</p>';
    let finish: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      () =>
        new Promise<Response>((answer) => {
          finish = answer;
        }),
    );
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });
    const { navigate } = await import('../src/runtime/routes.ts');
    const done = navigate('/next', { replace: true });
    await waitFor(() => expect(finish).toBeDefined());
    expect(document.documentElement.hasAttribute('data-navigating')).toBe(true);
    finish!(
      new Response(
        '<!doctype html><html><head><title>Next</title></head><body><h1>Next</h1></body></html>',
        {
          headers: { 'content-type': 'text/html' },
        },
      ),
    );
    await done;
    expect(text('h1')).toBe('Next');
    expect(location.pathname).toBe('/next');
    expect(document.documentElement.hasAttribute('data-navigating')).toBe(false);
    // A screen reader hears the title, and the focus starts at the heading.
    expect(text('[b-announcer]')).toBe('Next');
    expect(document.activeElement).toBe(document.querySelector('h1'));
    history.replaceState({}, '', '/');
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
    // Without client navigation, a redirect loads the page in full.
    const { startWithoutNavigation } = await import('../src/runtime/static-loader.ts');
    stop = startWithoutNavigation({ load: (id) => import(modules.get(id)!) });
    expect(text('.user')).toBe('Ada');

    click(document.querySelector('.ok')!);
    await waitFor(() => expect(text('.message')).toBe('Hello Ada'));

    click(document.querySelector('.empty')!);
    await waitFor(() => expect(text('.message')).toBe('A name is required'));

    click(document.querySelector('.admin')!);
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/admin'));
  });

  it('sends the build with calls, and loads the next page in full after a deploy', async () => {
    vi.resetModules();
    const server = await import(file('session.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    const builds: (string | null)[] = [];
    // The server is of a newer build, and the function of the call is gone from it.
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const request = new Request(`http://localhost${url}`, init);
      builds.push(request.headers.get('x-brumate-build'));
      return runtime.handleRequest({}, request, '/_brumate', { build: 'new' });
    });
    const assign = vi.fn<(url: string) => void>();
    const { href, origin } = window.location;
    vi.stubGlobal('location', { href, origin, assign });
    const request = new Request('http://localhost/', { headers: { 'x-user': 'Ada' } });
    const { html, state } = await runtime.render(server.default, {}, { request, build: 'old' });
    show(`${html}${state}<a class="next" href="/next">Next</a>`);
    expect(state).toContain('b-build="old"');
    const skews: string[] = [];
    document.addEventListener('brumate:skew', (event) =>
      skews.push((event as CustomEvent<string>).detail),
    );
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!), build: 'old' });

    click(document.querySelector('.ok')!);
    await waitFor(() => expect(text('.message')).toBe('The site changed. Load the page again'));
    expect(builds).toEqual(['old']);
    expect(skews).toEqual(['call']);
    // The next link is a full page load, with the code of the new build.
    click(document.querySelector('.next')!);
    await waitFor(() => expect(assign).toHaveBeenCalledWith('http://localhost:3000/next'));
  });

  it('reports the error of code that fails to load when the build is the same', async () => {
    sessionStorage.clear();
    const { reload, skews, reported } = await failingHandlers('b1');
    click(document.querySelector('.throw')!);
    await waitFor(() => expect(reported).toContain('Error: Top level'));
    expect(reload).not.toHaveBeenCalled();
    expect(skews).toEqual([]);
  });

  it('loads the page again once for each build when the code of the page is gone', async () => {
    sessionStorage.clear();
    const { reload, skews, reported, restart } = await failingHandlers('b2');
    click(document.querySelector('.throw')!);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(skews).toEqual(['code']);
    // The page loads again, from a cache that still serves the page of the old build. Its code
    // is gone too, and the page does not load again for the same build.
    await restart();
    click(document.querySelector('.throw')!);
    await waitFor(() => expect(reported).toContain('Error: Top level'));
    expect(reload).toHaveBeenCalledTimes(1);
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
    click(document.querySelector('.double')!);
    await waitFor(() => expect(text('.count')).toBe('22'));
    // Functions in a list of the value.
    click(document.querySelector('.hundred')!);
    await waitFor(() => expect(text('.count')).toBe('122'));
    click(document.querySelector('.less')!);
    await waitFor(() => expect(text('.count')).toBe('121'));
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
    // The items of the #for are in its block, 0, and their dots are `_` in the IDs.
    expect(inputIds()).toEqual(['b0-0', 'b0_0-0', 'b0_1-0']);
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

  it('sets the title from the last <title> of #head, also one that a block renders', async () => {
    vi.resetModules();
    const server = await import(file('markupTitle.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    const { html, state, head } = await runtime.render(server.default, {});
    // The one title is the title of the head, with no copy of the server. A <title> of an <svg> stays.
    expect(head).toMatch(
      /^<!--P[\d.]+--><title b-b="[\d.:]+" b-t>0 left \| Todos<\/title><!--\/P-->$/,
    );
    expect(html).toContain('<svg><title>Icon</title></svg>');
    document.head.innerHTML = head;
    show(html + state);
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });
    expect(document.title).toBe('0 left | Todos');

    click(document.querySelector('.add')!);
    await waitFor(() => expect(document.title).toBe('1 left | Todos'));
    // The last one in the page wins, so the title of the #if body does.
    click(document.querySelector('.edit')!);
    await waitFor(() => expect(document.title).toBe('Unsaved changes & more | Todos'));
    click(document.querySelector('.add')!);
    await waitFor(() => expect(text('title[b-t]')).toBe('2 left | Todos'));
    expect(document.title).toBe('Unsaved changes & more | Todos');
    click(document.querySelector('.edit')!);
    await waitFor(() => expect(document.title).toBe('2 left | Todos'));
    // The title of the markup keeps its text.
    expect(text('title[b-t]')).toBe('2 left | Todos');
    expect(text('svg title')).toBe('Icon');
    document.head.innerHTML = '';
  });

  it('puts the last title first in the head, when several render', async () => {
    const server = await import(file('twoTitles.brm.ts'));
    const { head } = await renderParts(server.default, {});
    expect(head.startsWith('<title>Page | Site</title>')).toBe(true);
    expect(head.match(/<title b-t>/g)).toHaveLength(2);
  });

  it('reports a <title> outside #head, and keeps those of <head> and <svg>', () => {
    const compileMarkup = (markup: string) => compile(markup, { filename: 'Title.brm' });
    expect(() => compileMarkup('<title>Home</title>')).toThrow('Put <title> in #head');
    expect(() => compileMarkup('#if (true) { <title>Home</title> }')).toThrow(
      'Put <title> in #head',
    );
    const document = compileMarkup(
      '<html><head><title>Site</title></head><body><svg><title>Icon</title></svg></body></html>',
    );
    expect(document.server).not.toContain('$$ctx.title');
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
    // The events come while the code of the page loads.
    await resume('todos', { initial: [] }, { all: 100 });
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
    // Each insert puts a fragment into the list: of the template that a new item cloned.
    const insert = vi.spyOn(list, 'insertBefore');

    click(document.querySelector('.fill')!);
    await waitFor(() => expect(document.querySelectorAll('li')).toHaveLength(6));
    observer.disconnect();
    const inserts = insert.mock.calls.filter(([node]) => node instanceof DocumentFragment);
    insert.mockRestore();
    expect([...list.querySelectorAll('span')].map((span) => span.textContent)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
    ]);
    expect(buttons().map((button) => button.textContent)).toEqual(['1', '2', '3', '4', '5', '6']);
    // The items that stay are not moved. Each new item goes in with its own insert, so its nodes
    // move once, and nothing else is inserted.
    expect(removed).toEqual([]);
    expect(inserts).toHaveLength(4);

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

  it('renders a client block in place of its fallback', async () => {
    await resume('clientElse', {});
    expect(text('.fallback')).toBe('Loading 0');
    expect(document.querySelector('.body')).toBeNull();
    await waitFor(() => expect(text('.body')).toBe('Client 0'));
    expect(document.querySelector('.fallback')).toBeNull();
    click(document.querySelector('.outer')!);
    await waitFor(() => expect(text('.body')).toBe('Client 1'));
    expect(text('.outer')).toBe('1');
  });

  it('stops the window listeners of markup that is gone, such as a page that navigation left', async () => {
    await resume('blocks', { items: ['one', 'two'], tab: 'b' });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await waitFor(() => expect(text('body > p')).toBe('A'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
    await waitFor(() => expect(text('body > p')).toBe('B'));
    document.querySelector('template[b-listen]')!.remove();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await new Promise((done) => setTimeout(done, 50));
    expect(text('body > p')).toBe('B');
  });
});

/** Collects what a render sends after the page. */
async function allPending(pending: AsyncIterable<string>): Promise<string> {
  let result = '';
  for await (const chunk of pending) {
    result += chunk;
  }
  return result;
}

/**
 * Answers the requests of the browser with the route of a fixture, and runs the scripts
 * that are added to the page, in order, as a browser does. jsdom does not run them.
 */
async function withRoute(
  name: string,
  test: (fetch: Mock<(url: string, init: RequestInit) => Promise<Response>>) => Promise<void>,
): Promise<void> {
  const server = await import(file(`${name}.brm.ts`));
  const tree = { page: async () => server };
  const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
    async (url, init) =>
      (await handleRoute(tree, new Request(new URL(url, 'http://localhost/'), init)))!,
  );
  vi.stubGlobal('fetch', fetch);
  const scripts = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeName === 'SCRIPT') {
          run(node as Element);
        }
      }
    }
  });
  scripts.observe(document.body, { childList: true });
  try {
    await test(fetch);
  } finally {
    scripts.disconnect();
  }
}

describe('gather', () => {
  it('renders the list empty on the server, and fills it as the stream sends values', async () => {
    const server = await import(file('gatherList.brm.ts'));
    const page = await renderParts(server.default, {});
    expect(page.html).toContain('<li class="empty">Nothing yet</li>');
    await resume('gatherList', {});
    click(document.querySelector('.ask')!);
    // The items arrive one by one, and the list shows the first before the stream ends.
    const seen = new Set<number>();
    const counter = new MutationObserver(() =>
      seen.add(document.querySelectorAll('li:not(.empty)').length),
    );
    counter.observe(document.querySelector('ol')!, { childList: true, subtree: true });
    await waitFor(() =>
      expect([...document.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
        'word 1',
        'word 2',
        'word 3',
      ]),
    );
    counter.disconnect();
    expect([...seen]).toEqual([1, 2, 3]);
  });
});

describe('fallbacks kept in development', () => {
  it('keeps the fallback and the body of each swap, by boundary', async () => {
    const server = await import(file('revealOrder.brm.ts'));
    const done: Record<string, () => void> = {};
    const wait = Object.fromEntries(
      ['first', 'second', 'third'].map((name) => [
        name,
        new Promise<void>((resolve) => (done[name] = resolve)),
      ]),
    );
    const page = await renderParts(server.default, { wait }, { dev: true });
    show(page.html + page.state);
    const chunks = page.pending[Symbol.asyncIterator]();
    done.first!();
    appendChunk((await chunks.next()).value as string);
    const kept = (globalThis as { $bD?: Record<string, { f: Node[]; b: Node[] }> }).$bD!['0']!;
    expect(kept.f.map((node) => (node as Element).outerHTML)).toEqual([
      '<p class="wait-first">Loading first</p>',
    ]);
    expect((kept.b[0] as Element).textContent).toBe('first');
    delete (globalThis as { $bD?: unknown }).$bD;
  });
});

describe('the trace of a render', () => {
  it('ends the page with what the server did, in development', async () => {
    const server = await import(file('awaitedStream.brm.ts'));
    const tree = { page: async () => server };
    const answer = (await handleRoute(tree, new Request('http://localhost/'), { dev: true }))!;
    const reading = answer.text();
    server.release(['a', 'b']);
    const html = await reading;
    const script = /<script type="application\/json" b-trace>(.*?)<\/script>$/.exec(html);
    expect(script).not.toBeNull();
    const trace = JSON.parse(script![1]!) as {
      entries: { kind: string; label: string; end?: number }[];
    };
    expect(trace.entries.map((entry) => [entry.kind, entry.label])).toEqual(
      expect.arrayContaining([
        ['render', '/'],
        ['memo', 'tags'],
        ['body', '#loading 0'],
        ['stream', 'the rest of the page'],
      ]),
    );
    expect(trace.entries.every((entry) => entry.end !== undefined)).toBe(true);
    // Without dev, the page has no trace.
    server.release(['a']);
    const plain = await (await handleRoute(tree, new Request('http://localhost/')))!.text();
    expect(plain).not.toContain('b-trace');
  });
});

describe('#reveal', () => {
  /** Promises that the test settles, by name. */
  function waits(): { wait: Record<string, Promise<void>>; go: (name: string) => void } {
    const done: Record<string, () => void> = {};
    const wait: Record<string, Promise<void>> = {};
    for (const name of ['first', 'second', 'third']) {
      wait[name] = new Promise<void>((resolve) => (done[name] = resolve));
    }
    return { wait, go: (name) => done[name]!() };
  }

  it('sends the bodies in the order of the markup, and shows one fallback at a time', async () => {
    const server = await import(file('revealOrder.brm.ts'));
    const { wait, go } = waits();
    const page = await renderParts(server.default, { wait });
    // Only the fallback of the first body shows. The others wait in templates.
    expect(page.html).toContain('<p class="wait-first">Loading first</p>');
    expect(page.html).toMatch(/<template b-f="1"><p class="wait-second">/);
    expect(page.html).toMatch(/<template b-f="2"><p class="wait-third">/);
    const chunks: string[] = [];
    const reading = (async () => {
      for await (const chunk of page.pending) {
        chunks.push(chunk);
      }
    })();
    // The data arrives backwards, and the bodies still show from the first.
    go('third');
    go('second');
    await new Promise((done) => setTimeout(done, 20));
    expect(chunks.join('')).not.toContain('b-l=');
    go('first');
    await reading;
    const order = [...chunks.join('').matchAll(/<template b-l="(\d+)">/g)].map((match) => match[1]);
    expect(order).toEqual(['0', '1', '2']);
    // The body that shows brings the fallback of the next one in.
    const first = chunks.join('').split('<template b-l="1">')[0]!;
    expect(first).toContain('$bS(0);function $bF(i)');
    expect(first).toContain('$bF(1)');
  });

  /** The bodies of a page in the order that its stream sends them, as the data arrives in `arrive`. */
  async function streamOrder(name: string, arrive: string[]): Promise<string[]> {
    const server = await import(file(`${name}.brm.ts`));
    const { wait, go } = waits();
    const page = await renderParts(server.default, { wait });
    const sent: string[] = [];
    const reading = (async () => {
      for await (const chunk of page.pending) {
        sent.push(...[...chunk.matchAll(/<template b-l="(\d+)">/g)].map((match) => match[1]!));
      }
    })();
    for (const name of arrive) {
      go(name);
      // oxlint-disable-next-line no-await-in-loop -- Each arrives on its own.
      await new Promise((done) => setTimeout(done, 5));
    }
    await reading;
    return sent;
  }

  it('sends the bodies from the last with backwards, and at once with together', async () => {
    expect(await streamOrder('revealBackwards', ['first', 'second', 'third'])).toEqual([
      '2',
      '1',
      '0',
    ]);
    expect(await streamOrder('revealTogether', ['second', 'first', 'third'])).toEqual([
      '0',
      '1',
      '2',
    ]);
    expect(await streamOrder('revealOrder', ['second', 'third', 'first'])).toEqual(['0', '1', '2']);
  });

  it('orders the #loading blocks of the components that it renders', async () => {
    expect(await streamOrder('revealParts', ['third', 'second', 'first'])).toEqual(['0', '1', '2']);
    const server = await import(file('revealParts.brm.ts'));
    const page = await renderParts(server.default, waits());
    // Only the fallback of the first component shows.
    expect(page.html).toContain('<p class="wait-first">Loading first</p>');
    expect(page.html).toMatch(/<template b-f="1"><p class="wait-second">/);
  });

  it('lets a body that fails take its turn, so the bodies after it still show', async () => {
    const server = await import(file('revealOrder.brm.ts'));
    const { wait, go } = waits();
    const failing = Promise.reject(new Error('the profile service is down'));
    failing.catch(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const page = await renderParts(server.default, { wait: { ...wait, first: failing } });
    go('second');
    go('third');
    const sent = await allPending(page.pending);
    expect([...sent.matchAll(/<template b-l="(\d+)">/g)].map((match) => match[1])).toEqual([
      '1',
      '2',
    ]);
    // The fallback of the second body still comes out of its template.
    expect(sent.indexOf('$bF(1)')).toBeLessThan(sent.indexOf('<template b-l="1">'));
    error.mockRestore();
  });

  it('swaps the bodies and the fallbacks in the browser', async () => {
    const server = await import(file('revealOrder.brm.ts'));
    const { wait, go } = waits();
    const page = await renderParts(server.default, { wait });
    show(page.html + page.state);
    const chunks = page.pending[Symbol.asyncIterator]();
    go('first');
    appendChunk((await chunks.next()).value as string);
    expect(text('.first')).toBe('first');
    // The second fallback came out of its template, and the third still waits.
    expect(text('.wait-second')).toBe('Loading second');
    expect(document.querySelector('.wait-third')).toBeNull();
  });
});

describe('#defer', () => {
  it('renders the fallback in the page, and the body in a request of its own', async () => {
    const server = await import(file('deferred.brm.ts'));
    const page = await renderParts(server.default, {});
    // The #for before the block takes ID 0, so the block's boundary is 1.
    expect(page.html).toContain('<template b-b="0:1" b-defer="idle:1:0"></template><!--l1-->');
    expect(page.html).toContain('<p class="fallback">Loading</p><!--/l-->');
    expect(page.html).not.toContain('greeting');

    const request = new Request('http://localhost/', { headers: { 'x-user': 'Ada' } });
    const parts = await renderParts(
      server.default,
      {},
      { request, defer: { boundary: 1, at: '0:1' } },
    );
    expect(parts.defer).toBe('found');
    expect(parts.html).toBe('');
    const body = await allPending(parts.pending);
    expect(body).toContain('<template b-l="1"><p class="greeting">Hello Ada</p>');
    expect(body).toContain('$bS(1)');
    // The body's scopes are inside the boundary, and its records have references of their own.
    expect(body).toMatch(/<script b-state b-scopes b-next="\d+" b-root="d1">/);
    expect(body).toContain('1.0');

    const elsewhere = await renderParts(
      server.default,
      {},
      {
        defer: { boundary: 1, at: '0:2' },
      },
    );
    expect(elsewhere.defer).toBe('moved');
    const missing = await renderParts(server.default, {}, { defer: { boundary: 4, at: '0:1' } });
    expect(missing.defer).toBe('missing');
  });

  it('renders no component after the block in the request for its body', async () => {
    const server = await import(file('deferredLater.brm.ts'));
    const { seen } = await import(file('seen.ts'));
    seen.length = 0;
    await renderParts(server.default, {});
    expect(seen).toEqual(['before', 'after']);
    seen.length = 0;
    const parts = await renderParts(server.default, {}, { defer: { boundary: 0, at: '0:0' } });
    expect(parts.defer).toBe('found');
    expect(await allPending(parts.pending)).toContain('<i>body</i>');
    expect(seen).toEqual(['before', 'body']);
  });

  it('answers the request for a body from the route, and 409 when the block moved', async () => {
    const server = await import(file('deferred.brm.ts'));
    const tree = { page: async () => server };
    const ask = (at: string): Promise<Response | undefined> =>
      handleRoute(
        tree,
        new Request('http://localhost/', { headers: { 'x-brumate-defer': `1 ${at}` } }),
      );
    const found = (await ask('0:1'))!;
    expect(found.status).toBe(200);
    expect(found.headers.get('x-brumate-defer')).toBe('1');
    expect(found.headers.get('vary')).toContain('x-brumate-defer');
    expect(await found.text()).toContain('Hello guest');
    expect((await ask('0:7'))!.status).toBe(409);
    const page = (await handleRoute(tree, new Request('http://localhost/')))!;
    expect(page.headers.get('vary')).toContain('x-brumate-defer');
  });

  it('renders a block of a component inside a #loading body of its parent', async () => {
    const server = await import(file('deferredParent.brm.ts'));
    const request = new Request('http://localhost/');
    const page = await renderParts(server.default, {}, { request });
    const chunks = await allPending(page.pending);
    // The block is inside boundary 0, after the #for of its component, so its boundary is 0.1.
    expect(chunks).toContain('<template b-b="0.0:1" b-defer="idle:0.1:0">');
    const parts = await renderParts(
      server.default,
      {},
      { request, defer: { boundary: '0.1', at: '0.0:1' } },
    );
    expect(parts.defer).toBe('found');
    const body = await allPending(parts.pending);
    expect(body).toContain('<template b-l="0.1"><p class="greeting">Hello guest</p>');
    // Only the target body is sent, not the #loading body around it.
    expect(body).not.toContain('b-l="0"');
  });

  it('sends a prerendered page, then the bodies of its blocks in the same response', async () => {
    const server = await import(file('deferred.brm.ts'));
    const tree = { page: async () => server };
    const page = await renderParts(server.default, {});
    const shell = page.html + page.state;
    const request = new Request('http://localhost/', { headers: { 'x-user': 'Ada' } });
    const answer = (await handleRoute(tree, request, { shell }))!;
    expect(answer.headers.get('cache-control')).toBe('private, no-cache');
    const html = await answer.text();
    // The shell comes first, with the block marked, then the body of the block for this user.
    expect(html.startsWith(shell.replace('b-defer="idle:1:0"', 'b-defer="idle:1:0" b-hole'))).toBe(
      true,
    );
    expect(html).toContain('<template b-l="1"><p class="greeting">Hello Ada</p>');
    // A request for a body, and client navigation, render the route as usual.
    const body = (await handleRoute(
      tree,
      new Request('http://localhost/', { headers: { 'x-brumate-defer': '1 0:1' } }),
      { shell },
    ))!;
    expect(body.headers.get('x-brumate-defer')).toBe('1');
  });

  it('swaps in the bodies that the response brings, without asking for them', async () => {
    const server = await import(file('deferred.brm.ts'));
    const tree = { page: async () => server };
    const page = await renderParts(server.default, {});
    const answer = (await handleRoute(tree, new Request('http://localhost/'), {
      shell: page.html + page.state,
    }))!;
    const fetch = vi.fn<typeof globalThis.fetch>();
    vi.stubGlobal('fetch', fetch);
    const [shell, ...bodies] = (await answer.text()).split(/(?=<template b-l=)/);
    // The loader starts before the body arrives, as on a slow response, and leaves the block alone.
    show(shell!);
    await startLoader();
    await new Promise((done) => setTimeout(done, 20));
    for (const body of bodies) {
      appendChunk(body);
    }
    await waitFor(() => expect(text('.greeting')).toBe('Hello guest'));
    expect(document.querySelector('.fallback')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('puts the body in place of the fallback when its trigger fires', async () => {
    await withRoute('deferred', async (fetch) => {
      await resume('deferred', {});
      expect(text('.fallback')).toBe('Loading');
      await waitFor(() => expect(text('.greeting')).toBe('Hello guest'));
      expect(document.querySelector('.fallback')).toBeNull();
      const headers = new Headers(fetch.mock.calls[0]![1].headers);
      expect(headers.get('x-brumate-defer')).toBe('1 0:1');
      expect(headers.get('x-brumate-base')).toBe('0');
      // The body reads the signal of its component, which the page has.
      click(document.querySelector('.inner')!);
      await waitFor(() => expect(text('.inner')).toBe('2'));
      expect(text('.count')).toBe('2');
    });
  });

  it('loads a block of a component that a #loading body of its parent renders', async () => {
    await withRoute('deferredParent', async (fetch) => {
      const server = await import(file('deferredParent.brm.ts'));
      const { html, state, pending } = await renderParts(
        server.default,
        {},
        {
          request: new Request('http://localhost/'),
        },
      );
      document.body.innerHTML = html;
      document.body.insertAdjacentHTML('beforeend', state);
      for await (const chunk of pending) {
        document.body.insertAdjacentHTML('beforeend', chunk);
      }
      await startLoader();
      await waitFor(() => expect(text('.greeting')).toBe('Hello guest'));
      expect(document.querySelector('.fallback')).toBeNull();
      expect(new Headers(fetch.mock.calls[0]![1].headers).get('x-brumate-defer')).toBe('0.1 0.0:1');
      click(document.querySelector('.inner')!);
      await waitFor(() => expect(text('.inner')).toBe('2'));
      expect(text('.count')).toBe('2');
    });
  });

  it('keeps the fallback of a block that the browser renders, and asks for nothing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await withRoute('deferredClient', async (fetch) => {
      await resume('deferredClient', {});
      await waitFor(() =>
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining('renders a #defer block in the browser'),
        ),
      );
      await waitFor(() => expect(text('.fallback')).toBe('Loading'));
      await new Promise((done) => setTimeout(done, 50));
      expect(document.querySelector('.greeting')).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });
    warn.mockRestore();
  });

  it('loads a block inside the body of another block, after it', async () => {
    await withRoute('deferredNested', async (fetch) => {
      await resume('deferredNested', {});
      await waitFor(() => expect(text('.inner')).toBe('Inner'));
      expect(text('.outer')).toBe('Outer');
      expect(document.querySelector('.outer-wait')).toBeNull();
      expect(document.querySelector('.inner-wait')).toBeNull();
      expect(
        fetch.mock.calls.map(([, init]) => new Headers(init.headers).get('x-brumate-defer')),
      ).toEqual(['0 0:0', '0.0 0.0:0']);
    });
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

  it('inserts markup through the Trusted Types policy of the page, when the browser has one', async () => {
    const html: string[] = [];
    const policies: string[] = [];
    vi.stubGlobal('trustedTypes', {
      createPolicy(name: string, rules: { createHTML(value: string): string }) {
        policies.push(name);
        return { createHTML: (value: string) => (html.push(value), rules.createHTML(value)) };
      },
    });
    await resume('cards', {});
    click(document.querySelectorAll('.open')[0]!);
    await waitFor(() => expect(text('.inner')).toBe('Hello'));
    expect(policies).toEqual(['brumate']);
    expect(html.some((value) => value.includes('Hello'))).toBe(true);
  });

  it('keeps the handlers and updates of children that the client renders', async () => {
    await resume('cards', {});
    click(document.querySelectorAll('.open')[1]!);
    await waitFor(() => expect(text('.inc')).toBe('0'));
    click(document.querySelector('.inc')!);
    await waitFor(() => expect(text('.inc')).toBe('1'));
  });

  it('a dynamic tag keeps the handlers of a spread when the browser renders it', async () => {
    await resume('dynamicKeys', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelector('.list')).not.toBeNull());
    press('a');
    await waitFor(() => expect(text('.presses')).toBe('1'));
  });

  it('keeps the handlers of a spread on dynamic tags of a list that the browser renders', async () => {
    await resume('dynamicKeysEach', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelectorAll('.row').length).toBe(2));
    for (const row of document.querySelectorAll('.row')) {
      row.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    }
    await waitFor(() => expect(text('.presses')).toBe('2'));
  });

  it('writes the b-on of a dynamic tag escaped, with its own handlers first', async () => {
    await resume('dynamicKeysArgs', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelector('.list')).not.toBeNull());
    const on = document.querySelector('.list')!.getAttribute('b-on')!;
    expect(on).toBe(
      'click=DynamicKeysArgs_nhpusu#h9@-1 keydown:prevent(Enter,")=DynamicKeysArgs_nhpusu#h12@0@%5B%22say%20%5C%22hi%5C%22%20%26%20%3Cb%3E%22%5D',
    );
    click(document.querySelector('.list')!);
    await waitFor(() => expect(text('.seen')).toBe('own'));
    expect(press('Enter').defaultPrevented).toBe(true);
    await waitFor(() => expect(text('.seen')).toBe('say "hi" & <b>'));
    expect(press('x').defaultPrevented).toBe(false);
    expect(press('"').defaultPrevented).toBe(true);
  });

  it('a dynamic tag that changes its element keeps the handlers of a spread', async () => {
    await resume('dynamicKeysSwap', {});
    expect(press('Enter').defaultPrevented).toBe(true);
    await waitFor(() => expect(text('.presses')).toBe('1'));
    click(document.querySelector('.swap')!);
    await waitFor(() => expect(document.querySelector('section.list')).not.toBeNull());
    expect(document.querySelector('div.list')).toBeNull();
    // The new element writes its own entries and those of the spread, escaped.
    const on = document.querySelector('section.list')!.getAttribute('b-on')!;
    expect(on).toBe(
      'click=DynamicKeysSwap_5gjjdw#h8@-1 keydown:prevent(Enter,")=DynamicKeysSwap_5gjjdw#h12@0@%5B%22say%20%5C%22hi%5C%22%20%26%20%3Cb%3E%22%5D',
    );
    click(document.querySelector('.list')!);
    await waitFor(() => expect(text('.seen')).toBe('own'));
    expect(press('"').defaultPrevented).toBe(true);
    await waitFor(() => expect(text('.seen')).toBe('say "hi" & <b>'));
    expect(text('.presses')).toBe('2');
    expect(press('x').defaultPrevented).toBe(false);
  });

  it('a component in a dynamic tag keeps the handlers of its caller', async () => {
    await resume('componentTagHandlers', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelector('.wrap')).not.toBeNull());
    const on = document.querySelector('.wrap')!.getAttribute('b-on')!;
    expect(on).toMatch(/click=ScopeWrap\S*#h\d+ click=AsButton\S*#h\d+@\S+/);
    click(document.querySelector('.wrap')!);
    await waitFor(() => expect(text('.inner')).toBe('1'));
    await waitFor(() => expect(text('.own')).toBe('1'));
  });

  it('a dynamic tag keeps its own handlers when its spread updates', async () => {
    await resume('dynamicKeysLive', {});
    click(document.querySelector('.next')!);
    await waitFor(() =>
      expect(document.querySelector('.list')!.getAttribute('data-extra')).toBe('two'),
    );
    click(document.querySelector('.list')!);
    await waitFor(() => expect(text('.seen')).toBe('own'));
    press('a');
    await waitFor(() => expect(text('.presses')).toBe('1'));
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

describe('contexts of templates that a component renders', () => {
  it('reads the contexts of the component that renders the template', async () => {
    await resume('tplContextListPage', {});
    // The server renders the first item in place too.
    expect(text('.reader.zero')).toBe('7');
    click(document.querySelector('.ctx-add')!);
    await waitFor(() => expect(text('.reader.one')).toBe('7'));
  });
});

describe('spreads that update together', () => {
  it('keeps the attributes of a rest prop when another spread of the element changes', async () => {
    await resume('spreadRestPage', {});
    click(document.querySelector('.spread-bump')!);
    await waitFor(() =>
      expect(document.querySelector('[data-count]')!.getAttribute('data-count')).toBe('1'),
    );
    const element = document.querySelector('[data-count]')!;
    expect(element.className).toBe('spread-rest');
    expect(element.getAttribute('title')).toBe('Kept');
  });
});

describe('templates with components', () => {
  it('renders a component of a template that another component calls in the browser', async () => {
    await resume('tplComponentPage', {});
    click(document.querySelector('.tpl-add')!);
    await waitFor(() => expect(text('.tpl-item')).toBe('item 1'));
    expect(document.querySelector('[data-label]')!.className).toBe('tpl-dynamic');
  });
});

describe('a component in a prop', () => {
  it('renders in a block that the browser renders later', async () => {
    await resume('lateAsPage', {});
    expect(document.querySelector('.late')).toBeNull();
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelector('a.late')).not.toBeNull());
    click(document.querySelector('a.late')!);
    await waitFor(() => expect(text('.clicks')).toBe('1'));
  });

  it('renders in a new item of a list', async () => {
    await resume('lateEachPage', {});
    expect(document.querySelector('.item')).toBeNull();
    click(document.querySelector('.add')!);
    await waitFor(() => expect(document.querySelector('a.item')).not.toBeNull());
    expect(text('a.item')).toBe('Item 1');
    click(document.querySelector('a.item')!);
    await waitFor(() => expect(text('.clicks')).toBe('1'));
  });

  it('renders when it goes through two components', async () => {
    await resume('twoLevelAsPage', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelector('a.late')).not.toBeNull());
    click(document.querySelector('a.late')!);
    await waitFor(() => expect(text('.clicks')).toBe('1'));
  });

  it('renders when a context holds it', async () => {
    await resume('contextAsPage', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelector('a.late')).not.toBeNull());
    click(document.querySelector('a.late')!);
    await waitFor(() => expect(text('.clicks')).toBe('1'));
  });

  it('keeps the items of the server and of the browser through a reverse', async () => {
    await resume('hydratedEachPage', {});
    expect(document.querySelectorAll('a.item')).toHaveLength(1);
    click(document.querySelector('a.item')!);
    await waitFor(() => expect(text('.clicks')).toBe('1'));
    click(document.querySelector('.add')!);
    await waitFor(() => expect(document.querySelectorAll('a.item')).toHaveLength(2));
    click(document.querySelector('.rev')!);
    await waitFor(() => expect(text('a.item')).toBe('Item 2'));
    expect(document.querySelectorAll('a.item')).toHaveLength(2);
    expect(document.querySelectorAll('div.item')).toHaveLength(0);
    click(document.querySelectorAll('a.item')[1]!);
    await waitFor(() => expect(text('.clicks')).toBe('2'));
  });

  it('renders the component that a handler sets', async () => {
    await resume('swapAsPage', {});
    expect(document.querySelector('a.t')).not.toBeNull();
    click(document.querySelector('.swap')!);
    await waitFor(() => expect(document.querySelector('i.t')).not.toBeNull());
    expect(text('i.t')).toBe('T0');
    click(document.querySelector('.inc')!);
    await waitFor(() => expect(text('i.t')).toBe('T1'));
  });
});

describe('templates inside blocks', () => {
  /** The names of the functions that each render function of the update part declares inside it. */
  function declared(name: string): string[][] {
    const code = readFileSync(join(output, `${name}.brm.client.update.ts`), 'utf8');
    const renders = code.split(/^export function /m).slice(1);
    return renders.map((render) =>
      [...render.matchAll(/^ {2}function (\w+)\(/gm)].map((m) => m[1]!),
    );
  }

  it('a component used in a template that sits inside a block is imported', async () => {
    await resume('templateNested', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelector('a.tpl')).not.toBeNull());
    expect(declared('templateNested').flat()).toEqual(['item']);
  });

  it('a component used in a template that sits inside a block two blocks deep is imported', async () => {
    await resume('templateNestedDeep', {});
    click(document.querySelector('.outer')!);
    click(document.querySelector('.inner')!);
    await waitFor(() => expect(document.querySelector('a.deep')).not.toBeNull());
    expect(declared('templateNestedDeep').flat()).toEqual(['item']);
  });

  it('a component used in a template that sits inside a block and in another template is imported', async () => {
    await resume('templateNestedTwice', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelectorAll('b.outer a.inner').length).toBe(2));
    expect(text('b.outer a.inner')).toBe('one');
    expect(declared('templateNestedTwice').flat().toSorted()).toEqual(['inner', 'outer']);
  });

  it('a template that sits inside a block in a loop reads the value of the loop', async () => {
    await resume('templateNestedLoop', {});
    click(document.querySelector('.on')!);
    await waitFor(() => expect(document.querySelectorAll('a.row').length).toBe(2));
    expect([...document.querySelectorAll('a.row')].map((node) => node.textContent)).toEqual([
      'a',
      'b',
    ]);
    expect(declared('templateNestedLoop').flat()).toEqual(['item']);
  });
});

describe('conditions that never change', () => {
  it('reads a condition of #else if that never changes, after one that does', async () => {
    await resume('elseIfPage', {});
    expect(text('.else-if')).toBe('first');
    click(document.querySelector('.else-if-toggle')!);
    await waitFor(() => expect(text('.else-if')).toBe('passed'));
  });
});

describe('writes from effects', () => {
  it('writes a bound prop from a listener that an effect adds', async () => {
    await resume('effectWriterPage', {});
    click(document.querySelector('.effect-on')!);
    await waitFor(() => expect(text('.effect-state')).toBe('true'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    document.dispatchEvent(new Event('effect-off'));
    await waitFor(() => expect(text('.effect-state')).toBe('false'));
  });
});

describe('removed portals', () => {
  it('removes the portal of a component, and runs its cleanups, when a block removes the component', async () => {
    await resume('removedPortal', {});
    click(document.querySelector('.portal-open')!);
    await waitFor(() => expect(document.querySelector('.owned-portal')).not.toBeNull());
    click(document.querySelector('.portal-remove')!);
    await waitFor(() => expect(document.querySelector('.portal-open')).toBeNull());
    expect(document.querySelector('.owned-portal')).toBeNull();
    expect(document.body.dataset.cleanups).toBe('1');
    delete document.body.dataset.cleanups;
  });
});

describe('children that a block inserts again', () => {
  const probe = (name: string) => document.querySelector<HTMLElement>(`.${name}`);
  const cleanups = () => Number(document.body.dataset.cleanups ?? 0);

  it('renders children of the server with new scopes each time a block shows them', async () => {
    delete document.body.dataset.cleanups;
    await resume('reinsertedChildren', {});
    click(probe('inline-probe')!);
    await waitFor(() => expect(probe('inline-probe')!.textContent).toBe('1:true'));
    // Closing destroys them, and runs their cleanups.
    click(document.querySelector('.toggle-inline')!);
    await waitFor(() => expect(probe('inline-probe')).toBeNull());
    expect(cleanups()).toBe(1);
    // Opening renders them again, with state of their own and a ref to the new element.
    click(document.querySelector('.toggle-inline')!);
    await waitFor(() => expect(probe('inline-probe')).not.toBeNull());
    expect(probe('inline-probe')!.textContent).toBe('');
    // A template that the children pass on renders with them.
    expect(text('.reinsert-label')).toBe('Named');
    click(probe('inline-probe')!);
    await waitFor(() => expect(probe('inline-probe')!.textContent).toBe('1:true'));
    delete document.body.dataset.cleanups;
  });

  it('renders children in a portal again each time it opens', async () => {
    delete document.body.dataset.cleanups;
    await resume('reinsertedChildren', {});
    for (let round = 1; round <= 2; round++) {
      click(document.querySelector('.toggle-portal')!);
      // oxlint-disable-next-line no-await-in-loop -- Each round opens the portal again.
      await waitFor(() => expect(probe('portal-probe')).not.toBeNull());
      expect(probe('portal-probe')!.textContent).toBe('');
      click(probe('portal-probe')!);
      // oxlint-disable-next-line no-await-in-loop -- The click reads the ref of this round.
      await waitFor(() => expect(probe('portal-probe')!.textContent).toBe('1:true'));
      click(document.querySelector('.toggle-portal')!);
      // oxlint-disable-next-line no-await-in-loop -- The portal closes before the next round.
      await waitFor(() => expect(probe('portal-probe')).toBeNull());
      expect(cleanups()).toBe(round);
    }
    delete document.body.dataset.cleanups;
  });
});

describe('a stopped loader', () => {
  it('starts nothing from markup that the core inserts after the stop', async () => {
    await resume('removedPortal', {});
    click(document.querySelector('.portal-open')!);
    await waitFor(() => expect(document.querySelector('.owned-portal')).not.toBeNull());
    const anchor = document.querySelector('template[b-client$="#k3"]')!.getAttribute('b-b')!;
    stop?.();
    stop = undefined;
    const client = await import('../src/runtime/client.ts');
    // The core inserts markup with the hooks of the loader that started it. Started again, the
    // template would add the portal a second time.
    client.portalTo(
      client.scopeOf(0)!,
      'body',
      () => `<template b-b="${anchor}" b-client="load=PortalOwner_1w2qt1f#k3"></template>`,
    );
    await new Promise((done) => setTimeout(done, 50));
    expect(document.querySelectorAll('.owned-portal')).toHaveLength(1);
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

describe('classes with a spread', () => {
  it('keeps the class of a spread when the class of the element changes', async () => {
    await resume('classSpread', {});
    const box = document.querySelector<HTMLElement>('.box')!;
    expect(box.className).toBe('box caller');
    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(box.className).toBe('box flag caller'));
  });
});

describe('style variables with a spread', () => {
  it('keeps the style that a spread passes on, next to the style variables', async () => {
    await resume('spreadStyled', {});
    const box = document.querySelector<HTMLElement>('div.box')!;
    const tag = document.querySelector<HTMLElement>('section.tag')!;
    // The style of the spread replaces the element's own, as a later attribute does.
    expect(box.getAttribute('style')).toMatch(/^--s-\w+-0:12px;margin: 2px$/);
    expect(tag.getAttribute('style')).toMatch(/^--s-\w+-0:12px;margin: 2px$/);
    click(document.querySelector('.grow')!);
    const name = box.getAttribute('style')!.split(':')[0]!;
    await waitFor(() => expect(box.style.getPropertyValue(name)).toBe('13px'));
    expect(tag.style.getPropertyValue(name)).toBe('13px');
    expect(box.style.margin).toBe('2px');
    // A new style from the spread keeps the style variables.
    click(document.querySelector('.wider')!);
    await waitFor(() => expect(box.style.margin).toBe('3px'));
    await waitFor(() => expect(tag.style.margin).toBe('3px'));
    expect(box.style.getPropertyValue(name)).toBe('13px');
    expect(tag.style.getPropertyValue(name)).toBe('13px');
  });

  it('removes the style that a spread drops, on its first update, and keeps the variables', async () => {
    await resume('spreadStyled', {});
    const box = document.querySelector<HTMLElement>('div.box')!;
    const tag = document.querySelector<HTMLElement>('section.tag')!;
    const name = tag.getAttribute('style')!.split(':')[0]!;
    click(document.querySelector('.flat')!);
    await waitFor(() => expect(box.style.margin).toBe(''));
    // The element with no style of its own drops the spread's too.
    await waitFor(() => expect(tag.style.margin).toBe(''));
    expect(tag.style.getPropertyValue(name)).toBe('12px');
    expect(box.style.color).toBe('red');
  });
});

describe('function props that return values', () => {
  it('returns the result of a function prop in a memo, in markup and in a handler', async () => {
    await resume('valueFilter', {});
    const shown = document.querySelector('.shown')!;
    const marks = () => [...document.querySelectorAll('li')].map((item) => item.textContent);
    expect(shown.textContent).toBe('2,4');
    click(document.querySelector('.more')!);
    await waitFor(() => expect(marks()).toEqual(['dropped', 'kept', 'dropped', 'kept', 'dropped']));
    expect(shown.textContent).toBe('2,4');
    click(document.querySelector('.more')!);
    await waitFor(() => expect(shown.textContent).toBe('2,4,6'));
    expect(marks().at(-1)).toBe('kept');
    click(document.querySelector('.pick')!);
    await waitFor(() => expect(document.querySelector('.picked')!.textContent).toBe('true'));
  });
});

describe('spreads and attributes of other code', () => {
  it('keeps an attribute that a $client callback set when the spread updates', async () => {
    await resume('spreadKeeps', {});
    const box = document.querySelector('.box')!;
    expect(box.getAttribute('b-s')).toBe('class title');
    await waitFor(() => expect(box.getAttribute('aria-controls')).toBe('menu'));
    click(document.querySelector('.inc')!);
    await waitFor(() => expect(box.getAttribute('title')).toBe('count 1'));
    expect(box.getAttribute('aria-controls')).toBe('menu');
  });
});

describe('b- attributes in data', () => {
  it('are not written by a spread, on the server or in the browser', async () => {
    await resume('spreadForged', {});
    const box = document.querySelector('.box')!;
    const forwarded = document.querySelector('.forwarded')!;
    for (const element of [box, forwarded]) {
      expect(element.getAttribute('title')).toBe('count 0');
      expect(element.getAttribute('b-on') ?? '').not.toContain('Other');
      expect(element.getAttribute('b-b') ?? '').not.toMatch(/^0:9$/);
    }
    click(document.querySelector('.inc')!);
    await waitFor(() => expect(box.getAttribute('title')).toBe('count 1'));
    for (const element of [box, forwarded]) {
      expect(element.getAttribute('b-on') ?? '').not.toContain('Other');
      expect(element.getAttribute('b-b') ?? '').not.toMatch(/^0:10$/);
    }
  });
});

describe('windowed lists', () => {
  /**
   * Lays out the scroll boxes and the spacers, as a browser would, with rows 30 pixels tall.
   * `.scroll` scrolls by `scroll`, and `.inner` by `inner`. A `.wrap` around a list is as tall
   * as its content.
   */
  function layout(scroll: { top: number; height?: number }, inner: { top: number } = { top: 0 }) {
    const original = Element.prototype.getBoundingClientRect;
    const box = (top: number, height: number) =>
      ({
        top,
        bottom: top + height,
        height,
        left: 0,
        right: 0,
        width: 0,
        x: 0,
        y: top,
      }) as DOMRect;
    const scrolls = (element: Element) =>
      element.classList.contains('scroll') || element.classList.contains('inner');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (this.classList.contains('scroll')) {
        return box(0, scroll.height ?? 120);
      }
      if (this.classList.contains('inner')) {
        return box(0, 120);
      }
      if (this.classList.contains('wrap')) {
        return box(0, 600);
      }
      const place = this.getAttribute('data-window');
      if (place) {
        const before = this.parentElement!.querySelector<HTMLElement>('[data-window=before]')!;
        const rows = Array.from(this.parentElement!.children).filter((child) =>
          /\b(row|irow|group)\b/.test(child.className),
        ).length;
        const owner = this.closest('.inner, .scroll');
        const start = -(owner?.classList.contains('inner') ? inner.top : scroll.top);
        const beforeHeight = parseFloat(before.style.height) || 0;
        return place === 'before'
          ? box(start, beforeHeight)
          : box(
              start + beforeHeight + rows * 30,
              parseFloat((this as HTMLElement).style.height) || 0,
            );
      }
      return original.call(this);
    });
    // A scroll box has more to scroll than it shows, and a wrapper is as tall as its content.
    // The height of a scroll box, and of what it scrolls, for the elements of the fixtures.
    const sized = (element: Element, box: number): number => {
      if (element.classList.contains('wrap')) {
        return 600;
      }
      return scrolls(element) ? box : 0;
    };
    const sizes = {
      clientHeight(this: Element) {
        return sized(this, scroll.height ?? 120);
      },
      scrollHeight(this: Element) {
        return sized(this, 3000);
      },
    };
    for (const [name, get] of Object.entries(sizes)) {
      const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name);
      Object.defineProperty(HTMLElement.prototype, name, { get, configurable: true });
      onTestFinished(() => {
        if (original) {
          Object.defineProperty(HTMLElement.prototype, name, original);
        } else {
          delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
        }
      });
    }
  }

  it('render the first items on the server, and the items in view in the browser', async () => {
    const scroll = { top: 0 };
    layout(scroll);
    await resume('windowed', {});
    // The server rendered the first 6, and spacers for the height of the rest.
    const after = document.querySelector<HTMLElement>('[data-window=after]')!;
    expect(after.tagName).toBe('LI');
    expect(after.getAttribute('aria-hidden')).toBe('true');
    // The window draws: the 4 in view, and 3 more after.
    await waitFor(() => expect(document.querySelectorAll('.row')).toHaveLength(7));
    expect(after.style.height).toBe(`${(100 - 7) * 30}px`);
    // A scroll renders the items that come into view, and the spacer before takes the rest.
    scroll.top = 30 * 50;
    document.querySelector('.scroll')!.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(document.querySelector('.row-50')).not.toBeNull());
    expect(document.querySelector('.row-0')).toBeNull();
    expect(document.querySelector<HTMLElement>('[data-window=before]')!.style.height).toBe(
      `${47 * 30}px`,
    );
  });

  it('take the tag of their spacers from the element where a component inserts them', async () => {
    await resume('windowedChildren', {});
    const before = document.querySelector('[data-window=before]')!;
    expect(before.tagName).toBe('TR');
    expect(before.parentElement!.classList.contains('win-body')).toBe(true);
    expect(document.querySelector('[data-window=after]')!.tagName).toBe('TR');
  });

  it('keep the state of an item that leaves the view, while it is in the list', async () => {
    const scroll = { top: 0 };
    layout(scroll);
    await resume('windowed', {});
    await waitFor(() => expect(document.querySelectorAll('.row')).toHaveLength(7));
    click(document.querySelector('.pick-1')!);
    await waitFor(() => expect(text('.pick-1')).toBe('Row 1 1'));
    scroll.top = 30 * 50;
    document.querySelector('.scroll')!.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(document.querySelector('.row-1')).toBeNull());
    scroll.top = 0;
    document.querySelector('.scroll')!.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(document.querySelector('.row-1')).not.toBeNull());
    expect(text('.pick-1')).toBe('Row 1 1');
    // An item that the list drops goes, and the window shows the next ones.
    click(document.querySelector('.drop')!);
    await waitFor(() => expect(document.querySelector('.row-0')).toBeNull());
    expect(document.querySelector('.row-1')).not.toBeNull();
  });

  /** Scrolls the box, and waits for the frame that draws. */
  async function scrollTo(selector: string, scroll: { top: number }, top: number) {
    scroll.top = top;
    document.querySelector(selector)!.dispatchEvent(new Event('scroll'));
    await new Promise((done) => requestAnimationFrame(() => done(undefined)));
  }

  it('show the #else body only for an empty list, not when no item is in view', async () => {
    const scroll = { top: 0 };
    layout(scroll);
    await resume('windowedElse', {});
    await waitFor(() => expect(document.querySelector('.row-0')).not.toBeNull());
    await scrollTo('.scroll', scroll, 30 * 500);
    await waitFor(() => expect(document.querySelector('.row-0')).toBeNull());
    expect(document.querySelector('.none')).toBeNull();
    await scrollTo('.scroll', scroll, 0);
    await waitFor(() => expect(document.querySelector('.row-0')).not.toBeNull());
    expect(document.querySelector('.none')).toBeNull();
  });

  it('keys the items by their index in the whole list, also after a scroll', async () => {
    const scroll = { top: 0 };
    layout(scroll);
    await resume('windowedIndex', {});
    await waitFor(() => expect(document.querySelectorAll('.row')).toHaveLength(7));
    click(document.querySelector('.pick-1')!);
    await waitFor(() => expect(text('.pick-1')).toBe('Row 1 1'));
    await scrollTo('.scroll', scroll, 30 * 50);
    await waitFor(() => expect(document.querySelector('.row-50')).not.toBeNull());
    // The rows that come into view have no state of rows that left.
    expect(text('.pick-48')).toBe('Row 48 0');
    expect(text('.pick-50')).toBe('Row 50 0');
    await scrollTo('.scroll', scroll, 0);
    await waitFor(() => expect(document.querySelector('.row-1')).not.toBeNull());
    expect(text('.pick-1')).toBe('Row 1 1');
  });

  it('keep updating a nested window while its item is out of the page for a while', async () => {
    const scroll = { top: 0 };
    const inner = { top: 0 };
    layout(scroll, inner);
    await resume('windowedNested', {});
    await waitFor(() => expect(document.querySelector('.irow-0-0')).not.toBeNull());
    // The group leaves the view, and the window is resized meanwhile.
    await scrollTo('.scroll', scroll, 30 * 12);
    await waitFor(() => expect(document.querySelector('.group-0')).toBeNull());
    window.dispatchEvent(new Event('resize'));
    await new Promise((done) => requestAnimationFrame(() => done(undefined)));
    await scrollTo('.scroll', scroll, 0);
    await waitFor(() => expect(document.querySelector('.group-0')).not.toBeNull());
    await scrollTo('.inner-0', inner, 30 * 40);
    await waitFor(() => expect(document.querySelector('.irow-0-40')).not.toBeNull());
  });

  it('draws again when the box that scrolls the list changes its size', async () => {
    const observers: (() => void)[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          observers.push(callback);
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    const scroll = { top: 0, height: 120 };
    layout(scroll);
    await resume('windowed', {});
    await waitFor(() => expect(document.querySelectorAll('.row')).toHaveLength(7));
    expect(observers.length).toBeGreaterThan(0);
    scroll.height = 300;
    for (const callback of observers) {
      callback();
    }
    await waitFor(() => expect(document.querySelectorAll('.row')).toHaveLength(13));
  });

  it('takes the box that scrolls vertically, not a wrapper that has no height', async () => {
    const scroll = { top: 0 };
    layout(scroll);
    await resume('windowedWrapped', {});
    await waitFor(() => expect(document.querySelectorAll('.row')).toHaveLength(7));
    await scrollTo('.scroll', scroll, 30 * 50);
    await waitFor(() => expect(document.querySelector('.row-50')).not.toBeNull());
  });
});

describe('blocks in children', () => {
  it('render the bodies that the browser adds with the contexts where the children are', async () => {
    await resume('blockInChildren', {});
    expect(text('.item-a')).toBe('boxed');
    click(document.querySelector('.add')!);
    await waitFor(() => expect(text('.item-b')).toBe('boxed'));
    click(document.querySelector('.show')!);
    await waitFor(() => expect(text('.later')).toBe('boxed'));
  });

  it('follow the component that gets them through components that pass them on', async () => {
    await resume('blockPassed', {});
    expect(text('.item-a')).toBe('boxed');
    click(document.querySelector('.add')!);
    await waitFor(() => expect(text('.item-b')).toBe('boxed'));
  });

  it('render an #offscreen body that shows the first time with the contexts there', async () => {
    await resume('offscreenInChildren', {});
    click(document.querySelector('.show')!);
    await waitFor(() => expect(text('.off')).toBe('boxed'));
  });

  it('render a #client body with the contexts there', async () => {
    await resume('clientInChildren', {});
    await waitFor(() => expect(text('.later')).toBe('boxed'));
  });

  it('render the bodies of a #try again with the contexts there', async () => {
    await resume('tryInChildren', {});
    expect(text('.ok')).toBe('boxed');
    click(document.querySelector('.throw')!);
    await waitFor(() => expect(text('.caught')).toBe('boxed'));
    click(document.querySelector('.reset')!);
    await waitFor(() => expect(text('.ok')).toBe('boxed'));
  });

  it('render a #portal body that moves with the contexts there', async () => {
    await resume('portalInChildren', {});
    await waitFor(() => expect(text('#left .moved')).toBe('boxed'));
    click(document.querySelector('.move')!);
    await waitFor(() => expect(text('#right .moved')).toBe('boxed'));
  });
});

describe('cloned markup', () => {
  it('builds the blocks that never update inside a clone, and its handlers run', async () => {
    await resume('clonedStatic', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(text('.box i')).toBe('a'));
    expect([...document.querySelectorAll('.box i')].map((item) => item.textContent)).toEqual([
      'a',
      'b',
    ]);
    expect(document.querySelector('.wide')).not.toBeNull();
    expect(document.querySelector('.narrow')).toBeNull();
    click(document.querySelector('.count')!);
    await waitFor(() => expect(text('.count')).toBe('1'));
  });

  it('fills the blocks inside a clone, which update in place after', async () => {
    await resume('clonedBlocks', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(text('.items')).toBe('ab'));
    expect(document.querySelector('.more')).not.toBeNull();
    const first = document.querySelector('.items li')!;
    click(document.querySelector('.add')!);
    await waitFor(() => expect(text('.items')).toBe('abc'));
    // The list kept the items that stay.
    expect(document.querySelector('.items li')).toBe(first);
    click(document.querySelector('.less')!);
    await waitFor(() => expect(document.querySelector('.more')).toBeNull());
    click(document.querySelector('.less')!);
    await waitFor(() => expect(document.querySelector('.more')).not.toBeNull());
    // Closed and opened again, the clone fills its blocks with the values of now.
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelector('.box')).toBeNull());
    click(document.querySelector('.open')!);
    await waitFor(() => expect(text('.items')).toBe('abc'));
  });

  it('writes the text of an insert in a clone, and updates the text node that it keeps', async () => {
    await resume('clonedText', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(text('.hello')).toBe('Hello Ada, you have 1 items.'));
    const hello = document.querySelector('.hello')!;
    // The clone holds a text node in place of each insert, and no markers.
    expect([...hello.childNodes].map((node) => node.nodeType)).toEqual([3, 3, 3, 3, 3]);
    const name = hello.childNodes[1]!;
    // At the end of its element, the text node is the last child, with no comment either.
    const last = document.querySelector('.last')!;
    expect([...last.childNodes].map((node) => node.nodeType)).toEqual([3, 3]);
    click(document.querySelector('.rename')!);
    await waitFor(() => expect(text('.hello')).toBe('Hello Ada!, you have 2 items.'));
    expect(hello.childNodes[1]).toBe(name);
    expect(text('.last')).toBe('Bye Ada!');
  });
});

describe('cloned handlers', () => {
  it('find their scope from an element around them that has an anchor', async () => {
    await resume('clonedHandlers', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelector('.go')).not.toBeNull());
    click(document.querySelector('.go')!);
    await waitFor(() => expect(text('.hits')).toBe('1'));
    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(document.querySelector('section.on')).not.toBeNull());
    click(document.querySelector('.go')!);
    await waitFor(() => expect(text('.hits')).toBe('2'));
  });
});

describe('cloned SVG', () => {
  it('parses children, components and dynamic tags inside SVG as SVG', async () => {
    await resume('clonedForeign', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelector('.box')).not.toBeNull());
    const svg = 'http://www.w3.org/2000/svg';
    // Children that a component puts inside its <svg>.
    expect(document.querySelector('.child')!.namespaceURI).toBe(svg);
    // A component whose top element is an SVG element, inside an <svg>.
    expect(document.querySelector('.dot')!.namespaceURI).toBe(svg);
    // A dynamic tag inside an <svg>.
    expect(document.querySelector('.shape')!.namespaceURI).toBe(svg);
    // A spread on an SVG element keeps the case of its names.
    expect(document.querySelector('.icon')!.getAttribute('viewBox')).toBe('0 0 10 10');
    expect(document.querySelector('.icon')!.hasAttribute('viewbox')).toBe(false);
  });

  it('puts an insert after a void element, not inside it', async () => {
    await resume('clonedForeign', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelector('.check')).not.toBeNull());
    expect(text('.check')).toBe('Remember me');
    expect(document.querySelector('.check input')!.childNodes).toHaveLength(0);
  });
});

describe('a spread that writes nothing on the server', () => {
  it('keeps the attributes that other code set on its first update', async () => {
    await resume('spreadEmpty', {});
    const box = document.querySelector<HTMLElement>('.wrap > div')!;
    await waitFor(() => expect(box.getAttribute('aria-controls')).toBe('menu'));
    click(document.querySelector('.fill')!);
    await waitFor(() => expect(box.getAttribute('title')).toBe('Full'));
    expect(box.getAttribute('aria-controls')).toBe('menu');
  });
});

describe('templates called again', () => {
  it('update in place with their new arguments, and keep their elements', async () => {
    await resume('templateInPlace', {});
    const lines = () => [...document.querySelectorAll<HTMLElement>('.line')];
    const first = lines()[0]!;
    expect(lines().map((item) => item.textContent)).toEqual(['a', 'b']);
    click(document.querySelector('.rename')!);
    await waitFor(() => expect(lines().map((item) => item.textContent)).toEqual(['a!', 'b!']));
    // The server rendered the element, and it stays.
    expect(lines()[0]).toBe(first);
    click(document.querySelector('.add')!);
    await waitFor(() => expect(lines()).toHaveLength(3));
    const added = lines()[2]!;
    expect(added.dataset.index).toBe('2');
    click(document.querySelector('.rename')!);
    await waitFor(() =>
      expect(lines().map((item) => item.textContent)).toEqual(['a!!', 'b!!', 'new!']),
    );
    // The browser rendered this one, and it stays too.
    expect(lines()[2]).toBe(added);
    expect(lines()[0]).toBe(first);
  });

  it('render again after the insert showed something else', async () => {
    await resume('templateToggled', {});
    const slot = () => document.querySelector('.slot')!.textContent;
    expect(slot()).toBe('1');
    click(document.querySelector('.tg')!);
    await waitFor(() => expect(slot()).toBe('none'));
    click(document.querySelector('.inc')!);
    click(document.querySelector('.tg')!);
    await waitFor(() => expect(slot()).toBe('2'));
    click(document.querySelector('.inc')!);
    await waitFor(() => expect(slot()).toBe('3'));
  });

  it('do not update another template of the same component in place', async () => {
    await resume('templateSwitched', {});
    const shown = () => {
      const element = document.querySelector('.slot > span')!;
      return `${element.className} ${element.textContent}`;
    };
    expect(shown()).toBe('tb B1');
    click(document.querySelector('.flip')!);
    await waitFor(() => expect(shown()).toBe('ta A1'));
    click(document.querySelector('.inc')!);
    await waitFor(() => expect(shown()).toBe('ta A2'));
    click(document.querySelector('.flip')!);
    await waitFor(() => expect(shown()).toBe('tb B2'));
  });
});

describe('function props in markup that the browser renders', () => {
  it('return their results, in a memo, in markup and in a handler', async () => {
    await resume('valueFilterLater', {});
    click(document.querySelector('.show')!);
    await waitFor(() => expect(text('.shown')).toBe('2,4'));
    const marks = () => [...document.querySelectorAll('li')].map((item) => item.textContent);
    expect(marks()).toEqual(['dropped', 'kept', 'dropped', 'kept']);
    click(document.querySelector('.more')!);
    click(document.querySelector('.more')!);
    await waitFor(() => expect(text('.shown')).toBe('2,4,6'));
    click(document.querySelector('.pick')!);
    await waitFor(() => expect(text('.picked')).toBe('true'));
  });
});

describe('shorthand handlers', () => {
  it('runs a handler that a shorthand gives an element', async () => {
    await resume('shorthandHandler', {});
    expect(document.querySelector('.go')!.getAttribute('b-on')).toMatch(/^click=/);
    click(document.querySelector('.go')!);
    await waitFor(() => expect(text('.go')).toBe('1'));
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

describe('effect cleanups', () => {
  it('does not run an effect again for a value that only its cleanup reads', async () => {
    const log: string[] = [];
    (globalThis as { cleanupLog?: string[] }).cleanupLog = log;
    await resume('effectCleanup', {});
    click(document.querySelector('.a')!);
    await waitFor(() => expect(log).toEqual(['run 1']));
    click(document.querySelector('.b')!);
    await waitFor(() => expect(text('.b-value')).toBe('1'));
    expect(log).toEqual(['run 1']);
    click(document.querySelector('.a')!);
    await waitFor(() => expect(log).toEqual(['run 1', 'clean 1', 'run 2']));
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
    expect(form).toMatch(/b-action="Signup_\w+#signUp" b-result="\d+:\d+"/);
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
    expect(posted.html).toContain('<p class="error" b-b="1.0:0">Enter an email address</p>');
    expect(posted.html).toContain('Enter an email address');
  });

  it('sends the key of an idempotent form, and gives the form a new one after the answer', async () => {
    vi.resetModules();
    const server = await import(file('signup.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      urls.push(url);
      return runtime.handleRequest(server.rpc, new Request(`http://localhost${url}`, init));
    });
    const { html, state } = await runtime.render(server.default, {});
    // The server puts a key in the URL of a form of a function that `idempotent` made.
    show(html.replace('__action=', '__key=first-key-0001&amp;__action=') + state);
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });
    const form = document.querySelector<HTMLFormElement>('.signup')!;
    form.querySelector('input')!.value = 'nope';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => expect(text('.error')).toBe('Enter an email address'));
    expect(urls[0]).toMatch(/\?__key=first-key-0001$/);
    // The next post is one that the user means again, so it has a new key.
    await waitFor(() => expect(form.getAttribute('action')).not.toContain('first-key-0001'));
    expect(form.getAttribute('action')).toMatch(/__key=[\w-]{36}/);
    expect(form.getAttribute('action')).toContain('__action=');
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

describe('validation with $action', () => {
  it('shows the field errors of parseForm, then the result', async () => {
    vi.resetModules();
    const server = await import(file('validated.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) =>
      runtime.handleRequest(server.rpc, new Request(`http://localhost${url}`, init)),
    );
    const { html, state } = await runtime.render(server.default, {});
    show(html + state);
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });

    const form = document.querySelector<HTMLFormElement>('.join')!;
    form.querySelector('input')!.value = 'nope';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => expect(text('.error')).toBe('Enter an email address'));

    form.querySelector('input')!.value = 'ada@example.com';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => expect(text('.welcome')).toBe('Welcome ada@example.com'));
    expect(document.querySelector('.error')).toBeNull();
  });
});

describe('attributes with true and false', () => {
  it('renders and updates the words of attributes that say their state', async () => {
    await resume('ariaSwitch', {});
    const toggle = document.querySelector('.toggle')!;
    const menu = document.querySelector('.menu')!;
    const words = (): (string | null)[] => [
      toggle.getAttribute('aria-expanded'),
      menu.getAttribute('aria-hidden'),
      menu.getAttribute('draggable'),
      menu.getAttribute('spellcheck'),
      menu.getAttribute('translate'),
    ];
    expect(words()).toEqual(['false', 'true', 'false', 'false', 'no']);
    // An attribute without a value stays empty when a spread merges with it.
    expect(document.querySelector('.flag')!.getAttribute('data-ready')).toBe('');
    click(toggle);
    await waitFor(() => expect(words()).toEqual(['true', 'false', 'true', 'false', 'yes']));
  });
});

describe('writes that change nothing', () => {
  it('leaves the page alone when a list comes again with new objects of the same values', async () => {
    await resume('starList', {});
    const changed: Node[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        changed.push(record.target);
      }
    });
    observer.observe(document.querySelector('ul')!, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    // Each item reruns its updates, and each write finds the value already there.
    click(document.querySelector('.reload')!);
    click(document.querySelector('.star')!);
    await waitFor(() =>
      expect(texts('.mark').filter((mark) => mark === 'starred')).toHaveLength(1),
    );
    observer.disconnect();
    const rows = new Set(
      changed.map((node) => (node instanceof Element ? node : node.parentElement)!.closest('li')),
    );
    expect([...rows].map((row) => row?.title)).toEqual(['Item 5']);
  });
});

/** Presses a submit button of a form, as a browser does. */
function pressSubmit(form: HTMLFormElement, button: Element): void {
  const event = new Event('submit', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'submitter', { value: button });
  form.dispatchEvent(event);
}

/** Renders the order form, resumes it, and answers its posts with its server functions. */
async function showOrder(): Promise<HTMLFormElement> {
  vi.resetModules();
  const server = await import(file('orderForm.brm.ts'));
  const runtime = await import('../src/runtime/server.ts');
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) =>
    runtime.handleRequest(server.rpc, new Request(`http://localhost${url}`, init)),
  );
  const { html, state } = await runtime.render(server.default, {});
  show(html + state);
  vi.resetModules();
  const { start } = await import('../src/runtime/loader.ts');
  stop = start({ load: (id) => import(modules.get(id)!) });
  return document.querySelector<HTMLFormElement>('.order')!;
}

describe('createForm', () => {
  it('renders the fields with names, IDs and default values', async () => {
    const form = await showOrder();
    const email = form.querySelector<HTMLInputElement>('.email')!;
    expect(email.name).toBe('email');
    expect(form.querySelector('label')!.getAttribute('for')).toBe(email.id);
    expect(email.id).toBe(`${form.id}-email`);
    expect([...form.querySelectorAll<HTMLInputElement>('.item')].map((item) => item.name)).toEqual([
      'items[0].name',
    ]);
    const insert = form.querySelector<HTMLButtonElement>('.insert')!;
    expect(insert.name).toBe('__intent');
    expect(insert.hasAttribute('formnovalidate')).toBe(true);
    expect(JSON.parse(insert.value)).toEqual({ type: 'insert', name: 'items' });
    expect(form.querySelector('.default')!.getAttribute('tabindex')).toBe('-1');
  });

  it('shows the errors of each field, with the values that were posted', async () => {
    const form = await showOrder();
    form.querySelector<HTMLInputElement>('.email')!.value = 'nope';
    // happy-dom leaves empty values out of the body of a request, so each field has one.
    form.querySelector<HTMLInputElement>('.item')!.value = 'Tea';
    pressSubmit(form, form.querySelector('.save')!);
    await waitFor(() => expect(text('.email-error')).toBe('Enter an email address'));
    const email = form.querySelector<HTMLInputElement>('.email')!;
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(email.getAttribute('aria-describedby')).toBe(`${email.id}-error`);
    expect(document.querySelector('.email-error')!.id).toBe(`${email.id}-error`);
    expect(document.querySelector('.email-error')!.getAttribute('role')).toBe('alert');
    expect(email.getAttribute('value')).toBe('nope');
  });

  it('applies intents on the server, and keeps what was typed', async () => {
    const form = await showOrder();
    form.querySelector<HTMLInputElement>('.email')!.value = 'ada@example.com';
    form.querySelector<HTMLInputElement>('.item')!.value = 'Tea';
    pressSubmit(form, form.querySelector('.insert')!);
    await waitFor(() => expect(form.querySelectorAll('.item')).toHaveLength(2));
    const itemInputs = () => [...form.querySelectorAll<HTMLInputElement>('.item')];
    expect(itemInputs().map((item) => [item.name, item.value])).toEqual([
      ['items[0].name', 'Tea'],
      ['items[1].name', ''],
    ]);
    // An intent shows no errors, for fields that the user has not filled yet.
    expect(document.querySelector('.item-error')).toBeNull();
    itemInputs()[1]!.value = 'Milk';
    pressSubmit(form, form.querySelectorAll('.remove')[0]!);
    await waitFor(() => expect(itemInputs().map((item) => item.value)).toEqual(['Milk']));
    expect(itemInputs()[0]!.name).toBe('items[0].name');
    expect(form.querySelector<HTMLInputElement>('.email')!.value).toBe('ada@example.com');
  });

  it('validates in the browser when the user leaves a field, then as the user types', async () => {
    const form = await showOrder();
    expect(form.getAttribute('b-on')).toMatch(/focusout=\S+ input=\S+/);
    const email = form.querySelector<HTMLInputElement>('.email')!;
    email.value = 'nope';
    // Typing in a field that the user has not left shows nothing yet.
    email.dispatchEvent(new Event('input', { bubbles: true }));
    email.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await waitFor(() => expect(text('.email-error')).toBe('Enter an email address'));
    expect(email.getAttribute('aria-invalid')).toBe('true');
    // The item is not touched, so its error does not show.
    expect(document.querySelector('.item-error')).toBeNull();
    email.value = 'ada@example.com';
    email.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => expect(document.querySelector('.email-error')).toBeNull());
    expect(email.hasAttribute('aria-invalid')).toBe(false);
  });

  it('validates every field as the user types after a submit', async () => {
    const form = await showOrder();
    const email = form.querySelector<HTMLInputElement>('.email')!;
    email.value = 'nope';
    form.querySelector<HTMLInputElement>('.item')!.value = 'Tea';
    pressSubmit(form, form.querySelector('.save')!);
    await waitFor(() => expect(text('.email-error')).toBe('Enter an email address'));
    const item = form.querySelector<HTMLInputElement>('.item')!;
    item.value = '';
    item.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => expect(text('.item-error')).toBe('Name the item'));
    expect(text('.email-error')).toBe('Enter an email address');
  });

  it('applies the buttons of a list in the browser, without a post', async () => {
    const form = await showOrder();
    const posts = vi.fn<typeof fetch>(globalThis.fetch);
    vi.stubGlobal('fetch', posts);
    const insert = form.querySelector('.insert')!;
    expect(insert.getAttribute('b-on')).toMatch(/^click:prevent=/);
    const itemInputs = () => [...form.querySelectorAll<HTMLInputElement>('.item')];
    itemInputs()[0]!.value = 'Tea';
    const first = itemInputs()[0];
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    insert.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(itemInputs()).toHaveLength(2));
    // The first item keeps its element and what was typed in it.
    expect(itemInputs()[0]).toBe(first);
    expect(itemInputs().map((item) => [item.name, item.value])).toEqual([
      ['items[0].name', 'Tea'],
      ['items[1].name', ''],
    ]);
    itemInputs()[1]!.value = 'Milk';
    const second = itemInputs()[1];
    // The new item, which the browser rendered, has a button that works too.
    click(form.querySelectorAll('.remove')[0]!);
    await waitFor(() => expect(itemInputs()).toEqual([second]));
    expect(second!.name).toBe('items[0].name');
    expect(second!.value).toBe('Milk');
    expect(posts).not.toHaveBeenCalled();
  });

  it('shows the errors of the form, and resets the form after a save', async () => {
    const form = await showOrder();
    const email = form.querySelector<HTMLInputElement>('.email')!;
    email.value = 'taken@example.com';
    form.querySelector<HTMLInputElement>('.item')!.value = 'Tea';
    pressSubmit(form, form.querySelector('.save')!);
    await waitFor(() => expect(text('.form-error')).toBe('That email has an order already'));
    email.value = 'ada@example.com';
    pressSubmit(form, form.querySelector('.save')!);
    await waitFor(() => expect(text('.saved')).toBe('Saved'));
    await waitFor(() => expect(document.querySelector('.form-error')).toBeNull());
    await waitFor(() => expect(email.value).toBe(''));
    expect(form.querySelector<HTMLInputElement>('.item')!.value).toBe('');
  });
});

describe('bindings', () => {
  it('writes the parent signal from a bound prop, and the copy of an unbound one', async () => {
    await resume('bindParent', {});
    const state = (): string[] => [text('.parent'), text('.child.bound'), text('.child.own')];
    expect(state()).toEqual(['closed', 'bound: closed', 'own: closed']);
    // The bound child writes the parent's signal, which the other child gets as a prop.
    click(document.querySelector('.child.bound')!);
    await waitFor(() => expect(state()).toEqual(['open', 'bound: open', 'own: open']));
    // The other child writes its own copy.
    click(document.querySelector('.child.own')!);
    await waitFor(() => expect(state()).toEqual(['open', 'bound: open', 'own: closed']));
    // A new value from the parent replaces the copy.
    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(state()).toEqual(['closed', 'bound: closed', 'own: closed']));
    // A child that binds the prop that its parent bound writes through both.
    click(document.querySelector('.child.deep')!);
    await waitFor(() => expect(state()).toEqual(['open', 'bound: open', 'own: open']));
    expect(text('.child.deep')).toBe('deep: open');
    // A child that the browser renders binds too.
    click(document.querySelector('.more')!);
    await waitFor(() => expect(text('.child.later')).toBe('later: open'));
    click(document.querySelector('.child.later')!);
    await waitFor(() => expect(state()).toEqual(['closed', 'bound: closed', 'own: closed']));
  });
});

describe('calls of functions of other components', () => {
  it('runs them in the order that they were made, also when the code of the first is slower', async () => {
    // The calls come while the code of the page loads.
    await resume('orderedCalls', {}, { all: 80 });
    click(document.querySelector('.both')!);
    await waitFor(() => expect(text('.log')).toBe('ab'));
  });
});

describe('controlled props', () => {
  it('tells a prop that the caller passed from a missing one, and a bound one from a copy', async () => {
    await resume('controlledParent', {});
    const part = (label: string): string => text(`.part.${label}`);
    // A missing prop leaves the part its own state.
    click(document.querySelector('.part.free')!);
    await waitFor(() => expect(part('free')).toBe('free: open'));
    // The parent's onChange loads its own code, so it can run after the part has updated.
    await waitFor(() => expect(text('.seen')).toBe('free true'));
    // A passed prop that is not bound: the part only reports, and shows what the caller keeps.
    click(document.querySelector('.part.held')!);
    await waitFor(() => expect(text('.seen')).toBe('held true'));
    expect(part('held')).toBe('held: closed');
    click(document.querySelector('.hold')!);
    await waitFor(() => expect(part('held')).toBe('held: open'));
    // A bound prop writes the caller's signal.
    click(document.querySelector('.part.bound')!);
    await waitFor(() => expect(text('.values')).toBe('true true'));
    expect(part('bound')).toBe('bound: open');
    // A prop passed as undefined is still passed.
    click(document.querySelector('.part.none')!);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(part('none')).toBe('none: closed');
    // Parts that the browser renders know it too.
    click(document.querySelector('.more')!);
    await waitFor(() => expect(part('later')).toBe('later: open'));
    expect(part('later-free')).toBe('later-free: open');
    click(document.querySelector('.part.later-free')!);
    await waitFor(() => expect(part('later-free')).toBe('later-free: closed'));
  });
});

describe('view transitions', () => {
  it('runs a handler of transition inside a view transition, which waits for its updates', async () => {
    const seen: { types?: string[]; html: string }[] = [];
    type Options = (() => unknown) | { update: () => unknown; types: string[] };
    const start = vi.fn<(options: Options) => unknown>((options) => {
      const update = typeof options === 'function' ? options : options.update;
      const types = typeof options === 'function' ? undefined : options.types;
      const done = Promise.resolve()
        .then(update)
        .then(() => {
          seen.push({ types, html: document.querySelector('.panel')?.outerHTML ?? '' });
        });
      return { updateCallbackDone: done, finished: done, ready: done, skipTransition() {} };
    });
    // A browser with types of transitions has them on the prototype.
    vi.stubGlobal('ViewTransition', { prototype: { types: undefined } });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    Object.assign(document, { startViewTransition: start });
    onTestFinished(() => {
      vi.unstubAllGlobals();
      delete (document as { startViewTransition?: unknown }).startViewTransition;
    });
    await resume('viewTransition', {});
    const link = document.querySelector('.toggle')!;
    expect(link.getAttribute('b-on')).toMatch(/^click:prevent=/);
    click(link);
    // The update code loads inside the transition, and the new state is there when it ends.
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toEqual({ types: ['panel'], html: '<div class="panel">Panel</div>' });
    click(link);
    await waitFor(() => expect(seen).toHaveLength(2));
    expect(seen[1]!.html).toBe('');
  });

  it('runs the handler as it is with reduced motion', async () => {
    const start = vi.fn<() => void>();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    Object.assign(document, { startViewTransition: start });
    onTestFinished(() => {
      vi.unstubAllGlobals();
      delete (document as { startViewTransition?: unknown }).startViewTransition;
    });
    await resume('viewTransition', {});
    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(document.querySelector('.panel')).not.toBeNull());
    expect(start).not.toHaveBeenCalled();
  });
});

describe('long lists', () => {
  it('moves only the items that change places', async () => {
    await resume('swapList', {});
    const moved: Node[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        moved.push(...record.removedNodes);
      }
    });
    observer.observe(document.querySelector('ul')!, { childList: true });
    click(document.querySelector('.swap')!);
    await waitFor(() =>
      expect([...document.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
        'Row 1',
        'Row 5',
        'Row 3',
        'Row 4',
        'Row 2',
        'Row 6',
      ]),
    );
    observer.disconnect();
    expect(moved.filter((node) => node.nodeType === 1)).toHaveLength(2);
  });

  it('updates the items that the client added after the first of them is gone', async () => {
    await resume('swapList', {});
    click(document.querySelector('.add')!);
    await waitFor(() => expect(document.querySelectorAll('li')).toHaveLength(9));
    // Row 7 is the first node of the insert of rows 7 to 9.
    click(document.querySelector('.drop')!);
    await waitFor(() => expect(document.querySelectorAll('li')).toHaveLength(8));
    click(document.querySelector('.rename')!);
    await waitFor(() => expect(text('li:nth-child(8)')).toBe('Row 9!'));
    expect(text('li:nth-child(7)')).toBe('Row 8!');
  });

  it('updates the items that the client added', async () => {
    await resume('swapList', {});
    click(document.querySelector('.add')!);
    await waitFor(() => expect(document.querySelectorAll('li')).toHaveLength(9));
    click(document.querySelector('li:nth-child(8) a')!);
    await waitFor(() => expect(document.querySelector('li:nth-child(8)')!.className).toBe('on'));
  });
});

describe('values of fields', () => {
  it('keeps what the user checked while the value stays, and writes a value that changes', async () => {
    await resume('fieldKeeps', {});
    const box = document.querySelector<HTMLInputElement>('.box')!;
    const runs = (count: string) => waitFor(() => expect(text('.runs')).toBe(count));
    // The first update writes the value, as a form's reply does before the user checks a box.
    click(document.querySelector('.rerun')!);
    await runs('1');
    box.checked = true;
    click(document.querySelector('.rerun')!);
    await runs('2');
    expect(box.checked).toBe(true);
    // The value changes to true, then to false, and the box follows it.
    click(document.querySelector('.post')!);
    await waitFor(() => expect(box.checked).toBe(true));
    box.checked = false;
    click(document.querySelector('.post')!);
    await waitFor(() => expect(box.checked).toBe(false));
    click(document.querySelector('.post')!);
    await waitFor(() => expect(box.checked).toBe(true));
  });
});

describe('the serial entry', () => {
  it('sends a value of the app in the page state, and makes it again in the browser', async () => {
    // The copy that the compiled components import, as an app's components import its entry.
    const entry = (await import(file('money.ts'))) as SerialEntry;
    useSerialEntry(entry);
    await resume('serialMoney', {}, {}, entry);
    expect(document.querySelector('script[b-state]')!.textContent).toContain('$b.u("test/money"');
    expect(text('.price')).toBe('5.00 EUR');
    // The handler calls a method of the value, so the browser made a Money again.
    click(document.querySelector('.more')!);
    await waitFor(() => expect(text('.price')).toBe('6.00 EUR'));
  });
});

describe('bindings with a setter', () => {
  it('calls the setter in place of writing, and the child shows what the parent keeps', async () => {
    await resume('bindSetter', {});
    const state = (): string[] => [text('.parent'), text('.child.guarded')];
    click(document.querySelector('.child.guarded')!);
    await waitFor(() => expect(state()).toEqual(['open', 'guarded: open']));
    // The setter refuses the value, so the child keeps the parent's.
    click(document.querySelector('.lock')!);
    click(document.querySelector('.child.guarded')!);
    await new Promise((done) => setTimeout(done, 50));
    expect(state()).toEqual(['open', 'guarded: open']);
    // An element calls the setter with its value.
    const field = document.querySelector<HTMLInputElement>('.name')!;
    expect(field.getAttribute('b-on')).toMatch(/^input=\$set:/);
    field.value = 'ada';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => expect(text('.name-out')).toBe('ADA'));
    expect(field.value).toBe('ADA');
    // A child that the browser renders calls the setter too.
    click(document.querySelector('.more')!);
    await waitFor(() => expect(text('.child.later')).toBe('later: open'));
    click(document.querySelector('.lock')!);
    click(document.querySelector('.child.later')!);
    await waitFor(() => expect(state()).toEqual(['closed', 'guarded: closed']));
  });
});

describe('bindings through spreads', () => {
  it('binds an element from a rest prop', async () => {
    await resume('bindSpread', {});
    const field = document.querySelector<HTMLInputElement>('.field.text')!;
    expect(field.getAttribute('b-on')).toMatch(/^input=\$bind#0\.\d+@\d+$/);
    field.value = 'hi';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => expect(text('.out')).toBe('hi|false'));
    const box = document.querySelector<HTMLInputElement>('.field.box')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => expect(text('.out')).toBe('hi|true'));
    // A setter passes through the spread too.
    const upper = document.querySelector<HTMLInputElement>('.field.upper')!;
    expect(upper.getAttribute('b-on')).toMatch(/^input=\$set:/);
    upper.value = 'ada';
    upper.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => expect(text('.upper-out')).toBe('ADA'));
  });
});

describe('spreads on components', () => {
  it('updates the props of a spread, and passes a binding on', async () => {
    await resume('spreadProps', {});
    // A binding passes through the rest of a component to its child.
    click(document.querySelector('.child.passed')!);
    await waitFor(() => expect(text('.parent')).toBe('open'));
    expect(text('.child.passed')).toBe('passed: open');
    expect(text('.child.first')).toBe('first: open');
    // A spread that changes updates the props, and a later prop wins over it.
    click(document.querySelector('.relabel')!);
    await waitFor(() => expect(text('.child.second')).toBe('second: open'));
  });
});

describe('refs of dynamic tags', () => {
  it('writes the element that a dynamic tag renders, from the server and from the browser', async () => {
    await resume('refDynamic', {});
    click(document.querySelector('.read')!);
    await waitFor(() => expect(text('.seen')).toBe('SECTION:none'));
    click(document.querySelector('.show')!);
    await waitFor(() => expect(document.querySelector('.second')).not.toBeNull());
    click(document.querySelector('.read')!);
    await waitFor(() => expect(text('.seen')).toBe('SECTION:ARTICLE'));
  });
});

describe('refs forwarded through components', () => {
  it('writes the element of a component into the signal of the caller', async () => {
    await resume('refForward', {});
    click(document.querySelector('.read')!);
    await waitFor(() => expect(text('.seen')).toBe('BUTTON:Relayed:none:undefined'));
    // A handler of the caller focuses the forwarded element.
    click(document.querySelector('.focus')!);
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('.inner')));
    // A `$client` of the caller reads it.
    await waitFor(() => expect(text('.loaded')).toBe('BUTTON'));
  });

  it('writes an element that the browser renders later, and keeps it once it is gone, as a plain ref does', async () => {
    await resume('refForward', {});
    click(document.querySelector('.show')!);
    await waitFor(() => expect(document.querySelectorAll('.inner').length).toBe(3));
    click(document.querySelector('.read')!);
    await waitFor(() => expect(text('.seen')).toBe('BUTTON:Relayed:BUTTON:true'));
    click(document.querySelector('.hide')!);
    await waitFor(() => expect(document.querySelectorAll('.inner').length).toBe(2));
    click(document.querySelector('.read')!);
    await waitFor(() => expect(text('.seen')).toBe('BUTTON:Relayed:BUTTON:false'));
  });

  it('writes the element of a dynamic tag that names a component, and of one that names an element', async () => {
    await resume('refForwardDynamic', {});
    click(document.querySelector('.read')!);
    await waitFor(() => expect(text('.seen')).toBe('BUTTON'));
    click(document.querySelector('.swap')!);
    await waitFor(() => expect(document.querySelector('section')).not.toBeNull());
    click(document.querySelector('.read')!);
    await waitFor(() => expect(text('.seen')).toBe('SECTION'));
  });

  it('a forwarded ref reaches a component that spreads its props', async () => {
    await resume('refForwardSpread', {});
    click(document.querySelector('.read')!);
    await waitFor(() => expect(text('.seen')).toBe('BUTTON'));
  });

  it('leaves the element out of the page state', async () => {
    const server = await import(file('refForward.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    expect(html).toContain('class="inner"');
    expect(state).not.toMatch(/HTMLElement|\[object /);
  });
});

describe('fields in spreads', () => {
  it('keeps what the user typed when the spread updates for another attribute', async () => {
    await resume('spreadField', {});
    const field = document.querySelector<HTMLInputElement>('.field')!;
    // The user types before the code of the field loads, so no handler writes the value.
    field.value = 'typed';
    click(document.querySelector('.bump')!);
    await waitFor(() => expect(field.getAttribute('data-count')).toBe('1'));
    expect(field.value).toBe('typed');
  });
});

describe('contexts that change', () => {
  it('updates a component that reads a context and provides it again, and the readers below it', async () => {
    await resume('tplContextPage', {});
    const read = () => [
      ...['direct', 'child', 'script-direct', 'script-child'].map((label) =>
        text(`.reader.${label}`),
      ),
      text('.relay'),
      text('.reader.relayed'),
    ];
    expect(read()).toEqual(['1', '1', '1', '1', '1', '11']);
    click(document.querySelector('.bump')!);
    click(document.querySelector('.script-bump')!);
    // The relay reads the new value from above, and its children read its new value.
    await waitFor(() => expect(read()).toEqual(['2', '2', '2', '2', '2', '12']));
  });

  it('updates a context that the script of a template provides, in markup that the browser renders', async () => {
    await resume('tplContextPage', {});
    click(document.querySelector('.show')!);
    const later = () =>
      [...document.querySelectorAll('.later .reader')].map((element) => element.textContent);
    await waitFor(() => expect(later()).toEqual(['1', '1']));
    click(document.querySelector('.bump')!);
    await waitFor(() => expect(later()).toEqual(['2', '2']));
  });
});

describe('rest props', () => {
  it('keeps the attributes of a rest that does not change when a spread next to it does', async () => {
    await resume('mixedSpreadParent', {});
    click(document.querySelector('.show')!);
    await waitFor(() => expect(document.querySelector('.mixed')).not.toBeNull());
    click(document.querySelector('.add')!);
    await waitFor(() =>
      expect(document.querySelector('.mixed')!.getAttribute('data-count')).toBe('1'),
    );
    expect(document.querySelector('.mixed')!.getAttribute('title')).toBe('Kept');
    expect(document.querySelector('[data-own]')!.className).toBe('count-1 mixed');
  });

  it('leaves out of a rest the props that another $props() call names', async () => {
    await resume('twoPropsParent', {});
    const button = document.querySelector('.two-props')!;
    expect(button.getAttribute('title')).toBe('Open the menu');
    expect(button.hasAttribute('open')).toBe(false);
    expect(button.hasAttribute('label')).toBe(false);
    click(button);
    await waitFor(() => expect(text('.two-props')).toBe('Menu false'));
    expect(button.hasAttribute('open')).toBe(false);
  });

  it('updates a spread of a rest prop when the parent passes a new value', async () => {
    await resume('restOuter', {});
    expect(document.querySelector('.dyn')!.getAttribute('title')).toBe('no');
    click(document.querySelector('.flip')!);
    await waitFor(() =>
      expect(document.querySelector('.plain')!.getAttribute('title')).toBe('yes'),
    );
    expect(document.querySelector('.dyn')!.getAttribute('title')).toBe('yes');
  });
});

describe('markup that streams in after a write', () => {
  it('updates a dynamic tag and a rest prop that stream in, and keeps the attributes of two spreads', async () => {
    const server = await import(file('lateTag.brm.ts'));
    const { html, state, pending } = await renderParts(server.default, {});
    show(html + state);
    await startLoader();
    click(document.querySelector('.count')!);
    await waitFor(() =>
      expect(document.querySelector('.both')!.getAttribute('title')).toBe('clicks 1'),
    );
    // The other spread keeps its attribute when one of them updates.
    expect(document.querySelector('.both')!.getAttribute('data-clicks')).toBe('1');
    server.release('section');
    // The element as it streams in, before the update of its scope runs.
    let late: Element | null = null;
    for await (const chunk of pending) {
      appendChunk(chunk);
      late ??= document.querySelector('.late');
      // The user checks the box before the update of its scope runs.
      const box = document.querySelector<HTMLInputElement>('.late-box');
      if (box && !box.dataset.clicked) {
        box.dataset.clicked = 'yes';
        box.click();
      }
    }
    late = late!;
    expect(late.localName).toBe('section');
    // The update of the streamed scope writes the new value into the element that is there.
    await waitFor(() => expect(text('.late')).toBe('1'));
    expect(late.isConnected).toBe(true);
    await waitFor(() => expect(document.querySelector('.plain')!.getAttribute('title')).toBe('1'));
    expect(document.querySelector('.plain')!.className).toBe('plain');
    // The update writes what the server rendered, so the box that the user checked stays checked.
    expect(document.querySelector<HTMLInputElement>('.late-box')!.checked).toBe(true);
  });
});

describe('templates that stream in after a write', () => {
  it('renders the template of a list that streams in, once its code loads', async () => {
    const server = await import(file('lateTemplate.brm.ts'));
    const { html, state, pending } = await renderParts(server.default, {});
    show(html + state);
    // The code of the page loads late, so the markup streams in before it.
    await startLoader({ all: 30 });
    click(document.querySelector('.count')!);
    await waitFor(() => expect(text('.count')).toBe('1'));
    server.release('apple,pear');
    for await (const chunk of pending) {
      appendChunk(chunk);
    }
    const names = () =>
      [...document.querySelectorAll('.late-list strong')].map((item) => item.textContent);
    expect(names()).toEqual(['apple', 'pear']);
    // The updates of the scopes that streamed in run with the code of the template.
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(names()).toEqual(['apple', 'pear']);
    click(document.querySelector('.flip')!);
    await waitFor(() => expect(names()).toEqual(['pear', 'apple']));
  });
});

describe('bindings of elements', () => {
  it('writes a signal from the value of an input, a box and a select', async () => {
    await resume('bindInputs', {});
    const field = document.querySelector<HTMLInputElement>('.text')!;
    expect(field.getAttribute('b-on')).toMatch(/^input=\$bind#0\.\d+ input=/);
    expect(document.querySelector('.box')!.getAttribute('b-on')).toMatch(/^change=\$bind#0\.\d+$/);
    field.value = 'hi';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    // The handler of the element runs after the binding, so it reads the new value.
    await waitFor(() => expect(text('.out')).toBe('hi|false|b|hi'));
    const box = document.querySelector<HTMLInputElement>('.box')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    const pick = document.querySelector<HTMLSelectElement>('.pick')!;
    pick.value = 'a';
    pick.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => expect(text('.out')).toBe('hi|true|a|hi'));
    // An input in an item writes the signal of the component, a scope up.
    const inner = document.querySelector<HTMLInputElement>('.inner')!;
    expect(inner.getAttribute('b-on')).toMatch(/^input=\$bind#1\.\d+$/);
    inner.value = 'deep';
    inner.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => expect(text('.out')).toBe('deep|true|a|hi'));
    expect(field.value).toBe('deep');
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
    const core = await import('../src/runtime/client.ts');
    core.remount([{ id, before: names, after: names, signals: ['count'] }]);
    // As the client router does: the core forgets the old page, and reads the new one.
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

/**
 * Resumes a page whose child reads a promise that its parent passes, and
 * loads the next one. The new promise settles after 50 ms, so the pending
 * state can come and go between two polls of `waitFor`. An observer records
 * it when it shows. Returns the name that showed while it was pending, and
 * whether it still shows at the end.
 */
async function loadNextUser(
  name: string,
): Promise<{ whilePending?: string; pendingAfter: boolean }> {
  const server = await import(file(`${name}.brm.ts`));
  const { html, state, pending } = await renderParts(server.default, {});
  show(html + state);
  for await (const chunk of pending) {
    appendChunk(chunk);
  }
  vi.resetModules();
  const { start } = await import('../src/runtime/loader.ts');
  stop = start({ load: (id) => import(modules.get(id)!) });
  expect(text('.name')).toBe('User 1');
  let whilePending: string | undefined;
  const observer = new MutationObserver(() => {
    if (whilePending === undefined && document.querySelector('.pending')) {
      whilePending = text('.name');
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  try {
    click(document.querySelector('.next')!);
    await waitFor(() => expect(text('.name')).toBe('User 2'));
  } finally {
    observer.disconnect();
  }
  return { whilePending, pendingAfter: document.querySelector('.pending') !== null };
}

describe('a promise passed as a prop', () => {
  // The child shows that it loads, with the old value, and then the new value without it.
  it('loads a memo of the prop again when the parent passes a new promise', async () => {
    expect(await loadNextUser('promiseParent')).toEqual({
      whilePending: 'User 1',
      pendingAfter: false,
    });
  });

  it('does the same for a destructured prop', async () => {
    expect(await loadNextUser('promiseParentDestructured')).toEqual({
      whilePending: 'User 1',
      pendingAfter: false,
    });
  });
});

/** The records of the scopes of a render, as the server holds them before it writes them. */
async function serverRecords(name: string, props: unknown): Promise<Record<number, unknown>> {
  const server = await import(file(`${name}.brm.ts`));
  const { Context } = await import('../src/runtime/server.ts');
  const ctx = new Context();
  await server.default(props, ctx);
  return toRecords(Object.fromEntries(ctx.state));
}

/** The fields of scope records that `clientRecords` reads, from records of the server. */
function toRecords(state: PageState): Record<number, unknown> {
  return Object.fromEntries(
    Object.entries(state).map(([id, record]) => [
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

/** Moves an ID by a number. An ID inside a block or a `#loading` body, such as `0.1`, moves by its first number. */
function shift(value: number | string, amount: number): number | string {
  if (typeof value === 'number') {
    return value + amount;
  }
  const dot = value.indexOf('.');
  return dot === -1
    ? Number(value) + amount
    : `${Number(value.slice(0, dot)) + amount}${value.slice(dot)}`;
}

/** The same fields of the scopes that the client read from the page, with IDs moved by `by`. */
async function clientRecords(ids: string[], by = 0): Promise<Record<number, unknown>> {
  const client = await import('../src/runtime/client.ts');
  return Object.fromEntries(
    ids.map((id) => {
      const scope = client.scopeOf(shift(id, by))!;
      const back = (value: number | string | undefined): number | string | undefined =>
        value === undefined ? undefined : shift(value, -by);
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

  it('moves the scope of children, and of the holder of passed children', async () => {
    const server = await import(file('blockPassed.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    show(html + moved(state));
    vi.resetModules();
    const client = await import('../src/runtime/client.ts');
    await (
      await import('../src/runtime/client-routes.ts')
    ).ready;
    client.init({
      load: async (id) => ({ id, props: {}, g: {}, load: async () => ({}) }),
      listen: () => {},
    });
    // Children render with the scope that wrote them, at its new ID.
    const children = [...client.scopes.values()].flatMap((scope) =>
      scope.s.filter(
        (value): value is { from: unknown } =>
          typeof value === 'object' && value !== null && 'ref' in value,
      ),
    );
    expect(children.length).toBeGreaterThan(0);
    for (const value of children) {
      expect(value.from).toBeDefined();
    }
    // The component that passes its children on knows where they are, at its new ID too.
    const holders = [...client.scopes.values()].filter((scope) => scope.f !== undefined);
    expect(holders.length).toBeGreaterThan(0);
    for (const scope of holders) {
      expect(client.scopes.get(scope.f!.id)).toBe(scope.f);
    }
    client.dispose();
  });

  it('moves the IDs of scopes in groups', async () => {
    const expected = await serverRecords('packed', { initial: rows });
    const server = await import(file('packed.brm.ts'));
    const { html, state } = await renderParts(server.default, { initial: rows });
    show(html + moved(state));
    vi.resetModules();
    const client = await import('../src/runtime/client.ts');
    await (
      await import('../src/runtime/client-routes.ts')
    ).ready;
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

function texts(selector: string): string[] {
  return [...document.querySelectorAll(selector)].map((node) => node.textContent!);
}

/** The labels of the items of `compact.brm`. */
function rowLabels(): string[] {
  return texts('ul .label');
}

function renameAt(index: number): void {
  click(document.querySelectorAll('ul .rename')[index]!);
}

/** Renames, moves, removes, empties and fills the list, which has one element per item. */
async function exercise(): Promise<void> {
  // The button has no anchor: its handler runs with the scope of the `<li>` around it.
  expect(document.querySelector('ul .rename')!.hasAttribute('b-b')).toBe(false);
  // A text that is the whole content of its element. An empty one has no text node.
  expect(document.querySelector('ul .note')!.childNodes).toHaveLength(0);
  renameAt(1);
  await waitFor(() => expect(rowLabels()).toEqual(['One', 'Two!', 'Three']));
  expect(texts('ul .note')).toEqual(['', '', 'x']);
  expect(document.querySelectorAll('ul li')[1]!.classList.contains('marked')).toBe(true);
  renameAt(0);
  await waitFor(() => expect(texts('ul .note')).toEqual(['1', '', 'x']));

  const first = document.querySelector('ul li');
  click(document.querySelector('.reverse')!);
  await waitFor(() => expect(rowLabels()).toEqual(['Three', 'Two!', 'One!']));
  // Items move: the element stays the same.
  expect(document.querySelectorAll('ul li')[2]).toBe(first);
  // A list whose items have two elements keeps its item markers.
  expect(texts('dd')).toEqual(['Three', 'Two!', 'One!']);
  // After the move, the handler still runs for its own item.
  renameAt(0);
  await waitFor(() => expect(rowLabels()).toEqual(['Three!', 'Two!', 'One!']));

  click(document.querySelector('.drop')!);
  await waitFor(() => expect(rowLabels()).toEqual(['Two!', 'One!']));
  expect(texts('dt')).toEqual(['2', '1']);

  // The fallback has an element with an anchor of its own. It is not an item.
  click(document.querySelector('.clear')!);
  await waitFor(() => expect(texts('ul li')).toEqual(['Nothing']));
  click(document.querySelector('.pick')!);
  await waitFor(() =>
    expect(document.querySelector('ul li')!.classList.contains('odd')).toBe(true),
  );
  click(document.querySelector('.add')!);
  await waitFor(() => expect(rowLabels()).toEqual(['New']));
  expect(texts('ul li')).toEqual(['NewRename']);
  click(document.querySelector('.add')!);
  await waitFor(() => expect(rowLabels()).toEqual(['New', 'New']));
  // Items that the client renders work the same way.
  renameAt(1);
  await waitFor(() => expect(rowLabels()).toEqual(['New', 'New!']));
  expect(texts('ul .note')).toEqual(['', '1']);
  expect(texts('dd')).toEqual(['New', 'New!']);
}

describe('compact markup', () => {
  const initial = [
    { id: '1', label: 'One', note: '' },
    { id: '2', label: 'Two', note: 2 },
    { id: '3', label: 'Three', note: 'x' },
  ];

  it('updates, moves and removes items, and finds the scope of handlers', async () => {
    await resume('compact', { initial });
    // The items are inside the block of the #for, block 0.
    expect(document.querySelector('ul li')!.getAttribute('b-b')).toBe('0.0:0');
    await exercise();
  }, 20_000);

  it('works after navigation moves the IDs of the page', async () => {
    document.body.innerHTML =
      '<script b-state b-scopes b-next="5" b-route="root">$bR(($R,$b)=>({}))</script>';
    const server = await import(file('compact.brm.ts'));
    const { html, state } = await renderParts(server.default, { initial });
    const page = `<!doctype html><html><body>${html}${state.replace('<script ', '<script b-route="root" ')}</body></html>`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(page, { headers: { 'content-type': 'text/html' } })),
    );
    const { navigate } = await import('../src/runtime/navigate.ts');
    await navigate({ url: '/compact', push: true, leave: async () => {}, enter: () => {} });
    expect(fetch).toHaveBeenCalledTimes(1);
    // The anchors of items and of texts in elements moved by 5, as the state does.
    expect(document.querySelector('ul li')!.getAttribute('b-b')).toBe('5.0:0');
    expect(document.querySelector('ul .label')!.getAttribute('b-b')).toBe('5.0:1');
    for (const script of document.querySelectorAll('script[b-state]')) {
      run(script);
    }
    await startLoader();
    await exercise();
  }, 20_000);

  it('keeps bindings and the handlers of spreads working after navigation moves the IDs', async () => {
    document.body.innerHTML =
      '<script b-state b-scopes b-next="5" b-route="root">$bR(($R,$b)=>({}))</script>';
    const server = await import(file('bindParent.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    const page = `<!doctype html><html><body>${html}${state.replace('<script ', '<script b-route="root" ')}</body></html>`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(page, { headers: { 'content-type': 'text/html' } })),
    );
    const { navigate } = await import('../src/runtime/navigate.ts');
    await navigate({ url: '/bound', push: true, leave: async () => {}, enter: () => {} });
    expect(document.querySelector('script[b-offset="5"]')).not.toBeNull();
    for (const script of document.querySelectorAll('script[b-state]')) {
      run(script);
    }
    await startLoader();
    // A bound child writes the signal of its parent, whose scope moved by 5.
    click(document.querySelector('.child.bound')!);
    await waitFor(() => expect(text('.parent')).toBe('open'));
  }, 20_000);

  it('moves the binding of a rest prop that a child builds after navigation', async () => {
    document.body.innerHTML =
      '<script b-state b-scopes b-next="5" b-route="root">$bR(($R,$b)=>({}))</script>';
    const server = await import(file('bindLateParent.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    const page = `<!doctype html><html><body>${html}${state.replace('<script ', '<script b-route="root" ')}</body></html>`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(page, { headers: { 'content-type': 'text/html' } })),
    );
    const { navigate } = await import('../src/runtime/navigate.ts');
    await navigate({ url: '/bound', push: true, leave: async () => {}, enter: () => {} });
    expect(document.querySelector('script[b-offset="5"]')).not.toBeNull();
    for (const script of document.querySelectorAll('script[b-state]')) {
      run(script);
    }
    await startLoader();
    // The binding in the state moved by 5 too, so the child that the click builds writes the parent.
    click(document.querySelector('.show')!);
    await waitFor(() => expect(document.querySelector('.child.later')).not.toBeNull());
    click(document.querySelector('.child.later')!);
    await waitFor(() => expect(text('.parent')).toBe('open'));
  }, 20_000);

  it('moves the binding and the setter of a rest prop after navigation', async () => {
    document.body.innerHTML =
      '<script b-state b-scopes b-next="5" b-route="root">$bR(($R,$b)=>({}))</script>';
    const server = await import(file('bindLateSetter.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    const page = `<!doctype html><html><body>${html}${state.replace('<script ', '<script b-route="root" ')}</body></html>`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(page, { headers: { 'content-type': 'text/html' } })),
    );
    const { navigate } = await import('../src/runtime/navigate.ts');
    await navigate({ url: '/bound', push: true, leave: async () => {}, enter: () => {} });
    expect(document.querySelector('script[b-offset="5"]')).not.toBeNull();
    for (const script of document.querySelectorAll('script[b-state]')) {
      run(script);
    }
    await startLoader();
    // The binding in the state moved by 5 too, so the child that the click builds writes the parent.
    click(document.querySelector('.show')!);
    await waitFor(() => expect(document.querySelector('.child.later')).not.toBeNull());
    click(document.querySelector('.child.later')!);
    await waitFor(() => expect(text('.parent')).toBe('open'));
  }, 20_000);

  it('keeps working after a hot update renders the page again', async () => {
    await resume('compact', { initial });
    renameAt(0);
    await waitFor(() => expect(rowLabels()).toEqual(['One!', 'Two', 'Three']));
    const { plan } = compile(readFileSync(join(input, 'compact.brm'), 'utf8'), {
      filename: 'compact.brm',
    });
    const names = Object.fromEntries(
      [...plan.scopes.values()].map((layout) => [
        layout.scope.id,
        layout.slots.map((slot) => slot.name),
      ]),
    );
    const core = await import('../src/runtime/client.ts');
    core.remount([{ id: plan.id, before: names, after: names, signals: ['rows'] }]);
    core.leavePage();
    const server = await import(file('compact.brm.ts'));
    const { html, state } = await renderParts(server.default, { initial });
    show(html + state);
    core.init({ load: (name: string) => import(modules.get(name)!), listen: () => {} } as never);
    await waitFor(() => expect(rowLabels()).toEqual(['One!', 'Two', 'Three']));
    renameAt(2);
    await waitFor(() => expect(rowLabels()).toEqual(['One!', 'Two', 'Three!']));
    click(document.querySelector('.reverse')!);
    await waitFor(() => expect(rowLabels()).toEqual(['Three!', 'Two', 'One!']));
  });
});

/**
 * For each list of the component of `name.brm`, by the code of its list:
 * `taken` when the server left the items out of the state, so the client
 * takes them from the list, and `written` when it wrote them.
 */
async function lists(
  name: string,
  props: unknown,
  state?: PageState,
  sources?: Map<number | string, readonly [number | string, number]>,
): Promise<Record<string, string>> {
  const { plan } = compile(readFileSync(join(input, `${name}.brm`), 'utf8'), {
    filename: `${name}.brm`,
  });
  const codes = new Map<number, string>();
  for (const scope of plan.bodyScopes.values()) {
    if (scope.block?.kind === 'for' && scope.block.body === scope.body) {
      codes.set(scope.id, scope.block.list.code.trim());
    }
  }
  const { Context, packState } = await import('../src/runtime/server.ts');
  const { OWNER, SOURCE } = await import('../src/runtime/shared.ts');
  if (!state) {
    const ctx = new Context();
    await (await import(file(`${name}.brm.ts`))).default(props, ctx);
    state = Object.fromEntries(ctx.state);
    sources = ctx.sources;
  }
  const component = (id: number): string | undefined => {
    for (let record = state![id]; record; record = state![record.p ?? record.o ?? -1]) {
      if (record.m !== undefined) {
        return record.m;
      }
    }
    return undefined;
  };
  const result: Record<string, string> = {};
  for (const [k, base, flags] of (packState(state, sources).g ?? []) as number[][]) {
    if (flags! & OWNER || component(base!) !== plan.id || !codes.has(k!)) {
      continue;
    }
    const kind = flags! & SOURCE ? 'taken' : 'written';
    const code = codes.get(k!)!;
    result[code] = result[code] === undefined || result[code] === kind ? kind : 'mixed';
  }
  return result;
}

/** Moves, adds, removes and changes items of every list of `sourced.brm`. */
async function change(): Promise<void> {
  expect(texts('.todos .toggle')).toEqual(['One', 'Two', 'Three', 'Four']);
  // A block script in the item body reads the item.
  click(document.querySelectorAll('.todos .toggle')[1]!);
  await waitFor(() => expect(texts('.finished li')).toEqual(['One', 'Two', 'Three']));
  expect(texts('.open li')).toEqual(['Four']);
  click(document.querySelector('.reverse')!);
  await waitFor(() => expect(texts('.todos .toggle')).toEqual(['Four', 'Three', 'Two', 'One']));
  click(document.querySelectorAll('.todos .toggle')[0]!);
  await waitFor(() => expect(texts('.finished li')).toEqual(['Four', 'Three', 'Two', 'One']));
  expect(document.querySelector('.todos li')!.classList.contains('done')).toBe(true);
  click(document.querySelector('.add')!);
  await waitFor(() => expect(texts('.todos .toggle')).toHaveLength(5));
  click(document.querySelector('.drop')!);
  await waitFor(() => expect(texts('.todos .toggle')).toEqual(['Three', 'Two', 'One', 'New 5']));
  click(document.querySelectorAll('.todos .toggle')[2]!);
  await waitFor(() => expect(texts('.open li')).toEqual(['One']));
  expect(texts('.todos .label')).toEqual(['3L1', '3L2', '2L1', '2L2', '1L1', '1L2', '5L1', '5L2']);
  click(document.querySelector('.relabel')!);
  await waitFor(() => expect(texts('.todos .label').slice(0, 3)).toEqual(['3L2', '3L1', '3L3']));
  click(document.querySelector('.pick')!);
  await waitFor(() => expect(texts('.picked li')).toEqual(['a', 'b', 'c']));
  expect(texts('.prop')).toEqual(['x', 'y']);
  click(document.querySelector('.rename')!);
  await waitFor(() => expect(texts('.prop')).toEqual(['z', 'y', 'x']));
  expect(texts('.names li')).toHaveLength(3);
  click(document.querySelector('.regroup')!);
  await waitFor(() => expect(texts('.groups b')).toEqual(['c3', 'c4', 'c1', 'c2']));
}

describe('list items taken from their list', () => {
  const initial = [
    { id: '1', title: 'One', done: true },
    { id: '2', title: 'Two', done: false },
    { id: '3', title: 'Three', done: true },
    { id: '4', title: 'Four', done: false },
  ];

  it('leaves out the items of lists of signals, memos, props and Sets, and only those', async () => {
    expect(await lists('sourced', { initial })).toEqual({
      // A signal, a signal in a list item, a memo, a Set, and a list whose item no slot holds.
      todos: 'taken',
      labels: 'taken',
      finished: 'taken',
      picked: 'taken',
      names: 'taken',
      groups: 'taken',
      // Computed lists and lists in an item keep their items.
      'todos.filter((todo) => !todo.done)': 'written',
      'group.children': 'written',
    });
    expect(await lists('SourcedList', { items: ['x', 'y'] })).toEqual({ items: 'taken' });
  });

  it('writes the items when the list does not hold them at their position', async () => {
    const { Context } = await import('../src/runtime/server.ts');
    const ctx = new Context();
    await (await import(file('sourced.brm.ts'))).default({ initial }, ctx);
    const state = structuredClone(Object.fromEntries(ctx.state));
    const todos = state[0]!.s![0] as unknown[];
    // The record of the list is not in this state, as for a `#loading` body that streams later.
    const { 0: root, ...rest } = state;
    expect(
      (await lists('sourced', {}, { ...rest, 0: { k: 1, m: root!.m } }, ctx.sources)).todos,
    ).toBe('written');
    // The slot holds a promise.
    expect(
      (
        await lists(
          'sourced',
          {},
          { ...state, 0: { ...root, s: [Promise.resolve(todos)] } },
          ctx.sources,
        )
      ).todos,
    ).toBe('written');
    // An item is another value than the one at its position.
    expect(
      (
        await lists(
          'sourced',
          {},
          { ...state, 0: { ...root, s: [todos.toReversed()] } },
          ctx.sources,
        )
      ).todos,
    ).toBe('written');
    // A copy from `structuredClone` keeps the items of the list the same objects.
    expect((await lists('sourced', {}, state, ctx.sources)).todos).toBe('taken');
  });

  it('reads every field of every scope back', async () => {
    const expected = await serverRecords('sourced', { initial });
    await resume('sourced', { initial });
    const client = await import('../src/runtime/client.ts');
    document.dispatchEvent(new Event('brumate:core'));
    await waitFor(() => expect(client.scopeOf(0)).toBeDefined());
    expect(await clientRecords(Object.keys(expected))).toEqual(expected);
  });

  it('reads them back after navigation moves the IDs', async () => {
    const expected = await serverRecords('sourced', { initial });
    const server = await import(file('sourced.brm.ts'));
    const { html, state } = await renderParts(server.default, { initial });
    show(html + moved(state));
    vi.resetModules();
    const client = await import('../src/runtime/client.ts');
    await (
      await import('../src/runtime/client-routes.ts')
    ).ready;
    client.init({
      load: async (id) => ({ id, props: {}, g: {}, load: async () => ({}) }),
      listen: () => {},
    });
    expect(client.scopeOf(1)).toBeUndefined();
    expect(await clientRecords(Object.keys(expected), 5)).toEqual(expected);
    client.dispose();
  });

  it('moves, adds, removes and changes items after it resumes', async () => {
    await resume('sourced', { initial });
    expect(document.querySelector('.todos li')!.hasAttribute('b-b')).toBe(true);
    await change();
  }, 20_000);

  it('does the same after navigation moves the IDs of the page', async () => {
    document.body.innerHTML =
      '<script b-state b-scopes b-next="5" b-route="root">$bR(($R,$b)=>({}))</script>';
    const server = await import(file('sourced.brm.ts'));
    const { html, state } = await renderParts(server.default, { initial });
    const page = `<!doctype html><html><body>${html}${state.replace('<script ', '<script b-route="root" ')}</body></html>`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(page, { headers: { 'content-type': 'text/html' } })),
    );
    const { navigate } = await import('../src/runtime/navigate.ts');
    await navigate({ url: '/sourced', push: true, leave: async () => {}, enter: () => {} });
    expect(document.querySelector('script[b-offset="5"]')).not.toBeNull();
    for (const script of document.querySelectorAll('script[b-state]')) {
      run(script);
    }
    await startLoader();
    await change();
  }, 20_000);

  it('keeps working after a hot update renders the page again', async () => {
    await resume('sourced', { initial });
    click(document.querySelector('.reverse')!);
    await waitFor(() => expect(texts('.todos .toggle')).toEqual(['Four', 'Three', 'Two', 'One']));
    const { plan } = compile(readFileSync(join(input, 'sourced.brm'), 'utf8'), {
      filename: 'sourced.brm',
    });
    const names = Object.fromEntries(
      [...plan.scopes.values()].map((layout) => [
        layout.scope.id,
        layout.slots.map((slot) => slot.name),
      ]),
    );
    const core = await import('../src/runtime/client.ts');
    core.remount([{ id: plan.id, before: names, after: names, signals: ['todos'] }]);
    core.leavePage();
    const server = await import(file('sourced.brm.ts'));
    const { html, state } = await renderParts(server.default, { initial });
    show(html + state);
    core.init({ load: (name: string) => import(modules.get(name)!), listen: () => {} } as never);
    await waitFor(() => expect(texts('.todos .toggle')).toEqual(['Four', 'Three', 'Two', 'One']));
    click(document.querySelectorAll('.todos .toggle')[0]!);
    await waitFor(() => expect(texts('.finished li')).toEqual(['Four', 'Three', 'One']));
    click(document.querySelector('.reverse')!);
    await waitFor(() => expect(texts('.todos .toggle')).toEqual(['One', 'Two', 'Three', 'Four']));
  });

  it('takes items in a #loading body that streams later from that body only', async () => {
    vi.resetModules();
    const fresh = await import(`${file('sourcedLoading.brm.ts')}?taken`);
    const { Context } = await import('../src/runtime/server.ts');
    // The records of the server, the page's and the body's.
    const ctx = new Context();
    const bodies: Promise<{ ctx: InstanceType<typeof Context> }>[] = [];
    ctx.watch((boundary) => bodies.push(boundary.render));
    await fresh.default({}, ctx);
    const { html, state, pending } = await renderParts(fresh.default, {});
    show(html + state);
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });
    expect(text('.fallback')).toBe('Loading');
    fresh.release('Ada');
    const [body] = await Promise.all(bodies);
    for await (const chunk of pending) {
      // The list of the body is in the body's record. The page's list is in the page's record.
      expect(chunk).toMatch(/b-scopes/);
      appendChunk(chunk);
    }
    const { packState } = await import('../src/runtime/server.ts');
    const { SOURCE } = await import('../src/runtime/shared.ts');
    const flags = (packState(body!.ctx.state, body!.ctx.sources).g ?? []).map(
      (group) => (group[2] as number) & SOURCE,
    );
    // One group takes its items, from the body's signal. The other writes them.
    expect(flags.toSorted()).toEqual([0, SOURCE]);
    const expected = {
      ...toRecords(Object.fromEntries(ctx.state)),
      ...toRecords(Object.fromEntries(body!.ctx.state)),
    };
    const client = await import('../src/runtime/client.ts');
    document.dispatchEvent(new Event('brumate:core'));
    await waitFor(() => expect(client.scopeOf(0)).toBeDefined());
    expect(await clientRecords(Object.keys(expected))).toEqual(expected);

    expect(texts('.word')).toEqual(['Ada', 'later']);
    click(document.querySelector('.word')!);
    await waitFor(() => expect(texts('.word')).toEqual(['later', 'Ada']));
    click(document.querySelector('.reverse')!);
    await waitFor(() => expect(texts('.todo')).toEqual(['Two', 'One']));
  });
});

/** A stub of `fetch` with the arguments that the runtime passes. */
type Fetch = (url: string, init?: RequestInit) => Promise<Response | undefined>;

/** Answers server function calls with `rpc`, and other requests with a page that names its URL. */
async function serve(name: string): Promise<{ fetch: Mock<Fetch> }> {
  vi.resetModules();
  const server = await import(file(`${name}.brm.ts`));
  const runtime = await import('../src/runtime/server.ts');
  const fetch = vi.fn<Fetch>(async (url, init) =>
    url.startsWith('/_brumate/')
      ? runtime.handleRequest(server.rpc, new Request(`http://localhost${url}`, init))
      : new Response(
          `<!doctype html><html><head><title>Next</title></head><body><p class="page">${new URL(url, location.href).pathname}</p></body></html>`,
          { headers: { 'content-type': 'text/html' } },
        ),
  );
  vi.stubGlobal('fetch', fetch);
  const { html, state } = await runtime.render(
    server.default,
    {},
    { request: new Request('http://localhost/') },
  );
  show(html + state);
  vi.resetModules();
  const { start } = await import('../src/runtime/loader.ts');
  stop = start({ load: (id) => import(modules.get(id)!) });
  return { fetch };
}

describe('redirects from server functions', () => {
  it('navigates on the client after a server function call redirects', async () => {
    history.replaceState(null, '', '/');
    const assign = vi.spyOn(location, 'assign').mockImplementation(() => {});
    const { fetch } = await serve('session');
    const length = history.length;
    click(document.querySelector('.admin')!);
    await waitFor(() => expect(text('.page')).toBe('/admin'));
    expect(location.pathname).toBe('/admin');
    // A new entry, as for a form post that redirects.
    expect(history.length).toBe(length + 1);
    expect(fetch.mock.lastCall![0]).toBe(`${location.origin}/admin`);
    expect(fetch.mock.lastCall![1]?.method).toBeUndefined();
    expect(assign).not.toHaveBeenCalled();
    // Another site loads in full.
    const other = new CustomEvent('brumate:redirect', {
      detail: 'https://example.com/',
      cancelable: true,
    });
    expect(document.dispatchEvent(other)).toBe(true);
    assign.mockRestore();
  });

  it('navigates on the client after the form of an $action redirects', async () => {
    history.replaceState(null, '', '/');
    const assign = vi.spyOn(location, 'assign').mockImplementation(() => {});
    await serve('redirecting');
    const form = document.querySelector<HTMLFormElement>('.go')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => expect(text('.page')).toBe('/done'));
    expect(location.pathname).toBe('/done');
    expect(document.title).toBe('Next');
    expect(assign).not.toHaveBeenCalled();
    assign.mockRestore();
  });
});

/** A `<main>` with one route in the children slot of the layout with scope 0. */
function region(route: string, root: number, html: string): string {
  return `<main><!--R0:children:${root}:${encodeURIComponent(route)}-->${html}<!--/R--></main>`;
}

describe('navigation after a write', () => {
  it('does not compute the memos of the new routes again', async () => {
    history.replaceState(null, '', '/');
    vi.resetModules();
    const counter = await import(file('counter.brm.ts'));
    const search = await import(file('search.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    const first = await runtime.render(counter.default, {}, { base: 1, route: 'root' });
    const next = Number(/b-next="(\d+)"/.exec(first.state)![1]);
    const second = await runtime.render(search.default, {}, { base: next, route: 'root' });
    const later: string[] = [];
    for await (const chunk of second.pending) {
      later.push(chunk);
    }
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn<Fetch>(async (url, init) => {
        if (url.startsWith('/_brumate/')) {
          calls.push(url);
          return runtime.handleRequest(search.rpc, new Request(`http://localhost${url}`, init));
        }
        return new Response(
          `<!doctype html><html><head></head><body><a class="link" href="/b">B</a>${region('/b', next, second.html)}${second.state}</body></html>${later.join('')}`,
          { headers: { 'content-type': 'text/html' } },
        );
      }),
    );
    show(`<a class="link" href="/b">B</a>${region('/', 1, first.html)}${first.state}`);
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (id) => import(modules.get(id)!) });

    click(document.querySelector('button')!);
    await waitFor(() => expect(text('p')).toBe('1 / 2'));
    // The link keeps the layout, and replaces only the route.
    document.querySelector<HTMLAnchorElement>('.link')!.click();
    await waitFor(() => expect(items()).toEqual(['apple', 'apricot', 'banana']));
    // The test DOM does not run the state records that navigation added.
    document.querySelectorAll('script[b-roots]').forEach(run);
    await new Promise((done) => setTimeout(done, 100));
    expect(location.pathname).toBe('/b');
    expect(calls).toEqual([]);
    // Its memos still load when their inputs change.
    const field = document.querySelector('input')!;
    field.value = 'b';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => expect(items()).toEqual(['banana']));
    expect(calls).toHaveLength(1);
  });
});

describe('unmount', () => {
  it('removes the scopes of a mount, so a refresh later does not load its memos', async () => {
    vi.resetModules();
    const server = await import(file('refreshList.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push(decodeURIComponent(url).split('#')[1]!);
      return runtime.handleRequest(server.rpc, new Request(`http://localhost${url}`, init));
    });
    const { createMount } = await import('../src/runtime/testing.ts');
    const mount = createMount({ load: (id) => import(modules.get(id)!) });
    const first = await mount(server.default, {});
    first.click('.add');
    await first.waitFor(() => expect(first.text('.names')).toContain('Grace'));
    first.unmount();
    calls.length = 0;
    const second = await mount(server.default, {});
    second.click('.add');
    await second.waitFor(() => expect(calls).toEqual(['add', 'list']));
    await new Promise((done) => setTimeout(done, 100));
    // Only the memo of the mount in the page loads again.
    expect(calls).toEqual(['add', 'list']);
    second.unmount();
  });
});

/** What the effects of `offscreen.brm` logged. */
function offscreenLog(): string[] {
  return ((globalThis as { offscreenLog?: string[] }).offscreenLog ??= []);
}

function offscreenElement(selector: string): HTMLElement {
  return document.querySelector<HTMLElement>(selector)!;
}

/** True for an element that `#offscreen` hides with an inline `display: none !important`. */
function isOffscreenHidden(selector: string): boolean {
  const style = offscreenElement(selector).style;
  return (
    style.getPropertyValue('display') === 'none' &&
    style.getPropertyPriority('display') === 'important'
  );
}

function pressKey(name: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: name }));
}

function pause(): Promise<void> {
  return new Promise((done) => setTimeout(done, 50));
}

describe('#offscreen', () => {
  afterEach(() => {
    offscreenLog().length = 0;
  });

  it('keeps a hidden body with its state, and renders a body that was hidden at first when it shows', async () => {
    await resume('offscreen', {});
    // The body that is hidden at first is not rendered.
    expect(document.querySelector('.panel-b')).toBeNull();
    await waitFor(() => expect(offscreenLog()).toContain('a client'));

    const draft = offscreenElement('.draft') as HTMLInputElement;
    draft.value = 'hello';
    draft.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => expect(text('.draft-text')).toBe('hello'));
    pressKey('x');
    await waitFor(() => expect(offscreenLog()).toContain('a key'));
    click(offscreenElement('.bump'));
    await waitFor(() =>
      expect(offscreenLog()).toEqual(expect.arrayContaining(['a effect 1', 'child 1'])),
    );

    offscreenLog().length = 0;
    click(offscreenElement('.tab-b'));
    await waitFor(() => expect(text('.panel-b')).toBe('B 1'));
    // The elements stay in the page, hidden with an inline style that a class does not override.
    expect(isOffscreenHidden('.panel-a')).toBe(true);
    expect(getComputedStyle(offscreenElement('.panel-a')).display).toBe('none');
    expect(isOffscreenHidden('.inline')).toBe(true);
    expect(isOffscreenHidden('.portal-a')).toBe(true);
    expect(isOffscreenHidden('.child')).toBe(true);
    // Text at the top level is emptied.
    expect(text('main')).not.toContain('Count');
    // Effects and `$client` callbacks stop.
    expect(offscreenLog()).toEqual(
      expect.arrayContaining(['a cleanup', 'a client cleanup', 'removable cleanup']),
    );

    offscreenLog().length = 0;
    click(offscreenElement('.bump'));
    click(offscreenElement('.bump'));
    click(offscreenElement('.restyle'));
    await waitFor(() => expect(text('.panel-b')).toBe('B 3'));
    // The hidden markup updates, but its effects do not run.
    expect(text('.inner')).toBe('Inner 3');
    expect(text('.portal-a')).toBe('Portal 3');
    expect(text('.child')).toBe('Child 3');
    expect(text('.late')).toBe('Late 3');
    expect(isOffscreenHidden('.late')).toBe(true);
    expect(isOffscreenHidden('.styled')).toBe(true);
    expect(text('main')).not.toContain('Count');
    pressKey('x');
    await pause();
    expect(offscreenLog()).toEqual([]);

    click(offscreenElement('.tab-a'));
    await waitFor(() =>
      expect(offscreenLog()).toEqual(
        expect.arrayContaining(['a effect 3', 'a client', 'child 3', 'removable effect 3']),
      ),
    );
    expect(isOffscreenHidden('.panel-b')).toBe(true);
    for (const selector of ['.panel-a', '.portal-a', '.child', '.late']) {
      expect(offscreenElement(selector).getAttribute('style')).toBeNull();
    }
    // Inline styles come back as they were, or as they changed while hidden.
    expect(offscreenElement('.inline').style.display).toBe('grid');
    expect(offscreenElement('.styled').style.display).toBe('block');
    expect(offscreenElement('.styled').style.color).toBe('blue');
    expect(text('main')).toContain('Count 3');
    // The same field, with what the user typed.
    expect(offscreenElement('.draft')).toBe(draft);
    expect(draft.value).toBe('hello');
    expect(text('.draft-text')).toBe('hello');

    offscreenLog().length = 0;
    pressKey('x');
    await waitFor(() => expect(offscreenLog()).toEqual(['a key']));
  });

  it('hides a nested body while any body around it is hidden', async () => {
    await resume('offscreen', {});
    click(offscreenElement('.toggle-inner'));
    await waitFor(() => expect(isOffscreenHidden('.inner')).toBe(true));
    click(offscreenElement('.tab-b'));
    await waitFor(() => expect(isOffscreenHidden('.panel-a')).toBe(true));
    click(offscreenElement('.toggle-inner'));
    await waitFor(() => expect(isOffscreenHidden('.inner')).toBe(false));
    expect(isOffscreenHidden('.panel-a')).toBe(true);
    click(offscreenElement('.toggle-inner'));
    await waitFor(() => expect(isOffscreenHidden('.inner')).toBe(true));
    click(offscreenElement('.tab-a'));
    await waitFor(() => expect(isOffscreenHidden('.panel-a')).toBe(false));
    expect(isOffscreenHidden('.inner')).toBe(true);
    click(offscreenElement('.toggle-inner'));
    await waitFor(() => expect(isOffscreenHidden('.inner')).toBe(false));
  });

  it('removes the scopes of a body whose block is removed, shown or hidden', async () => {
    await resume('offscreen', {});
    click(offscreenElement('.bump'));
    await waitFor(() => expect(offscreenLog()).toContain('removable effect 1'));
    click(offscreenElement('.remove'));
    await waitFor(() => expect(document.querySelector('.removable')).toBeNull());
    expect(offscreenLog()).toContain('removable cleanup');

    click(offscreenElement('.remove'));
    await waitFor(() => expect(document.querySelector('.removable')).not.toBeNull());
    click(offscreenElement('.tab-b'));
    await waitFor(() => expect(isOffscreenHidden('.removable')).toBe(true));
    click(offscreenElement('.remove'));
    await waitFor(() => expect(document.querySelector('.removable')).toBeNull());
    offscreenLog().length = 0;
    click(offscreenElement('.tab-a'));
    click(offscreenElement('.bump'));
    await waitFor(() => expect(offscreenLog()).toContain('a effect 2'));
    await pause();
    expect(offscreenLog().filter((entry) => entry.startsWith('removable'))).toEqual([]);
  });

  it('renders a body that is hidden at first on the client, the first time it shows', async () => {
    await resume('offscreen', { first: 'b' });
    expect(document.querySelector('.panel-a')).toBeNull();
    expect(document.querySelector('.portal-a')).toBeNull();
    expect(text('.panel-b')).toBe('B 0');
    pressKey('x');
    await pause();
    expect(offscreenLog()).toEqual([]);

    click(offscreenElement('.bump'));
    click(offscreenElement('.tab-a'));
    await waitFor(() => expect(text('.panel-a .inner')).toBe('Inner 1'));
    expect(text('main')).toContain('Count 1');
    expect(text('.portal-a')).toBe('Portal 1');
    expect(isOffscreenHidden('.panel-b')).toBe(true);
    // A body that renders runs its `$client` callbacks, and its effects wait for a change.
    await waitFor(() => expect(offscreenLog()).toContain('a client'));
    expect(offscreenLog().filter((entry) => entry.startsWith('a effect'))).toEqual([]);

    click(offscreenElement('.tab-b'));
    await waitFor(() => expect(isOffscreenHidden('.panel-a')).toBe(true));
    expect(isOffscreenHidden('.portal-a')).toBe(true);
    expect(text('main')).not.toContain('Count');
    click(offscreenElement('.tab-a'));
    await waitFor(() => expect(isOffscreenHidden('.panel-a')).toBe(false));
    expect(text('main')).toContain('Count 1');
  });

  it('works after navigation moves the IDs of the page', async () => {
    document.body.innerHTML =
      '<script b-state b-scopes b-next="5" b-route="root">$bR(($R,$b)=>({}))</script>';
    const server = await import(file('offscreen.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    const page = `<!doctype html><html><body>${html}${state.replace('<script ', '<script b-route="root" ')}</body></html>`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(page, { headers: { 'content-type': 'text/html' } })),
    );
    const { navigate } = await import('../src/runtime/navigate.ts');
    await navigate({ url: '/offscreen', push: true, leave: async () => {}, enter: () => {} });
    // The markers of the blocks moved by 5, and keep what the body is.
    expect(document.querySelector('main')!.innerHTML).toContain('<!--b5:6:1-->');
    for (const script of document.querySelectorAll('script[b-state]')) {
      run(script);
    }
    await startLoader();
    click(offscreenElement('.tab-b'));
    await waitFor(() => expect(text('.panel-b')).toBe('B 0'));
    expect(isOffscreenHidden('.panel-a')).toBe(true);
    click(offscreenElement('.bump'));
    click(offscreenElement('.tab-a'));
    await waitFor(() => expect(isOffscreenHidden('.panel-a')).toBe(false));
    expect(text('.inner')).toBe('Inner 1');
    await waitFor(() =>
      expect(offscreenLog()).toEqual(expect.arrayContaining(['a effect 1', 'child 1'])),
    );
  });
});

describe('a dynamic tag that names a component', () => {
  it('updates its live props', async () => {
    await resume('componentTagLiveProps', {});
    expect(text('em.tag')).toBe('a');
    click(document.querySelector('.set')!);
    await waitFor(() => expect(text('em.tag')).toBe('b'));
  });

  it('updates the live props of a component that spreads its rest', async () => {
    await resume('restTagLiveProps', {});
    const link = () => document.querySelector('a')!;
    expect(link().getAttribute('title')).toBe('true');
    expect(link().classList.contains('on')).toBe(true);
    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(link().getAttribute('title')).toBe('false'));
    expect(link().classList.contains('on')).toBe(false);
    expect(link().classList.contains('base')).toBe(true);
    expect(link().getAttribute('href')).toBe('/x');
  });

  it('keeps the handler of the tag through a live prop', async () => {
    await resume('restTagHandler', {});
    const link = () => document.querySelector('a.h')!;
    click(link());
    await waitFor(() => expect(text('.n')).toBe('1'));
    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(link().getAttribute('title')).toBe('false'));
    click(link());
    await waitFor(() => expect(text('.n')).toBe('2'));
    // The own anchor of the element stays out of the attributes that a spread wrote.
    expect(link().getAttribute('b-s')).not.toContain('b-b');
  });

  it('keeps the handler of the tag through a live prop, in a block', async () => {
    await resume('restTagHandlerLate', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelector('a.h')).not.toBeNull());
    const link = () => document.querySelector('a.h')!;
    click(link());
    await waitFor(() => expect(text('.n')).toBe('1'));
    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(link().getAttribute('title')).toBe('false'));
    click(link());
    await waitFor(() => expect(text('.n')).toBe('2'));
  });

  it('runs three handlers of one event of a component tag, in order', async () => {
    const order: string[] = [];
    (globalThis as { order?: string[] }).order = order;
    await resume('restTagMerged', {});
    const link = () => document.querySelector('a.h')!;
    click(link());
    await waitFor(() => expect(order).toEqual(['a', 'b', 'c']));
    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(link().getAttribute('title')).toBe('false'));
    click(link());
    await waitFor(() => expect(order).toEqual(['a', 'b', 'c', 'a', 'b', 'c']));
  });

  it('runs three handlers of one event of a component tag, in a block', async () => {
    const order: string[] = [];
    (globalThis as { order?: string[] }).order = order;
    await resume('restTagMergedLate', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelector('a.h')).not.toBeNull());
    const link = () => document.querySelector('a.h')!;
    click(link());
    await waitFor(() => expect(order).toEqual(['a', 'b', 'c']));
    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(link().getAttribute('title')).toBe('false'));
    click(link());
    await waitFor(() => expect(order).toEqual(['a', 'b', 'c', 'a', 'b', 'c']));
  });

  it('merges the handlers of a rest prop with those of a tag it passes them to', async () => {
    const order: string[] = [];
    (globalThis as { order?: string[] }).order = order;
    await resume('restTagMergedNested', {});
    click(document.querySelector('a.h')!);
    await waitFor(() => expect(order).toEqual(['a', 'b', 'c']));
    click(document.querySelector('a.h')!);
    await waitFor(() => expect(order).toEqual(['a', 'b', 'c', 'a', 'b', 'c']));
  });

  it('merges the handlers of a rest prop with those of a tag, in a block', async () => {
    const order: string[] = [];
    (globalThis as { order?: string[] }).order = order;
    await resume('restTagMergedNestedLate', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelector('a.h')).not.toBeNull());
    click(document.querySelector('a.h')!);
    await waitFor(() => expect(order).toEqual(['a', 'b', 'c']));
    click(document.querySelector('a.h')!);
    await waitFor(() => expect(order).toEqual(['a', 'b', 'c', 'a', 'b', 'c']));
  });

  it('runs every merged handler when the component calls its prop', async () => {
    const order: string[] = [];
    (globalThis as { order?: string[] }).order = order;
    await resume('restTagMergedCalls', {});
    const own = () => document.querySelector('.own')!;
    click(own());
    await waitFor(() => expect(order).toEqual(['a', 'b']));
    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(order).toEqual(['a', 'b']));
    click(own());
    await waitFor(() => expect(order).toEqual(['a', 'b', 'a', 'b']));
  });

  it('updates the live props of a component that spreads its rest, in a block', async () => {
    await resume('restTagLivePropsLate', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(document.querySelector('a')!.getAttribute('title')).toBe('true'));
    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(document.querySelector('a')!.getAttribute('title')).toBe('false'));
    expect(document.querySelector('a')!.classList.contains('on')).toBe(false);
  });

  it('gives the live props only to the components that declare them', () => {
    const props = analyzeProject(
      new Map([
        [
          'Page.brm',
          `<script>
  import { $signal } from 'brumate/signals';
  import TagY from './TagY.brm';
  import Other from './Other.brm';
  let as = $signal<any>(TagY);
  let label = $signal('a');
  const choices = [TagY, Other];
</script>
<button onClick=(() => (label = 'b'))>Set</button>
<{as} label=(label) />
<Other label="static" size=(3) />`,
        ],
        [
          'TagY.brm',
          `<script>
  import { $props } from 'brumate/signals';
  const { label } = $props<{ label: string }>();
</script>
<em>{label}</em>`,
        ],
        [
          'Other.brm',
          `<script>
  import { $props } from 'brumate/signals';
  const { size } = $props<{ size: number }>();
</script>
<i>{size}</i>`,
        ],
      ]),
      (specifier) => `${specifier.slice(2)}`,
    );
    expect([...props.get('TagY.brm')!]).toEqual(['label']);
    expect([...(props.get('Other.brm') ?? [])]).toEqual([]);
  });

  it('updates its live props in a block that the browser opens', async () => {
    await resume('componentTagLivePropsLate', {});
    click(document.querySelector('.open')!);
    await waitFor(() => expect(text('em.tag')).toBe('a'));
    click(document.querySelector('.set')!);
    await waitFor(() => expect(text('em.tag')).toBe('b'));
  });
});

describe('a component that a page gives to a part in as', () => {
  for (const name of ['gapPropsElement', 'gapPropsComponent']) {
    it(`updates a prop that a part sends to its target: ${name}`, async () => {
      await resume(name, {});
      const item = () => document.querySelector('.item')!;
      expect(item().getAttribute('aria-selected')).toBe('false');
      click(item());
      await waitFor(() => expect(item().getAttribute('aria-selected')).toBe('true'));
    });
  }
});

describe('a template that names a component only in an attribute value', () => {
  /** The source of the client parts that hold the markup of the templates of a page. */
  function templateParts(name: string): string {
    return readdirSync(output)
      .filter((file) => file.startsWith(`${name}.brm.client.t`))
      .map((file) => readFileSync(join(output, file), 'utf8'))
      .join('\n');
  }

  it('gapTemplate: renders a component in `as=`', async () => {
    await resume('gapTemplate', {});
    click(document.querySelector('.tpl-add')!);
    await waitFor(() => expect(document.querySelector('.gap-row')).not.toBeNull());
    expect(document.querySelector('.gap-row')!.hasAttribute('data-target')).toBe(true);
  });

  it('gapTemplate: renders a component in another prop', async () => {
    await resume('gapTemplateProp', {});
    click(document.querySelector('.tpl-add')!);
    await waitFor(() => expect(document.querySelector('.host')).not.toBeNull());
    expect(document.querySelector('.host')!.hasAttribute('data-target')).toBe(true);
  });

  it('gapTemplate: renders the components of an expression', async () => {
    await resume('gapTemplateChoice', {});
    click(document.querySelector('.tpl-add')!);
    await waitFor(() => expect(document.querySelector('.gap-row')).not.toBeNull());
    expect(document.querySelector('.gap-row')!.hasAttribute('data-target')).toBe(true);
  });

  it('gapTemplate: leaves an import that the template does not use out of the part', async () => {
    await resume('gapTemplateUnused', {});
    click(document.querySelector('.tpl-add')!);
    await waitFor(() => expect(document.querySelector('.gap-row')).not.toBeNull());
    const code = templateParts('gapTemplateUnused');
    expect(code).toContain('GapTarget');
    expect(code).not.toContain('AsLink');
  });
});
