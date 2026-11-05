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

  it('repairs a module-level store that changed since the server render', async () => {
    await resume('storeTheme', () => {
      // The browser starts from a saved choice, which the server did not know.
      (globalThis as { savedTheme?: string }).savedTheme = 'dark';
    });
    // The server rendered the default.
    await waitFor(() => expect(text('.theme')).toBe('dark'));
    const { theme } = (await import(file('contexts.ts'))) as { theme: Store<string> };
    theme.set('blue');
    await waitFor(() => expect(text('.theme')).toBe('blue'));
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
});
