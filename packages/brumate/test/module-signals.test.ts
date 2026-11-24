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
import { derived, gated, heldDerived, pendingOf, store, timed } from '../src/runtime/store.ts';

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

/** Renders a page on the server, puts it in the document and starts the browser side. */
async function resume(name: string): Promise<void> {
  const server = await import(file(`${name}.ts`));
  const { html, state } = await renderParts(server.default, {});
  document.body.innerHTML = html + state;
  document.body.querySelectorAll('script[b-state]').forEach(run);
  vi.resetModules();
  const { start } = await import('../src/runtime/loader.ts');
  stop = start({ load: async (id) => import(modules.get(id)!) });
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
      "import { $memo } from 'brumate/signals';\nexport const a = $memo(await load());",
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
    const held = heldDerived(a, (value) => {
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
    expect(pendingOf(timed(store(1), (value) => value, 10))).toBeDefined();
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
    expect(code).toContain('$$gated([a], ([a]) => (Promise.resolve(a)), () => true)');
    // The compiled call, run by hand: a source store and the function that the call gives.
    const g = gated(
      store(1),
      (value) => Promise.resolve(value),
      () => true,
    );
    expect(() => g.get()).toThrow('The value of $gate is a promise or a stream');
    expect(() => g.subscribe(() => {})).toThrow('The value of $gate is a promise or a stream');
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
