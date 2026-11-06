// @vitest-environment happy-dom
// The gates of the context-stores spike: a store per provider, built far enough to resume.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest';
import { analyzeProject, compile } from '../../src/index.ts';
import { render as renderParts } from '../../src/runtime/server.ts';
import type { Scope } from '../../src/runtime/client/state.ts';
import type { Store } from '../../src/runtime/store.ts';

const input = resolve(import.meta.dirname, 'render');
const output = resolve(import.meta.dirname, '../.output/stores');
const file = (name: string): string => pathToFileURL(join(output, name)).href;
const modules = new Map<string, string>();

/** Points imports of render modules and client parts at the files that the tests write. */
function toRender(code: string): string {
  return code
    .replace(/\.brm\?brumate-render"/g, '.brm.render.ts"')
    .replace(/\.brm\?brumate-client&part=(\w+)"/g, '.brm.client.$1.ts"')
    .replace(/\.brm\?brumate-client"/g, '.brm.client.ts"');
}

beforeAll(() => {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const sources = new Map(
    readdirSync(input)
      .filter((name) => name.endsWith('.brm'))
      .map((name) => [name, readFileSync(join(input, name), 'utf8')]),
  );
  const liveProps = analyzeProject(sources);
  for (const name of readdirSync(input)) {
    if (!name.endsWith('.brm')) {
      copyFileSync(join(input, name), join(output, name));
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

afterEach(() => {
  stop?.();
  document.body.innerHTML = '';
  delete (globalThis as { savedTheme?: string }).savedTheme;
  delete (globalThis as { savedForeign?: string }).savedForeign;
  (globalThis as { runs?: string[] }).runs = [];
});

/** Runs an inline script, as a browser does, with the script as `document.currentScript`. */
function run(script: Element): void {
  Object.defineProperty(document, 'currentScript', { configurable: true, value: script });
  try {
    // oxlint-disable-next-line no-eval -- The script is a state record from the server.
    (0, eval)(script.textContent!);
  } finally {
    delete (document as { currentScript?: unknown }).currentScript;
  }
}

function show(html: string): void {
  document.body.innerHTML = html;
  document.body.querySelectorAll('script[b-state]').forEach(run);
}

/** Appends streamed markup and runs its inline scripts in order, as a browser does. */
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

async function startLoader(): Promise<void> {
  vi.resetModules();
  const { start } = await import('../../src/runtime/loader.ts');
  stop = start({ load: async (id) => import(modules.get(id)!) });
}

/** Renders a component on the server, shows it and starts the loader. */
async function resume(name: string, before?: () => void): Promise<void> {
  const server = await import(file(`${name}.brm.ts`));
  const { html, state } = await renderParts(server.default, {});
  before?.();
  show(html + state);
  await startLoader();
}

function text(selector: string): string {
  return document.querySelector(selector)!.textContent!;
}

function click(element: Element): void {
  element.dispatchEvent(new Event('click', { bubbles: true }));
}

function waitFor(assertion: () => void): Promise<void> {
  return vi.waitFor(assertion, { timeout: 2000 });
}

function runs(): string[] {
  return ((globalThis as { runs?: string[] }).runs ??= []);
}

function runsOf(name: string): string[] {
  return runs().filter((entry) => entry.startsWith(`${name} `));
}

function clearRuns(): void {
  runs().length = 0;
}

/** The scopes of the core that the loader started, by component ID prefix. */
async function scopesOf(prefix: string): Promise<Scope[]> {
  const client = await import('../../src/runtime/client.ts');
  return [...client.scopes.values()].filter((scope) => scope.m?.startsWith(prefix));
}

describe('resume gates', () => {
  it('sends a handler field beside a store as a function reference', async () => {
    await resume('storeField');
    expect(text('.bump')).toBe('0');
    const html = document.body.innerHTML;
    // The handler is a reference to the provider's export, and the store sends only its value.
    expect(html).toMatch(/\$b\.f\("StoreField_\w+#h\d+"/);
    expect(html).toMatch(/\$b\.s\(/);
    click(document.querySelector('.bump')!);
    await waitFor(() => expect(text('.bump')).toBe('1'));
    expect(text('.count')).toBe('1');
    click(document.querySelector('.bump')!);
    await waitFor(() => expect(text('.bump')).toBe('2'));
  });

  it('keeps one store across a streamed #loading chunk, and a late reader reads the value after a set', async () => {
    const server = await import(file('storeLoading.brm.ts'));
    server.reset();
    const { html, state, pending } = await renderParts(server.default, {});
    show(html + state);
    await startLoader();
    expect(text('.read-outer')).toBe('a');
    // A write before the chunk arrives: the server renders the chunk with the old value.
    click(document.querySelector('.next')!);
    await waitFor(() => expect(text('.read-outer')).toBe('a!'));
    server.release('Ada');
    for await (const chunk of pending) {
      appendChunk(chunk);
    }
    await waitFor(() => expect(text('.data')).toBe('Ada'));
    // The reader in the chunk resumed with the server's value, and reads the current one.
    await waitFor(() => expect(text('.read-inner')).toBe('a!'));
    // Both readers and the provider hold one store.
    const [provider] = await scopesOf('StoreLoading_');
    const readers = await scopesOf('StoreLoadingReader_');
    expect(readers).toHaveLength(2);
    const provided = provider!.v!['store-picker'] as Store<string>;
    for (const reader of readers) {
      expect(reader.s[0]).toBe(provided);
    }
    expect(Object.values(provider!.st!)).toEqual([provided]);
    // A later write reaches both.
    click(document.querySelector('.next')!);
    await waitFor(() => expect(text('.read-inner')).toBe('a!!'));
    expect(text('.read-outer')).toBe('a!!');
  });

  it('writes the signal of a provider through the set of its store', async () => {
    await resume('storePicker');
    expect(text('.chosen')).toBe('a');
    expect(document.querySelector('.option-a')!.getAttribute('aria-pressed')).toBe('true');
    click(document.querySelector('.option-b')!);
    await waitFor(() => expect(text('.chosen')).toBe('b'));
    await waitFor(() =>
      expect(document.querySelector('.option-b')!.getAttribute('aria-pressed')).toBe('true'),
    );
    expect(document.querySelector('.option-a')!.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('diamond gates', () => {
  it('gives a leaf the store of a memo and the prop of a middle child in one pass', async () => {
    await resume('storeDiamond');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    onTestFinished(() => errors.mockRestore());
    clearRuns();
    click(document.querySelector('.grow')!);
    await waitFor(() => expect(text('.pick')).toBe('c'));
    expect(runsOf('pick')).toEqual(['pick 3 2']);
    click(document.querySelector('.grow')!);
    await waitFor(() => expect(text('.pick')).toBe('d'));
    expect(errors).not.toHaveBeenCalled();
  });

  it('gives children inserted into a provider the new store value with the new prop', async () => {
    await resume('storeChildren');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    onTestFinished(() => errors.mockRestore());
    const steps: [string, string, string][] = [
      ['.grow', 'D', 'kidPick 4 3'],
      ['.grow', 'E', 'kidPick 5 4'],
      ['.cut', 'D', 'kidPick 4 3'],
      ['.cut', 'C', 'kidPick 3 2'],
    ];
    for (const [button, shown, ran] of steps) {
      clearRuns();
      click(document.querySelector(button)!);
      // oxlint-disable-next-line no-await-in-loop -- Each click waits for the one before.
      await waitFor(() => expect(text('.kid-pick')).toBe(shown));
      expect(runsOf('kidPick')).toEqual([ran]);
    }
    expect(errors).not.toHaveBeenCalled();
  });

  it('gives a leaf the store of a prop and its own prop in one pass', async () => {
    await resume('storeProp');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    onTestFinished(() => errors.mockRestore());
    clearRuns();
    click(document.querySelector('.grow')!);
    await waitFor(() => expect(text('.pick')).toBe('d'));
    expect(runsOf('pick')).toEqual(['pick 4 3']);
    expect(errors).not.toHaveBeenCalled();
  });

  it('writes a user store through the queued send, in the pass of the handler', async () => {
    await resume('storeUser');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    onTestFinished(() => errors.mockRestore());
    clearRuns();
    click(document.querySelector('.grow')!);
    await waitFor(() => expect(text('.pick')).toBe('c'));
    expect(runsOf('pick')).toEqual(['pick 3 2']);
    // A set outside a handler is a pass of its own.
    clearRuns();
    click(document.querySelector('.later')!);
    await waitFor(() => expect(text('.pick')).toBe('a'));
    expect(runsOf('pick')).toEqual(['pick 3 0']);
    expect(errors).not.toHaveBeenCalled();
  });
});

describe('server checks', () => {
  it('refuses a foreign store in a context, with the key of the context', async () => {
    const server = await import(file('storeForeign.brm.ts'));
    await expect(renderParts(server.default, {})).rejects.toThrow(
      'The context "store-level" holds a store that is not of brumate/store',
    );
  });

  it('treats only a value with get and subscribe as a store', async () => {
    // A context of handlers with a `subscribe` function is not a store.
    await resume('storeBus');
    click(document.querySelector('.publish')!);
    await waitFor(() => expect(text('.log')).toBe('x'));
  });

  it('refuses let on a store without set, when the variable registers', async () => {
    const memo = await import(file('storeLetNoSet.brm.ts'));
    await expect(renderParts(memo.default, {})).rejects.toThrow(TypeError);
    const readOnly = await import(file('storeReadOnly.brm.ts'));
    await expect(renderParts(readOnly.default, {})).rejects.toThrow(
      /writes the store, but the store has no set/,
    );
  });
});

describe('let writes through set', () => {
  it('writes the signal of a provider from a reader, and the readers update in one pass', async () => {
    await resume('storeLet');
    expect(text('.chosen')).toBe('a');
    expect(text('.label-a')).toBe('a');
    clearRuns();
    click(document.querySelector('.option-b')!);
    await waitFor(() => expect(text('.chosen')).toBe('b'));
    await waitFor(() => expect(text('.label-a')).toBe('b'));
    expect(text('.label-b')).toBe('b');
    // Each reader computed once.
    expect(runsOf('label-a')).toEqual(['label-a b']);
    expect(runsOf('label-b')).toEqual(['label-b b']);
  });
});

describe('a store that a file imports', () => {
  it('renders, resumes with a module store that changed, and updates', async () => {
    const server = await import(file('storeImport.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    expect(html).toContain('>light</p>');
    expect(html).toContain('>light</button>');
    (globalThis as { savedTheme?: string }).savedTheme = 'dark';
    (globalThis as { savedForeign?: string }).savedForeign = 'night';
    show(html + state);
    await startLoader();
    await waitFor(() => expect(text('.module')).toBe('dark'));
    await waitFor(() => expect(text('.foreign')).toBe('night'));
    const { theme, foreignTheme } = (await import(file('contexts.ts'))) as {
      theme: Store<string>;
      foreignTheme: { get(): string; set(value: string): void };
    };
    theme.set('blue');
    await waitFor(() => expect(text('.module')).toBe('blue'));
    foreignTheme.set('day');
    await waitFor(() => expect(text('.foreign')).toBe('day'));
    // `let` writes through the set of the foreign store.
    click(document.querySelector('.foreign')!);
    await waitFor(() => expect(text('.foreign')).toBe('day!'));
    expect(foreignTheme.get()).toBe('day!');
  });

  it('stops reading when the scope goes', async () => {
    await resume('storeToggle');
    const { theme } = (await import(file('contexts.ts'))) as { theme: Store<string> };
    await waitFor(() => expect(theme.l.size).toBe(1));
    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(document.querySelector('.module')).toBeNull());
    expect(theme.l.size).toBe(0);
    click(document.querySelector('.toggle')!);
    await waitFor(() => expect(theme.l.size).toBe(1));
    expect(text('.module')).toBe('light');
  });
});

describe('a store from any expression', () => {
  afterEach(() => {
    delete (globalThis as { savedShared?: string }).savedShared;
    delete (globalThis as { savedSpace?: string }).savedSpace;
    delete (globalThis as { spaceSets?: number }).spaceSets;
  });

  /** Starts the loader with `set` of every `Store` of the browser counted. */
  async function startCounted(): Promise<{ calls: () => number }> {
    vi.resetModules();
    const { Store: BrowserStore } = await import('../../src/runtime/store.ts');
    const set = vi.spyOn(BrowserStore.prototype, 'set');
    onTestFinished(() => set.mockRestore());
    const { start } = await import('../../src/runtime/loader.ts');
    stop = start({ load: async (id) => import(modules.get(id)!) });
    return { calls: () => set.mock.calls.length };
  }

  function texts(section: string): string[] {
    const result: string[] = [];
    for (const name of ['local', 'prop', 'maybe', 'call', 'module', 'space']) {
      result.push(text(`${section} .${name}`));
    }
    return result;
  }

  it('renders each source on the server: a local store, a prop, a default, a call, the module script and a namespace', async () => {
    const server = await import(file('storeAny.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    show(html);
    expect(texts('.first')).toEqual(['5 5', '1 1', '0', '20 20', 'm m', 'n n']);
    expect(texts('.held')).toEqual(['5 5', '1 1', '7', '30 30', 'm m', 'n n']);
    // Each reader names its sources in `z`.
    expect(state).toContain('z:[[0,3],[1,4,void 0,1],[2,5],[3,6,void 0,1],[4,7],[5,8],');
  });

  it('resumes each source without a set, and updates through const and let', async () => {
    const server = await import(file('storeAny.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    show(html + state);
    const { calls } = await startCounted();
    await waitFor(async () => expect(await scopesOf('StoreAnyReader_')).toHaveLength(2));
    // Eleven reads subscribe in each reader.
    await waitFor(async () => {
      const [first, held] = await scopesOf('StoreAnyReader_');
      expect(first!.stops?.length).toBe(11);
      expect(held!.stops?.length).toBe(11);
    });
    expect(texts('.first')).toEqual(['5 5', '1 1', '0', '20 20', 'm m', 'n n']);
    expect(calls()).toBe(0);
    expect((globalThis as { spaceSets?: number }).spaceSets).toBeUndefined();
    // A local store and a call result are made again in the browser, one per reader.
    click(document.querySelector('.first .local-up')!);
    await waitFor(() => expect(text('.first .local')).toBe('5 6'));
    expect(text('.held .local')).toBe('5 5');
    click(document.querySelector('.held .call-up')!);
    await waitFor(() => expect(text('.held .call')).toBe('30 31'));
    // The store of a prop is the parent's: a write of the parent and of a reader reach all.
    click(document.querySelector('.bump')!);
    await waitFor(() => expect(text('.first .prop')).toBe('2 2'));
    expect(text('.held .prop')).toBe('2 2');
    click(document.querySelector('.held .prop-up')!);
    await waitFor(() => expect(text('.first .prop')).toBe('12 12'));
    // The store of the module script and of the namespace is one for the page.
    click(document.querySelector('.first .module-up')!);
    await waitFor(() => expect(text('.held .module')).toBe('m! m!'));
    click(document.querySelector('.held .space-up')!);
    await waitFor(() => expect(text('.first .space')).toBe('n+ n+'));
    expect((globalThis as { spaceSets?: number }).spaceSets).toBe(1);
    expect(text('.held .maybe')).toBe('7');
  });

  it('repairs a slot once when the browser store starts from another value', async () => {
    const server = await import(file('storeAny.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    expect(html).toContain('>m m</p>');
    (globalThis as { savedShared?: string }).savedShared = 'b';
    (globalThis as { savedSpace?: string }).savedSpace = 'w';
    show(html + state);
    clearRuns();
    const { calls } = await startCounted();
    await waitFor(() => expect(text('.first .module')).toBe('b b'));
    await waitFor(() => expect(text('.held .space')).toBe('w w'));
    expect(text('.held .module')).toBe('b b');
    // Each reader wrote its text once, for both of its reads.
    expect(runsOf('module')).toEqual(['module b b', 'module b b']);
    expect(calls()).toBe(0);
    expect((globalThis as { spaceSets?: number }).spaceSets).toBeUndefined();
  });

  it('reads each source in a browser render', async () => {
    await resume('storeAny');
    click(document.querySelector('.bump')!);
    await waitFor(() => expect(text('.first .prop')).toBe('2 2'));
    click(document.querySelector('.later')!);
    await waitFor(() => expect(document.querySelector('.second .local')).not.toBeNull());
    expect(texts('.second')).toEqual(['5 5', '2 2', '7', '40 40', 'm m', 'n n']);
    click(document.querySelector('.second .local-up')!);
    await waitFor(() => expect(text('.second .local')).toBe('5 6'));
    click(document.querySelector('.second .call-up')!);
    await waitFor(() => expect(text('.second .call')).toBe('40 41'));
    click(document.querySelector('.second .prop-up')!);
    await waitFor(() => expect(text('.first .prop')).toBe('12 12'));
    expect(text('.second .prop')).toBe('12 12');
    click(document.querySelector('.second .module-up')!);
    await waitFor(() => expect(text('.second .module')).toBe('m! m!'));
    click(document.querySelector('.second .space-up')!);
    await waitFor(() => expect(text('.held .space')).toBe('n+ n+'));
  });

  // Fails until node module-script-shared: the render module of a component copies its
  // `<script module>`, so a reader that the browser renders has a store apart from the resumed ones.
  it.fails('shares the store of <script module> between resumed and browser-rendered readers (module-script-shared)', async () => {
    await resume('storeAny');
    click(document.querySelector('.later')!);
    await waitFor(() => expect(document.querySelector('.second .module')).not.toBeNull());
    click(document.querySelector('.second .module-up')!);
    await waitFor(() => expect(text('.first .module')).toBe('m! m!'));
  });

  it('refuses a store of another library in a prop or a script value, naming $store and the value', async () => {
    const prop = await import(file('storeForeignProp.brm.ts'));
    await expect(renderParts(prop.default, {})).rejects.toThrow(
      /^\$store in StoreForeignPropReader_\w+ reads a store of another library from the prop "s", which the page sends, and only a store of brumate\/store crosses\. Wrap the library's store with bridge\(\) in a module, or read it from an import, <script module> or a call in this component$/,
    );
    const value = await import(file('storeForeignValue.brm.ts'));
    await expect(renderParts(value.default, {})).rejects.toThrow(
      /^\$store in StoreForeignValue_\w+ reads a store of another library from the value "held"/,
    );
    // A prop that no `$store` reads keeps the error of the page state.
    const raw = await import(file('storeForeignRaw.brm.ts'));
    await expect(renderParts(raw.default, {})).rejects.toThrow(/cannot be sent to the browser/);
    // A call in the reader makes the store there, so it works.
    const made = await import(file('storeForeignCall.brm.ts'));
    const { html } = await renderParts(made.default, {});
    expect(html).toContain('>3</p>');
  });

  it('throws a TypeError naming $store for a source that gives no store at run time', async () => {
    const none = await import(file('storeLetNone.brm.ts'));
    await expect(renderParts(none.default, {})).rejects.toThrow(TypeError);
    await expect(renderParts(none.default, {})).rejects.toThrow(
      '$store reads a value, which gives no store: a store has the functions get and subscribe',
    );
    // A context that the compiler cannot see as one names the read that gives its store.
    const context = await import(file('storeContextAtRun.brm.ts'));
    await expect(renderParts(context.default, {})).rejects.toThrow(TypeError);
    await expect(renderParts(context.default, {})).rejects.toThrow(
      '$store reads the context "store-level", which is no store. Read the store in it with $store($getContext(Context))',
    );
  });
});

describe('a foreign store with only get and subscribe', () => {
  it('renders, repairs a changed value on resume, and updates, read with const', async () => {
    const server = await import(file('storeReadOnlyRead.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    expect(html).toContain('>1</p>');
    (globalThis as { savedReadOnly?: number }).savedReadOnly = 5;
    show(html + state);
    await startLoader();
    await waitFor(() => expect(text('.read-only')).toBe('5'));
    const { readOnly } = (await import(file('contexts.ts'))) as {
      readOnly: { emit(value: number): void };
    };
    readOnly.emit(8);
    await waitFor(() => expect(text('.read-only')).toBe('8'));
    delete (globalThis as { savedReadOnly?: number }).savedReadOnly;
  });
});

describe('a read of a resumed scope with no provider', () => {
  it('throws an error that names the key', async () => {
    await resume('storeField');
    await waitFor(async () => expect(await scopesOf('StoreFieldReader_')).toHaveLength(1));
    const [reader] = await scopesOf('StoreFieldReader_');
    const { resumeStoreReads } = await import('../../src/runtime/client/context.ts');
    expect(() => resumeStoreReads([reader!], () => [['store-none', 1, 'state']])).toThrow(
      'The context "store-none" has no provider above this component',
    );
  });
});

describe('the Store class', () => {
  it('calls the listeners for a changed value only', async () => {
    const { store } = await import('../../src/runtime/store.ts');
    const made = store(1);
    const seen: number[] = [];
    const stop = made.subscribe((value) => seen.push(value));
    made.set(1);
    made.set(2);
    made.set(2);
    stop();
    made.set(3);
    expect(seen).toEqual([2]);
    expect(made.get()).toBe(3);
  });

  it('warns in development for a store whose scope is missing', async () => {
    const { linkMadeStores } = await import('../../src/runtime/client/context.ts');
    const { madeStores } = await import('../../src/runtime/shared.ts');
    const { store } = await import('../../src/runtime/store.ts');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const made = store(1);
    made.o = [987654, 0];
    madeStores.push(made as Store<unknown>);
    linkMadeStores();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('987654'));
  });
});

describe('a context value is read once', () => {
  const head =
    "import { $props, $setContext, $signal, $toStore, $untrack } from 'brumate/signals';\nimport { Ctx } from './ctx.ts';\n";
  function build(script: string, markup = '<button onClick=(() => n++)>Up</button>'): string {
    const source = `<script>\n${head}let n = $signal(0);\n${script}\n</script>\n${markup}`;
    return compile(source, { filename: 'Test.brm' }).server;
  }

  it('reports a signal, a memo and a prop that change, with BRM196', () => {
    expect(() => build('$setContext(Ctx, { n });')).toThrow(/BRM196/);
    expect(() => build('$setContext(Ctx, n + 1);')).toThrow(/BRM196/);
    expect(() =>
      build('const { value } = $props<{ value: number }>();\n$setContext(Ctx, { value });'),
    ).toThrow(/BRM196/);
  });

  it('allows a read in a function, $untrack, $toStore and a value that never changes', () => {
    expect(() => build('$setContext(Ctx, { get: () => n });')).not.toThrow();
    expect(() => build('function get() { return n; }\n$setContext(Ctx, { get });')).not.toThrow();
    expect(() => build('$setContext(Ctx, $untrack(n));')).not.toThrow();
    expect(() => build('$setContext(Ctx, { state: $toStore(n) });')).not.toThrow();
    expect(() => build('$setContext(Ctx, { n });', '<p>{n}</p>')).not.toThrow();
  });

  it('reports a $bind value, $route() and $store() read in the value', () => {
    const bound = `<script>\nimport { $bind, $setContext, $signal } from 'brumate/signals';\nimport Child from './Child.brm';\nimport { Ctx } from './ctx.ts';\nlet n = $signal(0);\n$setContext(Ctx, { n });\n</script>\n<Child value=$bind(n) />`;
    expect(() => compile(bound, { filename: 'Test.brm' })).toThrow(/BRM196/);
    const route = `<script>\nimport { $route, $setContext } from 'brumate/signals';\nimport { Ctx } from './ctx.ts';\nconst route = $route();\n$setContext(Ctx, { path: route.url.pathname });\n</script>\n<p></p>`;
    expect(() => compile(route, { filename: 'Test.brm' })).toThrow(/BRM196/);
    const read = `<script>\nimport { $setContext, $store } from 'brumate/signals';\nimport { Ctx, Other } from './ctx.ts';\nconst other = $store(Other);\n$setContext(Ctx, { other });\n</script>\n<p></p>`;
    expect(() => compile(read, { filename: 'Test.brm' })).toThrow(/BRM196/);
  });

  it('does not report a call or an immediately invoked function that reads a changing name', () => {
    expect(() =>
      build('function compute() { return n; }\n$setContext(Ctx, compute());'),
    ).not.toThrow();
    expect(() => build('$setContext(Ctx, (() => n)());')).not.toThrow();
  });

  it('gives the error a code and a range for brumate check and the editor', () => {
    let thrown: unknown;
    try {
      build('$setContext(Ctx, { n });');
    } catch (error) {
      thrown = error;
    }
    const diagnostics = (thrown as { diagnostics?: { message: string }[] }).diagnostics;
    expect(diagnostics?.[0]?.message).toContain('"n"');
    expect((thrown as Error).message).toContain('[BRM196]');
  });

  it('never calls updateContext', () => {
    const code = compile(
      `<script>\n${head}let n = $signal(0);\n$setContext(Ctx, { get: () => n });\n</script>\n<button onClick=(() => n++)>Up</button>`,
      { filename: 'Test.brm' },
    );
    expect(code.client).not.toContain('updateContext');
    for (const part of Object.values(code.parts)) {
      expect(part).not.toContain('updateContext');
    }
  });
});

describe('compile checks', () => {
  const head =
    "import { $getContext, $memo, $props, $setContext, $signal, $store, $toStore, $untrack } from 'brumate/signals';\n";
  function build(script: string, markup = '<p></p>'): ReturnType<typeof compile> {
    return compile(`<script>\n${head}${script}\n</script>\n${markup}`, { filename: 'Test.brm' });
  }

  it('reports the forms that $store refuses, with their codes', () => {
    expect(() => build('var a = $store(x);')).toThrow(/BRM191/);
    expect(() => build("import { s } from './s.ts';\nconst { a } = $store(s);")).toThrow(/BRM195/);
    expect(() => build("import { s } from './s.ts';\nconst a = $store(s, s);")).toThrow(/BRM192/);
    expect(() => build('function f() {\n  const a = $store(1);\n}')).toThrow(/BRM191/);
  });

  it('reports a source that awaits or calls a server function, with BRM198', () => {
    expect(() => build("import { load } from './s.ts';\nconst a = $store(await load());")).toThrow(
      /BRM198/,
    );
    expect(() =>
      build("async function load() {\n  'use server';\n  return 1;\n}\nconst a = $store(load());"),
    ).toThrow(/BRM198/);
  });

  it('accepts any other expression as a source, and exports it as a function of the scope', () => {
    const output = build(
      [
        "import { store } from 'brumate/store';",
        "import * as ns from './s.ts';",
        'const { s, given } = $props<{ s: any; given?: { state: any } }>();',
        'const local = store(0);',
        'const box = { inner: store(1) };',
        'function make() {',
        '  return store(2);',
        '}',
        'const a = $store(store(0));',
        'let b = $store(s);',
        'const c = $store(given?.state ?? store(3));',
        'const d = $store(make());',
        'const e = $store(ns);',
        'const f = $store(local);',
        'const g = $store(box.inner);',
      ].join('\n'),
      '<p>{a}{b}{c}{d}{e}{f}{g}</p>',
    );
    expect(output.warnings).toEqual([]);
    const code = Object.values(output.parts).join('\n') + output.client;
    expect(code).toContain('export const z = [($$s) => (store(0)), ($$s) => ($$b.get($$s, ');
    expect(code).toContain('?.state ?? store(3))');
    expect(code).toContain('($$s) => (ns)');
    expect(code).toContain('($$s) => (make$($$s))');
  });

  it('reports $store used as an expression with BRM191', () => {
    expect(() =>
      build("import { s } from './s.ts';\nfunction f() {\n  return $store(s);\n}"),
    ).toThrow(/BRM191/);
  });

  it('reports $toStore with a wrong argument or in a wrong place', () => {
    expect(() =>
      build("import { C } from './c.ts';\nlet a = $signal(1);\n$setContext(C, $toStore(a, a));"),
    ).toThrow(/BRM193/);
    expect(() => build('let a = $signal(1);\nconst b = $toStore(a);')).toThrow(/BRM193/);
  });

  it('accepts the sources that resume can find', () => {
    const output = build(
      "import { s, C } from './s.ts';\nconst a = $store(s);\nlet b = $store($getContext(C));\nconst f = $getContext(C);\nconst c = $store(f.k);",
    );
    expect(output.warnings).toEqual([]);
  });
});

describe('$getContext with a fallback, and the guard on the value', () => {
  it('reads no store without a provider, on the server and in the browser', async () => {
    const server = await import(file('hasAlone.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    expect(html).toContain('<p class="found">no</p>');
    expect(html).toContain('>none</button>');
    // Nothing is recorded to link, so the resume finds no read.
    expect(state).not.toContain('z:[');
    show(html + state);
    await startLoader();
    expect(text('.found')).toBe('no');
    expect(text('.bump')).toBe('none');
    await waitFor(async () => expect(await scopesOf('HasFieldReader_')).toHaveLength(1));
    const [reader] = await scopesOf('HasFieldReader_');
    expect(reader!.s.some((value) => value instanceof Object && 'get' in value)).toBe(false);
    // The click handler reads the missing field with `?.`.
    click(document.querySelector('.bump')!);
    expect(text('.bump')).toBe('none');
  });

  it('binds with a provider rendered by the server, and a resume does not write the store', async () => {
    const server = await import(file('hasField.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    expect(html).toContain('<p class="found">yes</p>');
    expect(html).toContain('>0</button>');
    expect(state).toContain('z:[["store-field",1,"state"]]');
    show(html + state);
    await startLoader();
    await waitFor(async () => expect(await scopesOf('HasField_')).toHaveLength(1));
    const [provider] = await scopesOf('HasField_');
    const provided = provider!.v!['store-field'] as { state: Store<unknown> };
    const set = vi.spyOn(provided.state, 'set');
    expect(text('.found')).toBe('yes');
    expect(text('.bump')).toBe('0');
    expect(set).not.toHaveBeenCalled();
    click(document.querySelector('.bump')!);
    await waitFor(() => expect(text('.bump')).toBe('1'));
    expect(text('.count')).toBe('1');
  });

  it('agrees with a provider and a reader that a browser render makes', async () => {
    await resume('hasLater');
    click(document.querySelector('.provide')!);
    await waitFor(() => expect(text('.with .found')).toBe('yes'));
    expect(text('.with .bump')).toBe('5');
    click(document.querySelector('.with .bump')!);
    await waitFor(() => expect(text('.with .bump')).toBe('6'));
    click(document.querySelector('.alone')!);
    await waitFor(() => expect(text('.without .found')).toBe('no'));
    expect(text('.without .bump')).toBe('none');
  });

  it('agrees on both sides in a streamed #loading chunk', async () => {
    for (const [name, outer, inner] of [
      ['hasLoading', 'yes a', 'yes a'],
      ['hasLoadingNone', 'no', 'no'],
    ] as const) {
      document.body.innerHTML = '';
      const server = await import(file(`${name}.brm.ts`));
      server.reset();
      const { html, state, pending } = await renderParts(server.default, {});
      show(html + state);
      await startLoader();
      expect(text('.has-outer')).toBe(outer);
      server.release('Ada');
      for await (const chunk of pending) {
        appendChunk(chunk);
      }
      await waitFor(() => expect(text('.data')).toBe('Ada'));
      expect(text('.has-inner')).toBe(inner);
      expect(text('.has-outer')).toBe(outer);
      stop?.();
    }
  });

  it('gives $route and $navigation without a provider, and the fallback for another context', async () => {
    const { consumeContext } = await import('../../src/runtime/client/context.ts');
    const { routeContext, navigationContext } = await import('../../src/runtime/context.ts');
    const scope = { id: 1, s: [] } as unknown as Scope;
    expect(consumeContext(routeContext, scope, 'fallback')).not.toBe('fallback');
    expect(consumeContext(navigationContext, scope, 'fallback')).toEqual({ pending: false });
    expect(consumeContext({ key: 'nothing' }, scope, undefined)).toBeUndefined();
    expect(consumeContext({ key: 'nothing' }, scope, () => 'made')).toBe('made');
    expect(() => consumeContext({ key: 'nothing' }, scope)).toThrow(/has no provider/);
  });

  it('gives $route and $navigation on the server, and the fallback for another context', async () => {
    const { Context } = await import('../../src/runtime/server.ts');
    const { routeContext, navigationContext } = await import('../../src/runtime/context.ts');
    const ctx = new Context();
    const scope = ctx.scope(1, undefined, 'Test');
    expect(ctx.consume(routeContext, scope, 'fallback')).not.toBe('fallback');
    expect(ctx.consume(navigationContext, scope, 'fallback')).toEqual({ pending: false });
    expect(ctx.consume({ key: 'nothing' }, scope, undefined)).toBeUndefined();
    expect(ctx.consume({ key: 'nothing' }, scope, () => 'made')).toBe('made');
    expect(() => ctx.consume({ key: 'nothing' }, scope)).toThrow(/has no provider/);
  });

  it('reads a guarded key with a provider, on the server, on resume and in a browser render', async () => {
    const server = await import(file('hasOptional.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    expect(html).toContain('>0</button>');
    expect(state).toContain('z:[["store-field",1,"state"]]');
    show(html + state);
    await startLoader();
    click(document.querySelector('.now .bump')!);
    await waitFor(() => expect(text('.now .bump')).toBe('1'));
    click(document.querySelector('.later')!);
    await waitFor(() => expect(text('.then .bump')).toBe('1'));
    click(document.querySelector('.then .bump')!);
    await waitFor(() => expect(text('.now .bump')).toBe('2'));
    expect(text('.then .bump')).toBe('2');
  });

  it('is undefined without a provider and links nothing', async () => {
    const server = await import(file('hasOptionalAlone.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    expect(html).toContain('>none</button>');
    expect(state).not.toContain('z:[');
    show(html + state);
    await startLoader();
    click(document.querySelector('.later')!);
    await waitFor(() => expect(text('.then .bump')).toBe('none'));
    expect(text('.now .bump')).toBe('none');
  });
});

describe('a fallback runs only without a provider', () => {
  afterEach(() => {
    delete (globalThis as { madeStores?: unknown[] }).madeStores;
  });

  function made(): Store<string>[] {
    return ((globalThis as { madeStores?: Store<string>[] }).madeStores ??= []);
  }

  it('gives the provided values and never calls a fallback, on the server, on resume and in a browser render', async () => {
    const server = await import(file('fallback.brm.ts'));
    clearRuns();
    const { html, state } = await renderParts(server.default, {});
    show(html);
    expect(text('.now .label')).toBe('given');
    expect(text('.now .fixed')).toBe('given');
    expect(text('.now .value')).toBe('p');
    // The browser finds the provider's store again by its key.
    expect(state).toContain('"store-picker"');
    expect(runs()).toEqual([]);
    show(html + state);
    await startLoader();
    click(document.querySelector('.later')!);
    await waitFor(() => expect(text('.then .label')).toBe('given'));
    expect(text('.then .fixed')).toBe('given');
    expect(text('.then .value')).toBe('p');
    click(document.querySelector('.now .up')!);
    await waitFor(() => expect(text('.provided')).toBe('p!'));
    await waitFor(() => expect(text('.then .value')).toBe('p!'));
    expect(text('.now .value')).toBe('p!');
    expect(runs().filter((entry) => !entry.startsWith('module'))).toEqual([]);
    expect(made()).toEqual([]);
  });

  it('gives each fallback once per read without a provider, and a store for each reader and request', async () => {
    const server = await import(file('fallbackAlone.brm.ts'));
    clearRuns();
    const first = await renderParts(server.default, {});
    show(first.html);
    expect(text('.now .label')).toBe('none');
    expect(text('.now .fixed')).toBe('literal');
    expect(text('.now .value')).toBe('default');
    expect(runs()).toEqual(['fallback none', 'store default']);
    // A second request makes its own store.
    await renderParts(server.default, {});
    expect(made()).toHaveLength(2);
    expect(made()[0]).not.toBe(made()[1]);

    // The browser runs the store's fallback again on resume, and a browser render makes one more.
    clearRuns();
    show(first.html + first.state);
    await startLoader();
    await waitFor(() => expect(runsOf('store')).toEqual(['store default']));
    click(document.querySelector('.later')!);
    await waitFor(() => expect(text('.then .label')).toBe('none'));
    expect(text('.then .fixed')).toBe('literal');
    expect(runsOf('fallback')).toEqual(['fallback none']);
    expect(runsOf('store')).toEqual(['store default', 'store default']);
    click(document.querySelector('.now .up')!);
    await waitFor(() => expect(text('.now .value')).toBe('default!'));
    expect(text('.then .value')).toBe('default');
  });

  it('does not rewrite a reader on resume when the fallback store holds the data the server sent', async () => {
    const server = await import(file('objectFallback.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    clearRuns();
    show(html + state);
    await startLoader();
    // The browser makes the store again, an object equal to the one the server sent.
    await waitFor(() => expect(runsOf('shape')).toEqual(['shape x']));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(runsOf('effect')).toEqual([]);
    expect(text('.name')).toBe('x');
  });
});

describe('a provided store of an object', () => {
  it('does not rewrite its readers on resume, and still updates them', async () => {
    const server = await import(file('objectProvided.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    clearRuns();
    show(html + state);
    await startLoader();
    await waitFor(() => expect(text('.detail')).toBe('memo 1'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The browser made the store again: equal data, so the effects stay at their first run.
    expect(runsOf('shape')).toEqual([]);
    expect(runsOf('detail')).toEqual([]);
    click(document.querySelector('.inc')!);
    await waitFor(() => expect(text('.detail')).toBe('memo 2'));
    expect(runsOf('detail')).toEqual(['detail memo 2']);
    expect(runsOf('shape')).toEqual([]);
  });
});

/** The number of scopes that the core holds. */
async function scopeCount(): Promise<number> {
  const client = await import('../../src/runtime/client.ts');
  return client.scopes.size;
}

describe('an object memo that feeds $toStore', () => {
  // The scopes of a list of two items with a template: the page, the select and the list, and two scopes for each
  // item (its row and its template).
  const SCOPES = 7;

  it('resumes a page of the server with one write for a pick and no doubled scopes', async () => {
    const server = await import(file('viewServer.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    clearRuns();
    show(html + state);
    await startLoader();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(runsOf('view')).toEqual([]);
    click(document.querySelector('.pick')!);
    await waitFor(() => expect(text('.option:nth-child(2) .choice')).toBe('Dog (picked)'));
    expect(runsOf('view')).toEqual(['view Dog']);
    expect(text('.option:nth-child(1) .choice')).toBe('Cat');
    expect(document.querySelectorAll('.option')).toHaveLength(2);
    expect(await scopeCount()).toBe(SCOPES);
  });

  it('renders in the browser with no write at creation and no doubled scopes', async () => {
    await resume('viewBrowser');
    click(document.querySelector('.show')!);
    await waitFor(() => expect(document.querySelectorAll('.option')).toHaveLength(2));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The memo makes its object again at creation, which is not a change for the reader.
    expect(runsOf('view')).toEqual([]);
    expect(text('.option:nth-child(2) .choice')).toBe('Dog');
    expect(await scopeCount()).toBe(SCOPES);
    click(document.querySelector('.pick')!);
    await waitFor(() => expect(text('.option:nth-child(2) .choice')).toBe('Dog (picked)'));
    expect(runsOf('view')).toEqual(['view Dog']);
    expect(text('.option:nth-child(1) .choice')).toBe('Cat');
    expect(document.querySelectorAll('.option')).toHaveLength(2);
  });
});

describe('BRM197 and BRM199', () => {
  const head =
    "import { $getContext, $setContext, $store } from 'brumate/signals';\nimport { store } from 'brumate/store';\nimport { Ctx, Other } from './ctx.ts';\nimport { theme } from './theme.ts';\n";
  function build(script: string): ReturnType<typeof compile> {
    return compile(`<script>\n${head}${script}\n</script>\n<p></p>`, { filename: 'Test.brm' });
  }
  function messageOf(script: string): string {
    try {
      build(script);
    } catch (error) {
      return (error as Error).message;
    }
    return '';
  }

  it('accepts the optional read, the guard on the value and a store as the fallback', () => {
    for (const script of [
      'const g = $getContext(Ctx, undefined);',
      'const g = $getContext(Ctx, false);',
      'const g = $getContext(Ctx, { a: 1 });',
      'const g = $getContext(Ctx, undefined);\nconst y = g ? $store(g.state) : undefined;',
      'const g = $getContext(Ctx, undefined);\nconst y = g ? $store(g) : undefined;',
      'const x = $store($getContext(Ctx));',
      'let x = $store($getContext(Ctx, store(1)));',
      'const g = $getContext(Ctx);\nconst y = $store(g.state);',
    ]) {
      expect(() => build(script)).not.toThrow();
    }
  });

  it('compiles a literal fallback as it is and other code as a function', () => {
    const output = build(
      "const a = $getContext(Ctx, undefined);\nconst b = $getContext(Ctx, 'en');\nconst c = $getContext(Ctx, { a: 1 });\nconst d = $store($getContext(Ctx, store(1)));",
    );
    const code = output.server.replaceAll(/\$\$s\d+/g, 'scope');
    expect(code).toContain('consume(Ctx, scope, undefined)');
    expect(code).toContain("consume(Ctx, scope, 'en')");
    expect(code).toContain('consume(Ctx, scope, () => ({ a: 1 }))');
    expect(code).toMatch(
      /consumeStore\(Ctx, scope, -?\d+, undefined, 0, undefined, \(\) => \(store\(1\)\)\)/,
    );
  });

  it('reports $hasContext, a guard of another shape and a key of an optional value, with the form in the message', () => {
    const form =
      'Read a context that may have no provider with "const name = $getContext(Context, undefined)", and a store in it with "const state = name ? $store(name.key) : undefined"';
    for (const script of [
      'const has = $hasContext(Ctx);',
      'const g = $getContext(Ctx, undefined);\nlet y = g ? $store(g.state) : undefined;',
      'const g = $getContext(Ctx, undefined);\nconst y = g ? $store(g.state) : null;',
      'const g = $getContext(Ctx, undefined);\nconst y = $store(g.state);',
      'const g = $getContext(Ctx, undefined);\nconst y = $store(g?.state);',
      'const g = $getContext(Ctx);\nconst y = $store(g?.state);',
      'const g = $getContext(Ctx);\nconst y = g ? $store(g.state) : undefined;',
      'const g = $getContext(Ctx, undefined);\nconst h = $getContext(Other, undefined);\nconst y = h ? $store(g.state) : undefined;',
      'const g = $getContext(Ctx, { state: store(1) });\nconst y = g ? $store(g.state) : undefined;',
      'const y = theme ? $store(theme) : undefined;',
      'const g = $getContext(Ctx, undefined);\nconst y = g != null ? $store(g.state) : undefined;',
    ]) {
      const message = messageOf(script);
      expect(message).toContain('[BRM197]');
      expect(message).toContain(form);
    }
  });

  it('reports a source that is no store, with the fix in the message', () => {
    const fix =
      '$store takes a store. Read the store of a context with "$store($getContext(Context))"';
    for (const script of [
      'const x = $store(undefined);',
      'const x = $store(null);',
      'const g = $getContext(Ctx);\nconst x = $store(Ctx);',
      '$setContext(Ctx, 1);\nconst x = $store(Ctx);',
      'const x = $store($getContext(Ctx, undefined));',
      "const x = $store($getContext(Ctx, 'en'));",
    ]) {
      const message = messageOf(script);
      expect(message).toContain('[BRM199]');
      expect(message).toContain(fix);
    }
  });

  it('reports a $getContext with no context or more than two arguments', () => {
    expect(messageOf('const g = $getContext();')).toContain('[BRM080]');
    expect(messageOf('const g = $getContext(Ctx, 1, 2);')).toContain('[BRM080]');
    expect(messageOf('const x = $store($getContext(Ctx, 1, 2));')).toContain('[BRM080]');
  });
});
