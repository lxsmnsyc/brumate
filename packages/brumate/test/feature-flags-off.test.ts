// @vitest-environment happy-dom
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyzeProject, compile } from '../src/index.ts';
import { getFeatures, joinFeatures } from '../src/features.ts';
import type { Features } from '../src/features.ts';
import { render } from '../src/runtime/server.ts';
import type * as Client from '../src/runtime/client.ts';

// The core of a build has no code for the paths that its components do not use. The other tests
// run the core with every flag on, so they cannot see a fact that misses. These run pages with
// the flags that a build of the page gets from its facts, and with a flag off where the page does
// not use the path.

const input = resolve(import.meta.dirname, 'render');
const output = resolve(import.meta.dirname, '.output/feature-flags-off');
const file = (name: string): string => pathToFileURL(join(output, name)).href;
const modules = new Map<string, string>();
const features = new Map<string, Features>();
const sources = new Map<string, string>();

/** The five flags of this node, by the name of the global that the plugin replaces. */
const FLAGS = {
  tries: '__BRUMATE_HAS_TRIES__',
  fields: '__BRUMATE_HAS_FIELDS__',
  windows: '__BRUMATE_HAS_WINDOWS__',
  dynamic: '__BRUMATE_HAS_DYNAMIC__',
  routes: '__BRUMATE_HAS_ROUTES__',
} as const;
type Flag = keyof typeof FLAGS;

const PAGES = ['counter', 'list', 'boom', 'bindSpread', 'windowed', 'asPage', 'where'];

/** The names of the components that a source imports, with the extension. */
function importsOf(name: string): string[] {
  return [...sources.get(name)!.matchAll(/from '\.\/([\w-]+\.brm)'/g)].map((match) => match[1]!);
}

/** A page and everything it imports. */
function closure(names: string[], seen = new Set<string>()): Set<string> {
  for (const name of names) {
    if (!seen.has(name)) {
      seen.add(name);
      closure(importsOf(name), seen);
    }
  }
  return seen;
}

beforeAll(() => {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  for (const name of readdirSync(input)) {
    if (name.endsWith('.brm')) {
      sources.set(name, readFileSync(join(input, name), 'utf8'));
    }
  }
  const liveProps = analyzeProject(sources);
  for (const name of readdirSync(input)) {
    if (!name.endsWith('.brm')) {
      copyFileSync(join(input, name), join(output, name));
    }
  }
  for (const name of closure(PAGES.map((page) => `${page}.brm`))) {
    const {
      server,
      client,
      parts,
      render: rendered,
      plan,
      ...result
    } = compile(sources.get(name)!, {
      filename: name,
      liveProps: liveProps.get(name),
      path: join(input, name),
    });
    const fix = (code: string): string =>
      code
        .replace(/\.brm\?brumate-render"/g, '.brm.render.ts"')
        .replace(/\.brm\?brumate-client&part=(\w+)"/g, '.brm.client.$1.ts"')
        .replace(/\.brm\?brumate-client"/g, '.brm.client.ts"')
        .replace(/\.brm\.ts\?brumate-shared"/g, '.brm.ts.shared.ts"');
    for (const [part, code] of Object.entries(parts)) {
      writeFileSync(join(output, `${name}.client.${part}.ts`), fix(code));
    }
    writeFileSync(join(output, `${name}.ts`), server.replace(/\.brm'/g, ".brm.ts'"));
    writeFileSync(join(output, `${name}.client.ts`), fix(client));
    writeFileSync(join(output, `${name}.render.ts`), fix(rendered));
    modules.set(plan.id, file(`${name}.client.ts`));
    features.set(name, getFeatures({ server, client, parts, render: rendered, plan, ...result }));
  }
}, 60_000);

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

/** The flags that a build of a page gets: its facts, joined over the page and its components. */
function flagsOf(page: string): Features {
  return joinFeatures([...closure([`${page}.brm`])].map((name) => features.get(name)!));
}

/** Writes the flags in as the plugin does, before the core loads, with some forced. */
function setFlags(page: string, forced: Partial<Record<Flag, boolean>> = {}): void {
  const joined = flagsOf(page);
  for (const [name, global] of Object.entries(FLAGS)) {
    vi.stubGlobal(global, forced[name as Flag] ?? joined[name as Flag]);
  }
}

/** Runs the inline state scripts of a page, as a browser does while it parses it. */
function show(html: string): void {
  document.body.innerHTML = html;
  for (const script of document.body.querySelectorAll('script[b-state]')) {
    Object.defineProperty(document, 'currentScript', { configurable: true, value: script });
    try {
      // oxlint-disable-next-line no-eval -- The script is a state record from the server.
      (0, eval)(script.textContent!);
    } finally {
      delete (document as { currentScript?: unknown }).currentScript;
    }
  }
}

/** Renders a page on the server, shows it, and starts the loader with the flags set before. */
async function open(page: string, props: unknown = {}, options: object = {}): Promise<void> {
  const server = await import(file(`${page}.brm.ts`));
  const { html, state } = await render(server.default, props, options);
  show(html + state);
}

/** Starts the loader on the shown page, with a fresh core that reads the flags. */
async function start(): Promise<void> {
  vi.resetModules();
  const { start: boot } = await import('../src/runtime/loader.ts');
  stop = boot({ load: async (id) => import(modules.get(id)!) });
}

const text = (selector: string): string => document.querySelector(selector)!.textContent!;
const click = (selector: string): void => {
  document.querySelector(selector)!.dispatchEvent(new Event('click', { bubbles: true }));
};
const settle = (): Promise<void> => new Promise((done) => setTimeout(done, 80));

describe('the facts of the pages', () => {
  it('turn on the flag of the path that a page uses', () => {
    expect(flagsOf('counter')).toMatchObject({
      tries: false,
      fields: false,
      windows: false,
      dynamic: false,
      routes: false,
    });
    expect(flagsOf('boom').tries).toBe(true);
    // The input gets its binding through a spread of a child, so only the parent's call shows it.
    expect(flagsOf('bindSpread').fields).toBe(true);
    expect(flagsOf('windowed').windows).toBe(true);
    expect(flagsOf('asPage').dynamic).toBe(true);
    expect(flagsOf('where').routes).toBe(true);
  });
});

describe('a page with every flag off', () => {
  it('resumes and handles an event', async () => {
    setFlags('counter', {
      tries: false,
      fields: false,
      windows: false,
      dynamic: false,
      routes: false,
    });
    await open('counter');
    await start();
    expect(text('p')).toBe('0 / 0');
    click('button');
    await vi.waitFor(() => expect(text('p')).toBe('1 / 2'));
  });
});

describe('#try', () => {
  it('catches the error of a handler with the flag of its facts', async () => {
    setFlags('boom');
    await open('boom');
    await start();
    click('.throw');
    await vi.waitFor(() => expect(text('.caught')).toBe('Error: Clicked'));
    click('.reset');
    await vi.waitFor(() => expect(text('.count')).toBe('0'));
  });

  it('reports the error to the page when the flag is off, which is why the fact must hold', async () => {
    setFlags('boom', { tries: false });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const seen: unknown[] = [];
    window.addEventListener('brumate:error', (event) => seen.push((event as CustomEvent).detail));
    await open('boom');
    await start();
    click('.throw');
    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(document.querySelector('.caught')).toBeNull();
    errors.mockRestore();
  });
});

describe('fields typed before the code loads', () => {
  async function typed(forced: Partial<Record<Flag, boolean>>): Promise<void> {
    setFlags('bindSpread', forced);
    await open('bindSpread');
    document.querySelector<HTMLInputElement>('.field.text')!.value = 'hi';
    await start();
  }

  it('are read with the flag of the facts, for a binding that reaches an input through a spread', async () => {
    await typed({});
    await vi.waitFor(() => expect(text('.out')).toBe('hi|false'));
  });

  it('are left alone when the flag is off, which is why the fact must hold', async () => {
    await typed({ fields: false });
    await settle();
    expect(text('.out')).toBe('|false');
  });

  it('still bind on input with the flag off', async () => {
    await typed({ fields: false });
    const field = document.querySelector<HTMLInputElement>('.field.text')!;
    field.value = 'later';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(text('.out')).toBe('later|false'));
  });
});

describe('windowed lists', () => {
  it('resume with the flag of the facts', async () => {
    setFlags('windowed');
    await open('windowed');
    await start();
    await settle();
    expect(document.querySelector('[data-window=after]')).not.toBeNull();
    expect(document.querySelectorAll('.row').length).toBeGreaterThan(0);
    click('.pick-1');
    await vi.waitFor(() => expect(text('.picked')).toBe('1'));
  });

  it('are not needed by a list that is not windowed, with the flag off', async () => {
    setFlags('list', { windows: false });
    expect(flagsOf('list').windows).toBe(false);
    await open('list');
    await start();
    expect(document.querySelectorAll('li')).toHaveLength(2);
    click('.add');
    await vi.waitFor(() => expect(document.querySelectorAll('li')).toHaveLength(3));
  });
});

describe('dynamic tags', () => {
  it('pass handlers to an element and to a component, with the flag of the facts', async () => {
    setFlags('asPage');
    await open('asPage');
    await start();
    click('.plain');
    await vi.waitFor(() => expect(text('.outer')).toBe('1'));
    await vi.waitFor(() => expect(text('.plain-box .own')).toBe('1'));
    document
      .querySelector('.link')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(text('.outer')).toBe('2'));
  });
});

describe('routes', () => {
  async function where(forced: Partial<Record<Flag, boolean>>): Promise<typeof Client> {
    setFlags('where', forced);
    await open(
      'where',
      {},
      {
        request: new Request('http://localhost:3000/issues/7?q=bug'),
        params: { id: '7' },
        route: 'r',
      },
    );
    await start();
    const client = await import('../src/runtime/client.ts');
    client.loader.init({ load: (id) => import(modules.get(id)!), listen: () => {} });
    stop = () => client.loader.dispose();
    return client;
  }

  it('read the route and the navigation, and change them, with the flag of the facts', async () => {
    const client = await where({});
    client.setGlobal('brumate.navigation', {
      pending: true,
      from: 'http://localhost:3000/issues/7?q=bug',
      to: 'http://localhost:3000/issues/8',
    });
    await vi.waitFor(() => expect(text('.pending')).toBe('to /issues/8'));
    history.pushState({}, '', '/issues/8?q=open');
    client.updateRoute();
    await vi.waitFor(() => expect(text('.where')).toBe('/issues/8 open 7'));
    history.replaceState({}, '', '/');
  });

  it('leave the loader calls as no-ops when the flag is off', async () => {
    setFlags('counter', { routes: false });
    await open('counter');
    await start();
    const { loader } = await import('../src/runtime/client.ts');
    expect(() => {
      loader.setGlobal('brumate.navigation', { pending: false });
      loader.updateRoute();
    }).not.toThrow();
  });
});
