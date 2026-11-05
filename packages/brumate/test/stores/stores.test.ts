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
    "import { $getContext, $memo, $setContext, $signal, $store, $toStore, $untrack } from 'brumate/signals';\n";
  function build(script: string): ReturnType<typeof compile> {
    return compile(`<script>\n${head}${script}\n</script>\n<p></p>`, { filename: 'Test.brm' });
  }

  it('reports the forms that $store refuses, with their codes', () => {
    expect(() => build('var a = $store(x);')).toThrow(/BRM191/);
    expect(() => build("import { s } from './s.ts';\nconst { a } = $store(s);")).toThrow(/BRM195/);
    expect(() => build("import { s } from './s.ts';\nconst a = $store(s, s);")).toThrow(/BRM192/);
    expect(() => build('function f() {\n  const a = $store(1);\n}')).toThrow(/BRM191/);
  });

  it('reports a source that the browser cannot find again', () => {
    expect(() => build('const box = { inner: 1 };\nconst a = $store(box.inner);')).toThrow(
      /BRM194/,
    );
    expect(() => build('const a = $store(make());\nfunction make() { return 1; }')).toThrow(
      /BRM194/,
    );
  });

  it('reports a script variable and a bare namespace import as sources', () => {
    expect(() => build('const s = { get() {}, subscribe() {} };\nconst a = $store(s);')).toThrow(
      /BRM194/,
    );
    expect(() => build("import * as ns from './s.ts';\nconst a = $store(ns);")).toThrow(/BRM194/);
    // A key of a namespace import is found again.
    expect(build("import * as ns from './s.ts';\nconst a = $store(ns.theme);").warnings).toEqual(
      [],
    );
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
      "import { s, C } from './s.ts';\nconst a = $store(s);\nlet b = $store(C);\nconst f = $getContext(C);\nconst c = $store(f.k);",
    );
    expect(output.warnings).toEqual([]);
  });
});

describe('$hasContext', () => {
  it('is false on the server and in the browser without a provider', async () => {
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

  it('is true for $route and $navigation in the browser', async () => {
    const { hasContext } = await import('../../src/runtime/client/context.ts');
    const { routeContext, navigationContext } = await import('../../src/runtime/context.ts');
    const scope = { id: 1, s: [] } as unknown as Scope;
    expect(hasContext(routeContext, scope)).toBe(true);
    expect(hasContext(navigationContext, scope)).toBe(true);
    expect(hasContext({ key: 'nothing' }, scope)).toBe(false);
  });

  it('is true for $route and $navigation on the server', async () => {
    const { Context, routeContext, navigationContext } =
      await import('../../src/runtime/server.ts').then(async (server) => ({
        ...(await import('../../src/runtime/context.ts')),
        Context: server.Context,
      }));
    const ctx = new Context();
    const scope = ctx.scope(1, undefined, 'Test');
    expect(ctx.has(routeContext, scope)).toBe(true);
    expect(ctx.has(navigationContext, scope)).toBe(true);
    expect(ctx.has({ key: 'nothing' }, scope)).toBe(false);
  });
});

describe('BRM197', () => {
  const head =
    "import { $getContext, $hasContext, $store } from 'brumate/signals';\nimport { Ctx, Other } from './ctx.ts';\nimport { theme } from './theme.ts';\n";
  function build(script: string): ReturnType<typeof compile> {
    return compile(`<script>\n${head}${script}\n</script>\n<p></p>`, { filename: 'Test.brm' });
  }

  it('accepts the guarded shapes and the plain answer', () => {
    expect(() => build('const x = $hasContext(Ctx) ? $store(Ctx) : undefined;')).not.toThrow();
    expect(() => build('const g = $hasContext(Ctx) ? $getContext(Ctx) : undefined;')).not.toThrow();
    expect(() =>
      build(
        'const g = $hasContext(Ctx) ? $getContext(Ctx) : undefined;\nconst y = $hasContext(Ctx) ? $store(g.state) : undefined;',
      ),
    ).not.toThrow();
    expect(() => build('const has = $hasContext(Ctx);')).not.toThrow();
  });

  it('reports a let, a guard on another context and other shapes, with the shape in the message', () => {
    const shape = 'const name = $hasContext(Context) ? $store(Context) : undefined';
    const shapes = [
      'let x = $hasContext(Ctx) ? $store(Ctx) : undefined;',
      'const x = $hasContext(Other) ? $store(Ctx) : undefined;',
      'const g = $getContext(Ctx);\nconst x = $hasContext(Other) ? $store(g.state) : undefined;',
      'const x = $hasContext(Ctx) ? $store(theme) : undefined;',
      'const g = $hasContext(Ctx) ? $getContext(Ctx) : undefined;\nconst y = $store(g.state);',
      'const x = $hasContext(Ctx) ? $store(Ctx) : null;',
      'const x = $hasContext(Ctx) ? $store(Ctx) : $store(Other);',
      'const x = $hasContext(Ctx) ? 1 : undefined;',
      'const x = $hasContext() ? $store(Ctx) : undefined;',
      'let has = $hasContext(Ctx);',
      'const x = $hasContext(Ctx, Other);',
      'const x = [$hasContext(Ctx)];',
    ];
    for (const script of shapes) {
      let thrown: unknown;
      try {
        build(script);
      } catch (error) {
        thrown = error;
      }
      expect((thrown as Error | undefined)?.message).toContain('[BRM197]');
      expect((thrown as Error).message).toContain(shape);
    }
  });
});
