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
