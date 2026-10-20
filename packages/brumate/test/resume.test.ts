// @vitest-environment happy-dom
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyzeProject, compile } from '../src/index.ts';
import { renderToString, stateScript } from '../src/runtime/server.ts';

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
      continue;
    }
    const { server, client, parts, render, plan } = compile(sources.get(name)!, {
      filename: name,
      liveProps: liveProps.get(name),
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
    .replace(/\.brm\?brumate-client&part=(\w+)"/g, '.brm.client.$1.ts"');
}

/**
 * Appends streamed markup and runs its inline scripts, as a browser does.
 * The test DOM does not run scripts, so they run with a global eval.
 */
function appendChunk(html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  // A copy, because appending moves nodes out of the live list.
  for (const node of Array.from(template.content.childNodes)) {
    if (node.nodeName === 'SCRIPT' && !(node as Element).hasAttribute('type')) {
      // oxlint-disable-next-line no-eval -- The script is the swap code from the server.
      (0, eval)(node.textContent!);
    } else {
      document.body.append(node);
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
  const { html, state } = await renderToString(server.default, props);
  document.body.innerHTML = html + state;
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

function click(element: Element): void {
  element.dispatchEvent(new Event('click', { bubbles: true }));
}

describe('resume', () => {
  it('settles promises from state records that arrive later', async () => {
    const { streamState } = await import('../src/runtime/server.ts');
    let settle!: (value: number) => void;
    const pending = new Promise<number>((done) => {
      settle = done;
    });
    const records: string[] = [];
    const done = streamState({ 0: { k: 1, m: 'Test', s: [pending] } }, (record) => {
      records.push(stateScript(record, records.length === 0));
    });
    expect(records).toHaveLength(1);
    document.body.innerHTML = records[0]!;

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
    const holder = document.createElement('div');
    holder.innerHTML = records[1]!;
    document.body.append(holder.firstChild!);
    await expect(value).resolves.toBe(42);
    // The slot holds the value once it arrives.
    await waitFor(() => expect(client.get(client.scopeOf(0)!, 0)).toBe(42));
    client.dispose();
  });

  it('swaps in #loading bodies that stream after the page', async () => {
    const server = await import(file('loading.brm.ts'));
    const { html, state, pending } = await renderToString(server.default, {});
    document.body.innerHTML = html + state;
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
    const { html, state } = await runtime.renderToString(server.default, {}, { request });
    document.body.innerHTML = html + state;
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
    const { html, state } = await runtime.renderToString(server.default, {});
    document.body.innerHTML = html + state;
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
    const { html, state, pending } = await renderToString(fresh.default, {});
    document.body.innerHTML = html + state;
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
      return new Response(JSON.stringify({ t: { t: 2, s: 1 }, f: 127, m: [] }));
    });
    await resume('todos', {
      initial: [
        { id: '1', title: 'Write the docs', done: true, at: new Date('2026-10-01T00:00:00Z') },
        { id: '2', title: 'Build the compiler', done: false, at: new Date('2026-10-20T00:00:00Z') },
      ],
    });
    expect(text('p')).toBe('1 left');

    const field = document.querySelector('input')!;
    field.value = 'Ship it';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    document.querySelector('form')!.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);

    await waitFor(() => expect(document.querySelectorAll('li')).toHaveLength(3));
    expect(text('li:last-child')).toContain('Ship it');
    expect(text('p')).toBe('2 left');
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
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ t: { t: 2, s: 1 }, f: 127, m: [] })),
    );
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
