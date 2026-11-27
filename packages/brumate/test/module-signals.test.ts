// @vitest-environment happy-dom
// $signal and $memo at the top level of a module: `.brm.ts` modules and `<script module>`.
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { check } from '../src/check-command.ts';
import { analyzeProject, compile } from '../src/index.ts';
import { findError } from '../src/error-catalog.ts';
import { findSignalImports, transformModuleSignals } from '../src/module-signals.ts';
import { resolveFromDisk } from '../src/modules.ts';
import { render as renderParts } from '../src/runtime/server.ts';
import { derived, memoStore, pendingOf, store } from '../src/runtime/store.ts';

const input = resolve(import.meta.dirname, 'module-signals');
const output = resolve(import.meta.dirname, '.output/module-signals');
const file = (name: string): string => pathToFileURL(join(output, name)).href;
const modules = new Map<string, string>();

function toRender(code: string): string {
  return code
    .replace(/\.brm\?brumate-render"/g, '.brm.render.ts"')
    .replace(/\.brm\?brumate-client&part=(\w+)"/g, '.brm.client.$1.ts"')
    .replace(/\.brm\?brumate-client"/g, '.brm.client.ts"');
}

let stop: (() => void) | undefined;

beforeEach(() => {
  // Each test starts with new instances of the modules, as a new server does.
  vi.resetModules();
});

afterEach(() => {
  stop?.();
  stop = undefined;
  document.body.innerHTML = '';
  delete (globalThis as { seedValue?: number[] }).seedValue;
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

const text = (selector: string): string => document.querySelector(selector)!.textContent!;
const click = (selector: string): void => {
  document.querySelector(selector)!.dispatchEvent(new Event('click', { bubbles: true }));
};

function error(run: () => unknown): string {
  try {
    run();
  } catch (caught) {
    return (caught as Error).message;
  }
  throw new Error('no error');
}

const module = (text: string, path = '/m/a.brm.ts') => ({ path, source: text });

interface Cart {
  items: { get(): number[]; set(value: number[]): void };
  total: { get(): number };
  double: { get(): number; subscribe(listener: (value: number) => void): () => void };
  runs: { double: number };
  add(price: number): void;
}

/** Appends streamed markup and runs its inline scripts in order, as a browser does. */
function appendChunk(html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  // A copy, because appending moves nodes out of the live list.
  for (const node of Array.from(template.content.childNodes)) {
    document.body.append(node);
    if (node.nodeName === 'SCRIPT' && !(node as Element).hasAttribute('type')) {
      run(node as Element);
    }
  }
}

/**
 * Renders a page on the server, puts it in the document and starts the browser side. The bodies of
 * `#loading` that stream arrive after the start, as in a browser. Returns the first markup.
 */
async function resume(name: string): Promise<string> {
  const server = await import(file(`${name}.ts`));
  const { html, state, pending } = await renderParts(server.default, {});
  document.body.innerHTML = html + state;
  document.body.querySelectorAll('script[b-state]').forEach(run);
  vi.resetModules();
  const { start } = await import('../src/runtime/loader.ts');
  stop = start({ load: async (id) => import(modules.get(id)!) });
  for await (const chunk of pending) {
    appendChunk(chunk);
  }
  return html;
}

/** Renders on the server only. */
async function serverHtml(name: string): Promise<string> {
  const server = await import(file(`${name}.ts`));
  return (await renderParts(server.default, {})).html;
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
    if (name.endsWith('.brm.ts')) {
      // The plugin does this for a module, so a test without it does it here.
      const source = readFileSync(join(input, name), 'utf8');
      const code = transformModuleSignals({ path: join(input, name), source }) ?? source;
      writeFileSync(join(output, name), code);
      continue;
    }
    if (!name.endsWith('.brm')) {
      copyFileSync(join(input, name), join(output, name));
      continue;
    }
    if (name === 'Bad.brm') {
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

describe('a signal and a memo of a .brm.ts module', () => {
  it('renders, resumes, and updates two components after one exported function writes', async () => {
    const onServer = (await import(file('cart.brm.ts'))) as Cart;
    expect(onServer.items.get()).toEqual([]);
    const html = await serverHtml('Page.brm');
    expect(html).toContain('>0 items, 0</p>');

    await resume('Page.brm');
    expect(text('.count')).toBe('0 items, 0');
    const cart = (await import(file('cart.brm.ts'))) as Cart;
    click('.add');
    await vi.waitFor(() => expect(text('.count')).toBe('1 items, 5'), { timeout: 2000 });
    expect(text('.label')).toBe('1 items, 5');
    expect(text('.first')).toBe('5');
    cart.add(10);
    await vi.waitFor(() => expect(text('.count')).toBe('2 items, 15'), { timeout: 2000 });
    expect(text('.label')).toBe('2 items, 15');
  });

  it('repairs a value that the browser starts with, once', async () => {
    // The server rendered without items. The browser module starts from another value.
    (globalThis as { seedValue?: number[] }).seedValue = [4];
    await resume('Page.brm');
    await vi.waitFor(() => expect(text('.count')).toBe('1 items, 4'), { timeout: 2000 });
    expect(text('.label')).toBe('1 items, 4');
    expect(text('.first')).toBe('4');
    click('.add');
    await vi.waitFor(() => expect(text('.count')).toBe('2 items, 9'), { timeout: 2000 });
  });

  it('writes with ++, += and a recipe of $produce', async () => {
    await resume('Page.brm');
    expect(text('.step')).toBe('1');
    click('.bump');
    await vi.waitFor(() => expect(text('.step')).toBe('4'), { timeout: 2000 });
    expect(text('.note')).toBe('a');
    click('.rename');
    await vi.waitFor(() => expect(text('.note')).toBe('b'), { timeout: 2000 });
  });

  it('computes a memo over two module signals once per change', async () => {
    const cart = (await import(file('cart.brm.ts'))) as Cart;
    const seen: number[] = [];
    const stopWatching = cart.double.subscribe((value) => seen.push(value));
    const before = cart.runs.double;
    cart.add(3);
    // `double` reads `total` and `step`: one change of `items` computes it once.
    expect(cart.runs.double - before).toBe(1);
    expect(seen).toHaveLength(1);
    stopWatching();
  });

  it('shares the value between two server renders', async () => {
    // A module signal is one value for the server process, as `export const cart = store([])` is.
    // The docs say so: this is the documented behavior, not a bug.
    const cart = (await import(file('cart.brm.ts'))) as Cart;
    const before = cart.items.get().length;
    cart.add(1);
    const first = await serverHtml('Items.brm');
    cart.add(2);
    const second = await serverHtml('Items.brm');
    const count = (html: string): number => Number(/>(\d+)<!--\/t--> items/.exec(html)![1]);
    expect(count(first)).toBe(before + 1);
    expect(count(second)).toBe(before + 2);
  });

  it('keeps a module function that a component copies live', async () => {
    await resume('Copy.brm');
    expect(text('.seen')).toBe('1');
    click('.add');
    await vi.waitFor(() => expect(text('.seen')).toBe('2'), { timeout: 2000 });
    click('.add');
    await vi.waitFor(() => expect(text('.seen')).toBe('3'), { timeout: 2000 });
  });
});

describe('a module that reads a signal of another module', () => {
  it('reads the value, takes the signal as a source, and cannot write it', async () => {
    const cart = (await import(file('cart.brm.ts'))) as Cart;
    const chain = (await import(file('chain.brm.ts'))) as {
      twice: { get(): number; subscribe(listener: (value: number) => void): () => void };
      count(): number;
      addTwo(): void;
    };
    expect(chain.count()).toBe(0);
    const seen: number[] = [];
    const stopWatching = chain.twice.subscribe((value) => seen.push(value));
    cart.add(1);
    expect(chain.count()).toBe(1);
    expect(seen).toEqual([2]);
    chain.addTwo();
    expect(chain.twice.get()).toBe(6);
    stopWatching();
    const message = error(() =>
      transformModuleSignals(
        module(
          "import { $signal } from 'brumate/signals';\nimport { items } from './cart.brm.ts';\nexport function clear() {\n  items = [];\n}\n",
          join(input, 'writer.brm.ts'),
        ),
      ),
    );
    expect(message).toContain('Cannot assign to module signal "items"');
    expect(message).toContain('Export a function from ./cart.brm.ts that writes it');
    expect(findError(message)?.code).toBe('BRM117');
  });
});

describe('a module function that a component copies and that writes a module signal', () => {
  it('writes through the store, and the component reads it live', async () => {
    await resume('Tracker.brm');
    expect(text('.size')).toBe('0');
    click('.push');
    await vi.waitFor(() => expect(text('.size')).toBe('1'), { timeout: 2000 });
    click('.push');
    await vi.waitFor(() => expect(text('.size')).toBe('2'), { timeout: 2000 });
    const cart = (await import(file('cart.brm.ts'))) as Cart & { step: { get(): number } };
    expect(cart.step.get()).toBe(3);
  });
});

describe('a signal of <script module> that another component imports', () => {
  it('reads it live and writes it through an exported function', async () => {
    const html = await serverHtml('Reader.brm');
    expect(html).toMatch(/class="reader"[^>]*>1<\/p>/);
    await resume('Reader.brm');
    click('.bump');
    await vi.waitFor(() => expect(text('.reader')).toBe('2'), { timeout: 2000 });
  });
});

describe('a memo that reads signals through functions', () => {
  it('follows a function of its module and a helper of another module', async () => {
    const cart = (await import(file('cart.brm.ts'))) as Cart & {
      other: { set(value: number): void };
      withOther: { get(): number; subscribe(listener: (value: number) => void): () => void };
      viaHelper: { get(): number; subscribe(listener: (value: number) => void): () => void };
      step: { set(value: number): void };
      first: { get(): number; subscribe(listener: (value: number) => void): () => void };
      second: { get(): number; subscribe(listener: (value: number) => void): () => void };
    };
    const helpers = (await import(file('helpers.brm.ts'))) as {
      bonus: { set(value: number): void };
    };
    const seen: number[] = [];
    const stopWith = cart.withOther.subscribe((value) => seen.push(value));
    const via: number[] = [];
    const stopVia = cart.viaHelper.subscribe((value) => via.push(value));
    cart.add(5);
    expect(seen).toEqual([15]);
    cart.other.set(20);
    expect(seen).toEqual([15, 25]);
    helpers.bonus.set(200);
    expect(via).toEqual([201]);
    cart.step.set(3);
    expect(via).toEqual([201, 203]);
    // Two memos that reach the same signal of another module both follow it.
    const firsts: number[] = [];
    const seconds: number[] = [];
    const stopFirst = cart.first.subscribe((value) => firsts.push(value));
    const stopSecond = cart.second.subscribe((value) => seconds.push(value));
    helpers.bonus.set(300);
    expect(firsts).toEqual([301]);
    expect(seconds).toEqual([302]);
    stopFirst();
    stopSecond();
    stopWith();
    stopVia();
  });

  it('reports a helper that it cannot follow as BRM211', () => {
    const message = error(() =>
      transformModuleSignals(
        module(
          "import { $memo, $signal } from 'brumate/signals';\nimport { helper } from './missing.brm.ts';\nexport let a: number = $signal(1);\nexport const b: number = $memo(helper(a));\n",
          join(input, 'user.brm.ts'),
        ),
      ),
    );
    expect(findError(message)?.code).toBe('BRM211');
    expect(message).toContain('Pass the signals that it reads as arguments');
    expect(message).toMatch(/^helper cannot be compiled/);
  });
});

describe('a write of a module signal in a pattern', () => {
  it('is BRM211', () => {
    for (const code of [
      'export function a() {\n  [other] = [2];\n}',
      'export function a(obj: { other: number }) {\n  ({ other } = obj);\n}',
      'export function a(list: number[]) {\n  for (other of list) {}\n}',
    ]) {
      const message = error(() =>
        transformModuleSignals(
          module(`import { $signal } from 'brumate/signals';\nlet other = $signal(1);\n${code}\n`),
        ),
      );
      expect(findError(message)?.code).toBe('BRM211');
    }
  });
});

describe('a signal of <script module>', () => {
  it('renders, resumes, and updates after writes from the component and from the module', async () => {
    const html = await serverHtml('Own.brm');
    expect(html).toMatch(/class="count"[^>]*>1<\/p>/);
    expect(html).toMatch(/class="double"[^>]*>2<\/p>/);
    await resume('Own.brm');
    expect(text('.count')).toBe('1');
    click('.up');
    await vi.waitFor(() => expect(text('.count')).toBe('2'), { timeout: 2000 });
    expect(text('.double')).toBe('4');
    click('.reset');
    await vi.waitFor(() => expect(text('.count')).toBe('0'), { timeout: 2000 });
    expect(text('.double')).toBe('0');
  });
});

describe('errors', () => {
  const source = (name: string): string => readFileSync(join(input, name), 'utf8');

  it('reports a write through an import as BRM117 and names the fix', () => {
    const message = error(() =>
      compile(source('Bad.brm'), { filename: 'Bad.brm', path: join(input, 'Bad.brm') }),
    );
    expect(message).toContain('Cannot assign to module signal "items"');
    expect(message).toContain('Export a function from ./cart.brm.ts that writes it');
    expect(
      findError('Cannot assign to module signal "items". Export a function from ./a that writes it')
        ?.code,
    ).toBe('BRM117');
  });

  it('reports forms that the top level cannot take as BRM211', () => {
    const cases = [
      "import { $effect } from 'brumate/signals';\n$effect(() => {});",
      "import { $client } from 'brumate/signals';\nconst x = $client(() => 1);",
      "import { $signal } from 'brumate/signals';\nexport let { a } = $signal(1);",
      "import { $signal } from 'brumate/signals';\nlet a = $signal(1), b = 2;",
      "import { $memo } from 'brumate/signals';\nlet a = $memo(1);",
      "import { $signal } from 'brumate/signals';\nconst list = [$signal(1)];",
    ];
    for (const text of cases) {
      const message = error(() => transformModuleSignals(module(text)));
      expect(findError(message)?.code).toBe('BRM211');
    }
  });

  it('reports a module signal that a plain file imports as BRM208', () => {
    const imports = findSignalImports(
      "import { add, items, total } from './cart.brm.ts';\nimport { step as s } from './cart.brm.ts';",
      join(input, 'plain.ts'),
      resolveFromDisk,
    );
    expect(imports.map((item) => item.name)).toEqual(['items', 'total', 'step']);
  });
});

describe('brumate check', () => {
  it('reports a signal that a plain file imports as BRM208, and a bad top level as BRM211', async () => {
    const root = mkdtempSync(join(tmpdir(), 'brumate-signals-'));
    try {
      const cart =
        "import { $signal } from 'brumate/signals';\nexport let items = $signal<number[]>([]);\nexport function count(): number {\n  return items.length;\n}\n";
      writeFileSync(join(root, 'cart.brm.ts'), cart);
      writeFileSync(
        join(root, 'plain.ts'),
        "import { count, items } from './cart.brm.ts';\nexport const both = [count(), items];\n",
      );
      writeFileSync(
        join(root, 'bad.brm.ts'),
        "import { $effect } from 'brumate/signals';\n$effect(() => {});\n",
      );
      const { records } = await check(root, { types: false });
      const found = records.map((record) => `${record.file}: ${record.code}`);
      expect(found).toEqual(['bad.brm.ts: BRM211', 'plain.ts: BRM208']);
      const plain = records.find((record) => record.file === 'plain.ts')!;
      expect(plain.message).toContain('"items" is a signal of ./cart.brm.ts');
      expect(plain.range!.start).toEqual({ line: 1, column: 17 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

interface Forms {
  input: { get(): string; set(value: string): void };
  query: { get(): string; subscribe(listener: (value: string) => void): () => void };
  typed: {
    get(): string;
    subscribe(listener: (value: string) => void): () => void;
  };
  slow: { get(): string; subscribe(listener: (value: string) => void): () => void };
  label: { get(): string; subscribe(listener: (value: string) => void): () => void };
  shown: {
    get(): string;
    set(value: string): void;
    subscribe(listener: (value: string) => void): () => void;
  };
  runs: { label: number; gate: number };
  type(text: string): void;
  guess(text: string): void;
}

describe('a gate, a debounced and a throttled value, and an optimistic value of a module', () => {
  it('renders on the server, resumes, and updates two components', async () => {
    const html = await serverHtml('FormsPage.brm');
    expect(html).toContain('class="a-query"');
    expect(html).toContain('>idle</p>');
    await resume('FormsPage.brm');
    expect(text('.a-pending')).toBe('idle');
    click('.a-type');
    await vi.waitFor(() => expect(text('.a-pending')).toBe('waiting'), { timeout: 2000 });
    // The gate passes at once, the debounced value after its wait.
    await vi.waitFor(() => expect(text('.a-query')).toBe('abc'), { timeout: 2000 });
    expect(text('.b-query')).toBe('abc');
    expect(text('.a-label')).toBe('abc (3)');
    await vi.waitFor(() => expect(text('.a-typed')).toBe('abc'), { timeout: 2000 });
    expect(text('.b-typed')).toBe('abc');
    expect(text('.a-slow')).toBe('abc');
    expect(text('.a-pending')).toBe('idle');
    // A guard that says no keeps the value.
    click('.a-one');
    await vi.waitFor(() => expect(text('.a-typed')).toBe('a'), { timeout: 2000 });
    expect(text('.a-query')).toBe('abc');
    expect(text('.b-query')).toBe('abc');
  });
});

describe('$isPending, $resolve and $untrack of a component on an imported module value', () => {
  it('reads the pending state, waits for it, and reads without tracking', async () => {
    await resume('FormsC.brm');
    expect(text('.c-pending')).toBe('idle');
    expect(text('.c-keep')).toBe('0|');
    click('.c-type');
    click('.c-wait');
    await vi.waitFor(() => expect(text('.c-pending')).toBe('waiting'), { timeout: 2000 });
    expect(text('.c-both')).toBe('waiting');
    await vi.waitFor(() => expect(text('.c-loud')).toBe('XYZ'), { timeout: 2000 });
    expect(text('.c-pending')).toBe('idle');
    await vi.waitFor(() => expect(text('.c-resolved')).toBe('xyz'), { timeout: 2000 });
    // The imported value changed, and the memo that reads it untracked did not compute again.
    expect(text('.c-keep')).toBe('0|');
    click('.c-bump');
    await vi.waitFor(() => expect(text('.c-keep')).toBe('1|xyz'), { timeout: 2000 });
  });
});

describe('the forms in <script module>', () => {
  it('renders, resumes, and updates the readers of the file', async () => {
    const html = await serverHtml('OwnForms.brm');
    expect(html).toContain('>idle</p>');
    await resume('OwnForms.brm');
    click('.o-type');
    await vi.waitFor(() => expect(text('.o-pending')).toBe('waiting'), { timeout: 2000 });
    await vi.waitFor(() => expect(text('.o-query')).toBe('abc'), { timeout: 2000 });
    expect(text('.o-shown')).toBe('ABC');
    expect(text('.o-typed')).toBe('');
    await vi.waitFor(() => expect(text('.o-typed')).toBe('abc'), { timeout: 2000 });
    expect(text('.o-slow')).toBe('abc');
    expect(text('.o-pending')).toBe('idle');
    click('.o-guess');
    await vi.waitFor(() => expect(text('.o-shown')).toBe('guess'), { timeout: 2000 });
  });
});

interface Guarded {
  n: { get(): number };
  rising: { get(): number; subscribe(listener: (value: number) => void): () => void };
  source: { get(): number; subscribe(listener: (value: number) => void): () => void };
  guessed: {
    get(): number;
    set(value: number): void;
    subscribe(listener: (value: number) => void): () => void;
  };
  setN(value: number): void;
  guess(value: number): void;
}

describe('an error of a module value', () => {
  it('goes to the #try of the reader, not to the writer, and the other memos still update', async () => {
    await resume('ErrPage.brm');
    expect(text('.r-plain')).toBe('0');
    expect(text('.w-double')).toBe('0');
    // The click handler of the writer must not throw: the error would reach the window.
    click('.w-three');
    await vi.waitFor(() => expect(text('.w-double')).toBe('6'), { timeout: 2000 });
    expect(text('.r-n')).toBe('3');
    await vi.waitFor(() => expect(text('.r-plain-caught')).toContain('three'), { timeout: 2000 });
    await vi.waitFor(() => expect(text('.r-gated-caught')).toContain('three'), { timeout: 2000 });
    // The debounced value fails after its wait.
    await vi.waitFor(() => expect(text('.r-delayed-caught')).toContain('three'), { timeout: 2000 });
    expect(document.querySelector('.r-plain')).toBeNull();
  });

  it('is held by each store and read again after the next value', async () => {
    const errors = (await import(file('errors.brm.ts'))) as {
      set(value: number): void;
      plain: { get(): number; subscribe(listener: (value: number) => void): () => void };
      gated: { get(): number; subscribe(listener: () => void): () => void };
      delayed: { get(): number; subscribe(listener: () => void): () => void };
      double: { get(): number; subscribe(listener: () => void): () => void };
    };
    vi.useFakeTimers();
    try {
      const seen: number[] = [];
      const stops = [
        errors.plain.subscribe((value) => {
          seen.push(value);
        }),
        errors.gated.subscribe(() => {}),
        errors.delayed.subscribe(() => {}),
        errors.double.subscribe(() => {}),
      ];
      expect(() => errors.set(3)).not.toThrow();
      expect(() => errors.plain.get()).toThrow('three');
      expect(() => errors.gated.get()).toThrow('three');
      // One notice for the error, with the value that the store held.
      expect(seen).toEqual([0]);
      // The sibling computed in the same pass.
      expect(errors.double.get()).toBe(6);
      expect(() => vi.advanceTimersByTime(20)).not.toThrow();
      expect(() => errors.delayed.get()).toThrow('three');
      errors.set(4);
      // The recovery with a new value is one notice.
      expect(seen).toEqual([0, 4]);
      expect(errors.plain.get()).toBe(4);
      expect(errors.gated.get()).toBe(4);
      vi.advanceTimersByTime(20);
      expect(errors.delayed.get()).toBe(4);
      for (const stop of stops) {
        stop();
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

interface UserModule {
  calls: { user: number; label: number; steps: number };
  setId(next: number): void;
}

/** Waits for timers and the loads that they settle. */
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/** A component that reads `user` of user.brm.ts in `#loading` only, and in a handler. */
function reader(handler: string): string {
  return `<script>\n  import { $isPending } from 'brumate/signals';\n  import { user } from './user.brm.ts';\n</script>\n\n#loading {\n  <p>{user.name}</p>\n} #else {\n  <p>wait</p>\n}\n<button onClick=${handler}>Log</button>\n`;
}

describe('an async memo of a module', () => {
  it('renders on the server, outside and inside #loading, and resumes without a second load', async () => {
    const onServer = (await import(file('user.brm.ts'))) as UserModule;
    const html = await resume('AsyncPage.brm');
    // The page waits for the memos that markup reads outside #loading, and `await label`.
    expect(html).toMatch(/class="r-user"[^>]*>user 1<\/p>/);
    expect(html).toMatch(/class="r-shout"[^>]*>USER 1<\/p>/);
    expect(html).toMatch(/class="r-await"[^>]*>label 1<\/p>/);
    // The stream inside #loading is not ready: the fallback goes out, and the body streams.
    expect(html).toContain('class="r-wait"');
    expect(onServer.calls).toEqual({ user: 1, label: 1, steps: 1 });
    const browser = (await import(file('user.brm.ts'))) as UserModule;
    await sleep(40);
    expect(text('.r-user')).toBe('user 1');
    expect(text('.r-shout')).toBe('USER 1');
    expect(text('.r-label')).toBe('label 1');
    expect(text('.r-steps')).toBe('step 1 of 1');
    expect(text('.r-pending')).toBe('idle');
    // The browser keeps what the server rendered: its sources are the same.
    expect(browser.calls).toEqual({ user: 0, label: 0, steps: 0 });
  });

  it('loads again when a source changes in another component, and writes only the latest run', async () => {
    await resume('AsyncPage.brm');
    const browser = (await import(file('user.brm.ts'))) as UserModule;
    // The load of 2 is slow, and 3 replaces it.
    click('.w-two');
    await vi.waitFor(() => expect(text('.r-pending')).toBe('loading'), { timeout: 2000 });
    // The old value stays while the new one loads.
    expect(text('.r-user')).toBe('user 1');
    click('.w-three');
    await vi.waitFor(() => expect(text('.r-user')).toBe('user 3'), { timeout: 2000 });
    expect(text('.r-pending')).toBe('idle');
    await vi.waitFor(() => expect(text('.r-shout')).toBe('USER 3'), { timeout: 2000 });
    await vi.waitFor(() => expect(text('.r-label')).toBe('label 3'), { timeout: 2000 });
    expect(text('.r-await')).toBe('label 3');
    // A stream gives each of its values in turn.
    await vi.waitFor(() => expect(text('.r-steps')).toBe('step 3 of 3'), { timeout: 2000 });
    // The load of 2 ends after that of 3, and is dropped.
    await sleep(150);
    expect(text('.r-user')).toBe('user 3');
    expect(text('.r-label')).toBe('label 3');
    expect(browser.calls.user).toBe(2);
  });

  it('links nothing from code that loads after the loader stopped', async () => {
    const server = await import(file('AsyncPage.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    document.body.innerHTML = html + state;
    document.body.querySelectorAll('script[b-state]').forEach(run);
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    let release!: () => void;
    const late = new Promise<void>((done) => (release = done));
    const end = start({
      load: async (id) => {
        // The code of the reader loads after the loader stopped, as on a slow machine.
        if (id.startsWith('AsyncReader')) {
          await late;
        }
        return import(modules.get(id)!);
      },
    });
    await sleep(20);
    end();
    release();
    await sleep(20);
    const browser = (await import(file('user.brm.ts'))) as UserModule;
    // A scope of the stopped page that followed the memo would load it again on this write.
    browser.setId(2);
    await sleep(20);
    expect(browser.calls.user).toBe(0);
  });

  it('waits with $resolve in a handler of the reader', async () => {
    await resume('AsyncPage.brm');
    click('.w-two');
    click('.r-resolve');
    await vi.waitFor(() => expect(text('.r-resolved')).toBe('user 2'), { timeout: 2000 });
  });

  it('sends a rejected load to the #try of the reader, and the other memos update', async () => {
    const errors: unknown[] = [];
    const onError = (event: Event): void => {
      errors.push(event);
    };
    window.addEventListener('error', onError);
    try {
      await resume('AsyncPage.brm');
      click('.w-fail');
      await vi.waitFor(() => expect(text('.r-caught')).toContain('thirteen'), { timeout: 2000 });
      await vi.waitFor(() => expect(text('.r-label')).toBe('label 13'), { timeout: 2000 });
      expect(text('.w-id')).toBe('13');
      expect(errors).toEqual([]);
    } finally {
      window.removeEventListener('error', onError);
    }
  });

  it('shares one load between server requests, until a source changes', async () => {
    const onServer = (await import(file('user.brm.ts'))) as UserModule;
    // Two requests while the load is out wait for the same load.
    const [first, second] = await Promise.all([
      serverHtml('AsyncReader.brm'),
      serverHtml('AsyncReader.brm'),
    ]);
    expect(onServer.calls.user).toBe(1);
    expect(first).toMatch(/class="r-user"[^>]*>user 1<\/p>/);
    expect(second).toMatch(/class="r-user"[^>]*>user 1<\/p>/);
    // A request after the loads settled renders the values without a load, #loading in place.
    await sleep(40);
    const third = await serverHtml('AsyncReader.brm');
    expect(onServer.calls).toEqual({ user: 1, label: 1, steps: 1 });
    expect(third).not.toContain('r-wait');
    expect(third).toMatch(/class="r-steps"[^>]*>step 1 of 1<\/p>/);
    // A change of a source on the server starts one new load at the next read.
    onServer.setId(4);
    const fourth = await serverHtml('AsyncReader.brm');
    expect(fourth).toMatch(/class="r-user"[^>]*>user 4<\/p>/);
    expect(onServer.calls.user).toBe(2);
  });

  it('compiles $memo(await …) at the top level, and a handler that reads it is BRM182', () => {
    const code = transformModuleSignals(
      module(
        "import { $memo, $signal } from 'brumate/signals';\nexport let id = $signal(1);\nexport const user = $memo(await load(id));",
      ),
    );
    expect(code).toContain('$$derived([id], async ([id]) => (await load(id)), { n: ["id"] })');
    const message = error(() =>
      compile(reader('(() => console.log(user.name))'), {
        filename: 'Log.brm',
        path: join(input, 'Log.brm'),
      }),
    );
    expect(findError(message)?.code).toBe('BRM182');
    expect(message).toContain('The handler reads "user"');
    // A guard makes the read fine, as for a memo of the component.
    expect(() =>
      compile(reader('(() => { if (!$isPending(user)) console.log(user.name); })'), {
        filename: 'Log.brm',
        path: join(input, 'Log.brm'),
      }),
    ).not.toThrow();
  });

  it('reads a memo that loads from a memo of the module, which waits for it', async () => {
    const users = (await import(file('user.brm.ts'))) as UserModule & {
      shout: { get(): string; subscribe(listener: (value: string) => void): () => void };
    };
    // No value yet: a read throws the error that names $resolve.
    expect(() => users.shout.get()).toThrow('This value is still loading');
    const seen: string[] = [];
    const stopWatching = users.shout.subscribe((value) => seen.push(value));
    await vi.waitFor(() => expect(users.shout.get()).toBe('USER 1'), { timeout: 2000 });
    users.setId(3);
    await vi.waitFor(() => expect(seen.at(-1)).toBe('USER 3'), { timeout: 2000 });
    expect(users.calls.user).toBe(2);
    stopWatching();
  });
});

describe('a module memo that the browser reads after resume', () => {
  it('runs module code that reads it, with no load and no throw', async () => {
    await resume('AsyncPage.brm');
    const browser = (await import(file('user.brm.ts'))) as UserModule & { logName(): string };
    // The components have resumed and given the module the values of the server.
    await sleep(20);
    expect(browser.logName()).toBe('user 1');
    await sleep(30);
    expect(browser.calls.user).toBe(0);
  });

  it('runs a gate, a debounced and a throttled value over a memo that loads', async () => {
    const onServer = (await import(file('user.brm.ts'))) as UserModule;
    const html = await resume('AsyncFormsPage.brm');
    // The page waits for the gate, and #loading streams the timed values.
    expect(html).toMatch(/class="f-gated"[^>]*>user 1<\/p>/);
    expect(onServer.calls.user).toBe(1);
    expect(text('.f-slow')).toBe('user 1');
    expect(text('.f-steady')).toBe('user 1');
    const browser = (await import(file('user.brm.ts'))) as UserModule;
    await sleep(30);
    expect(browser.calls.user).toBe(0);
    // A change loads once, and each form takes the value: the debounced one after its wait.
    click('.w-three');
    await vi.waitFor(() => expect(text('.f-gated')).toBe('user 3'), { timeout: 2000 });
    await vi.waitFor(() => expect(text('.f-slow')).toBe('user 3'), { timeout: 2000 });
    await vi.waitFor(() => expect(text('.f-steady')).toBe('user 3'), { timeout: 2000 });
    expect(browser.calls.user).toBe(1);
    // The gate refuses user 4 and keeps its value, the others take it.
    click('.w-four');
    await vi.waitFor(() => expect(text('.f-slow')).toBe('user 4'), { timeout: 2000 });
    expect(text('.f-gated')).toBe('user 3');
  });

  it('renders the forms over a memo that loads on the server, also after it settled', async () => {
    await serverHtml('AsyncForms.brm');
    await sleep(30);
    const html = await serverHtml('AsyncForms.brm');
    expect(html).toMatch(/class="f-gated"[^>]*>user 1<\/p>/);
    expect(html).toMatch(/class="f-slow"[^>]*>user 1<\/p>/);
    expect(html).not.toContain('f-wait');
  });
});

describe('a sync module memo that a component reads late', () => {
  it('computes again after a source changed while nothing followed it', () => {
    const tick = store(0);
    const parity = memoStore([tick], ([value]) => (value % 2 ? 'odd' : 'even'));
    expect(parity.get()).toBe('even');
    tick.set(1);
    const stopFace = parity.i.subscribe(() => {});
    expect(parity.p()).toBe('odd');
    stopFace();
    tick.set(2);
    const stopFollow = parity.f(() => {});
    expect(parity.get()).toBe('even');
    stopFollow();
  });

  it('gives the current value to a component that a block opens', async () => {
    for (const round of [1, 2]) {
      stop?.();
      document.body.innerHTML = '';
      vi.resetModules();
      // oxlint-disable-next-line no-await-in-loop -- Each round resumes the page again.
      await resume('ParityPage.brm');
      click('.show');
      // oxlint-disable-next-line no-await-in-loop -- The block opens after the click.
      await vi.waitFor(() => expect(text('.parity')).toBe('odd'), { timeout: 2000 });
      expect(`${round}: ${text('.peeked')}`).toBe(`${round}: even`);
    }
  });
});

/** The page state of a render. */
async function pageState(name: string): Promise<string> {
  const server = await import(file(`${name}.ts`));
  return (await renderParts(server.default, {})).state;
}

describe('the page state of an imported module memo', () => {
  it('sends the value, not the sources: a class instance in a source renders and resumes', async () => {
    const html = await serverHtml('BoxView.brm');
    expect(html).toMatch(/class="boxed"[^>]*>6<\/p>/);
    await resume('BoxView.brm');
    expect(text('.boxed')).toBe('6');
    click('.grow');
    await vi.waitFor(() => expect(text('.boxed')).toBe('8'), { timeout: 2000 });
  });

  it('does not grow with the sources of the memo', async () => {
    const state = await pageState('RowsView.brm');
    expect(state).toContain('5000');
    expect(state.length).toBeLessThan(600);
  });

  it('sends a long string once, and the browser keeps it', async () => {
    const state = await pageState('LongView.brm');
    expect(state.split('x'.repeat(5000))).toHaveLength(2);
    await resume('LongView.brm');
    expect(text('.long')).toBe('5000');
    expect(text('.text')).toHaveLength(5000);
  });

  it('names the source of a memo that loaded, when the source cannot be sent', async () => {
    const server = await import(file('BoxLoadedView.brm.ts'));
    let message = '';
    try {
      const { pending } = await renderParts(server.default, {});
      for await (const chunk of pending) {
        expect(chunk).toBeDefined();
      }
    } catch (caught) {
      message = (caught as Error).message;
    }
    expect(message).toContain('The source "box" of the module memo "boxLoaded"');
    expect(message).toContain('holds a Box, which cannot be sent to the browser');
  });
});

describe('the repair of a sync module memo with two importers', () => {
  afterEach(() => {
    delete (globalThis as { tallySeed?: number[] }).tallySeed;
  });

  it('writes the value of the browser in both, when it is 0', async () => {
    const onServer = (await import(file('tally.brm.ts'))) as { fill(n: number): void };
    onServer.fill(5);
    const html = await resume('CountPage.brm');
    expect(html).toMatch(/class="count-a"[^>]*>5<\/p>/);
    await vi.waitFor(() => expect(text('.count-a')).toBe('0'), { timeout: 2000 });
    await vi.waitFor(() => expect(text('.count-b')).toBe('0'), { timeout: 2000 });
    // A sync value that holds a promise is a value, not one that loaded.
    expect(text('.pair')).toBe('pair');
  });

  it('writes the value of the browser in both, when it is not 0', async () => {
    await import(file('tally.brm.ts'));
    (globalThis as { tallySeed?: number[] }).tallySeed = [1, 2];
    await resume('CountPage.brm');
    await vi.waitFor(() => expect(text('.count-a')).toBe('2'), { timeout: 2000 });
    await vi.waitFor(() => expect(text('.count-b')).toBe('2'), { timeout: 2000 });
  });
});

describe('the sources of a loaded module memo, as the page state sends them', () => {
  it('a date, a set, a map and NaN that did not change load nothing', async () => {
    await resume('StampView.brm');
    const browser = (await import(file('stamp.brm.ts'))) as { calls: { stamp: number } };
    expect(text('.stamped')).toBe('0 a 1 NaN');
    await sleep(30);
    expect(browser.calls.stamp).toBe(0);
  });

  it('a date that changed on the server loads once in the browser', async () => {
    const onServer = (await import(file('stamp.brm.ts'))) as { touch(): void };
    onServer.touch();
    await resume('StampView.brm');
    expect(text('.stamped')).toBe('1 a 1 NaN');
    const browser = (await import(file('stamp.brm.ts'))) as { calls: { stamp: number } };
    await vi.waitFor(() => expect(text('.stamped')).toBe('0 a 1 NaN'), { timeout: 2000 });
    await sleep(30);
    expect(browser.calls.stamp).toBe(1);
  });
});

describe('the renders that a module memo holds on the server', () => {
  it('holds none once a load ended, however many renders read it', async () => {
    const RENDER = Symbol.for('brumate.render');
    const global = globalThis as Record<symbol, unknown>;
    const memo = memoStore(store(1), async (value) => {
      await sleep(5);
      return value;
    });
    /** Reads the memo as a render of the server does. */
    function readIn(render: object): unknown {
      global[RENDER] = render;
      try {
        return memo.p();
      } finally {
        delete global[RENDER];
      }
    }
    const first = readIn({});
    readIn({});
    // Two renders wait for the load, so its error would reach them.
    expect(memo.h()).toBe(2);
    await first;
    expect(memo.h()).toBe(0);
    for (let index = 0; index < 300; index++) {
      readIn({});
    }
    expect(memo.h()).toBe(0);
  });
});

describe('a module memo that loaded on the server with other sources', () => {
  it('loads once in the browser, with its own sources, and keeps the old value meanwhile', async () => {
    const onServer = (await import(file('user.brm.ts'))) as UserModule;
    // A server function wrote the signal on the server: the page renders user 4.
    onServer.setId(4);
    const html = await resume('AsyncPage.brm');
    expect(html).toMatch(/class="r-user"[^>]*>user 4<\/p>/);
    const browser = (await import(file('user.brm.ts'))) as UserModule;
    // The browser's own id is 1: the signal is repaired, and the memo loads for it.
    await vi.waitFor(() => expect(text('.w-id')).toBe('1'), { timeout: 2000 });
    await vi.waitFor(() => expect(text('.r-user')).toBe('user 1'), { timeout: 2000 });
    await sleep(30);
    expect(browser.calls.user).toBe(1);
  });
});

describe('a failed load of a module memo on the server', () => {
  it('goes to the requests that read it, and a later request loads again', async () => {
    const config = (await import(file('config.brm.ts'))) as {
      calls: { config: number; failures: number };
    };
    const first = await serverHtml('ConfigPage.brm');
    // Two readers of one render share the load and its error.
    expect(config.calls.config).toBe(1);
    expect(first.match(/class="down"/g)).toHaveLength(2);
    const second = await serverHtml('ConfigPage.brm');
    expect(config.calls.config).toBe(2);
    expect(second.match(/class="theme"[^>]*>dark</g)).toHaveLength(2);
    // The value is kept: a third request loads nothing.
    await serverHtml('ConfigPage.brm');
    expect(config.calls.config).toBe(2);
  });

  it('keeps the error for the rest of the render that read it, while a later render loads again', async () => {
    const RENDER = Symbol.for('brumate.render');
    const global = globalThis as Record<symbol, unknown>;
    let loads = 0;
    const memo = memoStore(store(1), async () => {
      loads++;
      await sleep(5);
      if (loads === 1) {
        throw new Error('down');
      }
      return 'up';
    });
    const first = {};
    const later = {};
    /** Reads the memo as a render of the server does. */
    function readIn(render: object): unknown {
      global[RENDER] = render;
      try {
        return memo.p();
      } catch (caught) {
        return caught;
      } finally {
        delete global[RENDER];
      }
    }
    await expect(readIn(first)).rejects.toThrow('down');
    // A later render loads again, and gets the value.
    expect(await readIn(later)).toBe('up');
    expect(loads).toBe(2);
    // The first render, still streaming, reads its own error, not the later load.
    expect(readIn(first)).toEqual(new Error('down'));
    expect(loads).toBe(2);
  });
});

describe('the stores of the forms', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a derived store of a user still throws into the set that caused it', () => {
    const a = store(1);
    const risky = derived(a, (value) => {
      if (value === 2) {
        throw new Error('two');
      }
      return value;
    });
    risky.subscribe(() => {});
    expect(() => a.set(2)).toThrow('two');
  });

  it('a held store notifies once when it recovers with the same value', () => {
    const a = store(1);
    const held = memoStore(a, (value) => {
      if (value === 2) {
        throw new Error('two');
      }
      return value > 2 ? 1 : value;
    });
    const seen: number[] = [];
    held.subscribe((value) => seen.push(value));
    a.set(2);
    expect(seen).toEqual([1]);
    // The same value as before the error: the readers still hear that the error is gone.
    a.set(3);
    expect(seen).toEqual([1, 1]);
    expect(held.get()).toBe(1);
  });

  it('reads the pending state of a store by its own key only', () => {
    // A store of a user with a field `q` is no pending store.
    expect(pendingOf({ q: new Set(), n: true })).toBeUndefined();
    expect(pendingOf({ [Symbol.for('brumate.pending')]: { q: 1 } })).toBeUndefined();
    expect(pendingOf(memoStore(store(1), (value) => value, { m: 10 }))).toBeDefined();
  });

  it('$gate keeps its value when the guard says no, and runs no reader', async () => {
    const guarded = (await import(file('guarded.brm.ts'))) as Guarded;
    const seen: number[] = [];
    const stopWatching = guarded.rising.subscribe((value) => seen.push(value));
    guarded.setN(3);
    guarded.setN(1);
    expect(guarded.rising.get()).toBe(3);
    guarded.setN(4);
    expect(seen).toEqual([3, 4]);
    stopWatching();
    // Without a reader there is no history: the value is the value, as on the server.
    guarded.setN(1);
    expect(guarded.rising.get()).toBe(1);
  });

  it('$gate holds the error of a guard that throws, and passes the next value', async () => {
    const guarded = (await import(file('guarded.brm.ts'))) as Guarded;
    const seen: number[] = [];
    const stopWatching = guarded.rising.subscribe((value) => seen.push(value));
    guarded.setN(2);
    // The writer does not throw. The reader throws the error when it reads.
    guarded.setN(5);
    expect(() => guarded.rising.get()).toThrow('five');
    // The first value after an error passes without the guard.
    guarded.setN(1);
    expect(guarded.rising.get()).toBe(1);
    expect(seen.at(-1)).toBe(1);
    stopWatching();
  });

  it('$gate refuses a promise when its value is computed', () => {
    const code = transformModuleSignals(
      module(
        "import { $gate, $signal } from 'brumate/signals';\nexport let a = $signal(1);\nexport const g = $gate(Promise.resolve(a), () => true);",
      ),
    );
    expect(code).toContain(
      '$$derived([a], ([a]) => (Promise.resolve(a)), { g: () => true, n: ["a"] })',
    );
    // The compiled call, run by hand: a source store and the function that the call gives. The
    // error is held, as any error of the store, so the reader's #try gets it.
    const g = memoStore(store(1), (value) => Promise.resolve(value), { g: () => true });
    expect(() => g.get()).toThrow('The value of $gate is a promise or a stream');
    const stopWatching = g.subscribe(() => {});
    expect(() => g.get()).toThrow('The value of $gate is a promise or a stream');
    stopWatching();
  });

  it('$debounced waits for the input to stop, and is pending meanwhile', async () => {
    vi.useFakeTimers();
    const forms = (await import(file('forms.brm.ts'))) as Forms;
    const seen: string[] = [];
    const stopWatching = forms.typed.subscribe((value) => seen.push(value));
    expect(!!pendingOf(forms.typed)?.n).toBe(false);
    forms.type('a');
    vi.advanceTimersByTime(150);
    forms.type('ab');
    expect(pendingOf(forms.typed)?.n).toBe(true);
    // The wait starts again at each change.
    vi.advanceTimersByTime(199);
    expect(seen).toEqual([]);
    expect(forms.typed.get()).toBe('');
    vi.advanceTimersByTime(1);
    expect(seen).toEqual(['ab']);
    expect(!!pendingOf(forms.typed)?.n).toBe(false);
    stopWatching();
  });

  it('$throttled takes the first value at once and the last one after the wait', async () => {
    vi.useFakeTimers();
    const forms = (await import(file('forms.brm.ts'))) as Forms;
    const seen: string[] = [];
    const stopWatching = forms.slow.subscribe((value) => seen.push(value));
    forms.type('a');
    expect(seen).toEqual(['a']);
    vi.advanceTimersByTime(50);
    forms.type('ab');
    forms.type('abc');
    expect(seen).toEqual(['a']);
    vi.advanceTimersByTime(149);
    expect(seen).toEqual(['a']);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual(['a', 'abc']);
    stopWatching();
  });

  it('a debounced value is the value itself without a reader', async () => {
    const forms = (await import(file('forms.brm.ts'))) as Forms;
    forms.type('now');
    expect(forms.typed.get()).toBe('now');
    expect(forms.slow.get()).toBe('now');
  });

  it('$optimistic shows a guess and resets when the source changes', async () => {
    const guarded = (await import(file('guarded.brm.ts'))) as Guarded;
    const seen: number[] = [];
    const stopWatching = guarded.guessed.subscribe((value) => seen.push(value));
    expect(guarded.guessed.get()).toBe(0);
    guarded.guess(7);
    expect(guarded.guessed.get()).toBe(7);
    guarded.setN(2);
    expect(guarded.guessed.get()).toBe(20);
    expect(seen).toEqual([7, 20]);
    stopWatching();
  });

  it('$optimistic resets when every server call of the page finishes', async () => {
    const guarded = (await import(file('guarded.brm.ts'))) as Guarded;
    const { track } = await import('../src/runtime/client.ts');
    const stopWatching = guarded.guessed.subscribe(() => {});
    guarded.guess(7);
    let release!: () => void;
    const first = track(new Promise<void>((done) => (release = done)));
    let releaseSecond!: () => void;
    const second = track(new Promise<void>((done) => (releaseSecond = done)));
    release();
    await first;
    await new Promise((done) => setTimeout(done, 5));
    // One call is still out: the guess stays.
    expect(guarded.guessed.get()).toBe(7);
    releaseSecond();
    await second;
    await vi.waitFor(() => expect(guarded.guessed.get()).toBe(0), { timeout: 2000 });
    stopWatching();
  });

  it('keeps BRM211 for the forms that need a component, and names where to call them', () => {
    const cases: [string, string][] = [
      ["import { $props } from 'brumate/signals';\nconst { a } = $props();", '$props'],
      ["import { $effect } from 'brumate/signals';\n$effect(() => {});", '$effect'],
      ["import { $client } from 'brumate/signals';\nconst x = $client(() => 1);", '$client'],
      [
        "import { $getContext } from 'brumate/signals';\nexport const c = $getContext(K);",
        '$getContext',
      ],
      ["import { $route } from 'brumate/signals';\nexport const r = $route();", '$route'],
    ];
    for (const [text, name] of cases) {
      const message = error(() => transformModuleSignals(module(text)));
      expect(findError(message)?.code).toBe('BRM211');
      expect(message).toContain(name);
      expect(message).toContain('in a component');
    }
  });

  it('reports a form that is declared the wrong way with the code of the component form', () => {
    const head =
      "import { $debounced, $gate, $optimistic, $signal, $memo, $throttled, $untrack } from 'brumate/signals';\nexport let a = $signal(1);\nexport const m = $memo(a);\n";
    const other = {
      path: '/m/b.brm.ts',
      source: "import { $signal } from 'brumate/signals';\nexport let far = $signal(1);\n",
    };
    const resolve = (): typeof other => other;
    const cases: [string, string, string][] = [
      ['export let g = $gate(a, () => true);', 'BRM085', 'Declare $gate with const'],
      ['export const g = $gate(a);', 'BRM202', '$gate takes a value and a function'],
      ['export const g = $gate(a, 3);', 'BRM202', '$gate takes a value and a function'],
      ['export const g = $gate(await a, () => true);', 'BRM203', 'takes a value that is ready'],
      ['export const d = $debounced(a, 10 + 5);', 'BRM088', 'The wait of $debounced must be'],
      ['export const d = $debounced(a);', 'BRM087', '$debounced takes a value and a wait'],
      ['export let d = $throttled(a, 10);', 'BRM085', 'Declare $throttled with const'],
      ['export const { x } = $debounced(a, 10);', 'BRM086', '$debounced cannot be destructured'],
      ['export const o = $optimistic(m);', 'BRM089', 'Declare $optimistic with let'],
      ['export let o = $optimistic(a);', 'BRM120', 'follows a memo, an action or a prop'],
      ['export let o = $optimistic(a + 1);', 'BRM092', 'needs the name of a value'],
      ['export let o = $optimistic();', 'BRM091', '$optimistic needs a value'],
      ['export let o = $optimistic(m, m);', 'BRM090', '$optimistic takes one argument'],
      ['const plain = 3;\nexport let o = $optimistic(plain);', 'BRM211', 'no memo of a module'],
      [
        'import { far } from "./b.brm.ts";\nexport let o = $optimistic(far);',
        'BRM120',
        'not a signal',
      ],
      [
        'export let o = $optimistic(m);\nexport function up() { o++; }',
        'BRM161',
        'with = instead of ++',
      ],
      [
        'export let o = $optimistic(m);\nexport function down() { --o; }',
        'BRM161',
        'with = instead of --',
      ],
      ['export const d = $debounced(await a, 10);', 'BRM211', 'with await'],
      ['export const u = $memo($untrack());', 'BRM211', '$untrack cannot be compiled'],
      ['export const u = $memo($untrack(a, a));', 'BRM211', 'with other than one expression'],
    ];
    for (const [text, code, part] of cases) {
      const message = error(() => transformModuleSignals(module(head + text), resolve));
      expect(`${findError(message)?.code}: ${message}`).toContain(`${code}: `);
      expect(`${text} => ${message}`).toContain(part);
    }
  });

  it('$untrack in a memo: a change of the untracked name does not compute it again', async () => {
    const forms = (await import(file('forms.brm.ts'))) as Forms;
    const stopWatching = forms.label.subscribe(() => {});
    const before = forms.runs.label;
    forms.type('ab');
    // `query` changed with the input, so the label computes once. A longer input that the gate
    // refuses leaves it alone, though the untracked length changed.
    expect(forms.runs.label - before).toBe(1);
    expect(forms.label.get()).toBe('ab (2)');
    forms.type('abc');
    expect(forms.label.get()).toBe('abc (3)');
    const mid = forms.runs.label;
    forms.type('a');
    expect(forms.runs.label).toBe(mid);
    expect(forms.label.get()).toBe('abc (3)');
    stopWatching();
  });
});
