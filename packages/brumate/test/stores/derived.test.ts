// @vitest-environment happy-dom
// derived(): the API of Svelte 4's derived for stores at module level.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyzeProject, compile } from '../../src/index.ts';
import { render as renderParts } from '../../src/runtime/server.ts';
import { derived, store } from '../../src/runtime/store.ts';
import type { Store, StoreLike } from '../../src/runtime/store.ts';

/** A store of another library: get, subscribe and set, and not a Store. */
function foreign<T>(value: T): StoreLike<T> & { set(next: T): void; size(): number } {
  const listeners = new Set<(value: T) => void>();
  return {
    get: () => value,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next) {
      value = next;
      for (const listener of listeners) {
        listener(next);
      }
    },
    size: () => listeners.size,
  };
}

describe('derived: forms', () => {
  it('gives a value for one store and a tuple for an array', () => {
    const a = store(1);
    const b = store('x');
    const one = derived(a, (value) => value * 2);
    const many = derived([a, b], ([n, s]) => `${s}${n}`);
    expect(one.get()).toBe(2);
    expect(many.get()).toBe('x1');
    const seen: string[] = [];
    many.subscribe((value) => seen.push(value));
    a.set(2);
    b.set('y');
    expect(seen).toEqual(['x2', 'y2']);
  });

  it('chooses the auto form by fn.length below 2', () => {
    const a = store(1);
    // oxlint-disable-next-line no-unused-vars -- The second parameter selects the async form.
    const manual = derived(a, (value, set) => set(value + 1));
    expect(manual.get()).toBe(2);
    const auto = derived(a, (value) => value + 1);
    expect(auto.get()).toBe(2);
  });

  it('calls set and update in the async form, with a cleanup', () => {
    const a = store(1);
    const log: string[] = [];
    const slow = derived(
      a,
      (value, set, update) => {
        log.push(`run ${value}`);
        set(value * 10);
        update((current) => current + 1);
        return () => log.push(`cleanup ${value}`);
      },
      0,
    );
    const seen: number[] = [];
    const stop = slow.subscribe((value) => seen.push(value));
    expect(log).toEqual(['run 1']);
    expect(slow.get()).toBe(11);
    a.set(2);
    // The cleanup of the old run comes before the next call.
    expect(log).toEqual(['run 1', 'cleanup 1', 'run 2']);
    expect(seen).toEqual([20, 21]);
    stop();
    expect(log).toEqual(['run 1', 'cleanup 1', 'run 2', 'cleanup 2']);
  });

  it('keeps the initial value until set is first called', () => {
    const a = store(1);
    let later: ((value: number) => void) | undefined;
    const slow = derived(
      a,
      (_value, set) => {
        later = set;
      },
      -1,
    );
    expect(slow.get()).toBe(-1);
    const seen: number[] = [];
    slow.subscribe((value) => seen.push(value));
    expect(slow.get()).toBe(-1);
    later!(5);
    expect(slow.get()).toBe(5);
    expect(seen).toEqual([5]);
  });

  it('does not call the listener at subscribe time', () => {
    const a = store(1);
    const listener = vi.fn<(value: number) => void>();
    derived(a, (value) => value).subscribe(listener);
    expect(listener).not.toHaveBeenCalled();
  });

  it('throws for a falsy source', () => {
    expect(() => derived(undefined as never, () => 1)).toThrow(
      'derived() expects stores as input, got a falsy value',
    );
    expect(() => derived([store(1), null as never], () => 1)).toThrow(
      'derived() expects stores as input, got a falsy value',
    );
  });

  it('has no set', () => {
    expect((derived(store(1), (value) => value) as { set?: unknown }).set).toBeUndefined();
  });
});

describe('derived: subscribers', () => {
  it('follows the sources only while it has subscribers', () => {
    const a = store(1);
    const fn = vi.fn<(value: number) => number>((value) => value + 1);
    const plus = derived(a, fn);
    expect(a.l.size).toBe(0);
    const stopOne = plus.subscribe(() => {});
    const stopTwo = plus.subscribe(() => {});
    expect(a.l.size).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
    stopOne();
    expect(a.l.size).toBe(1);
    stopTwo();
    expect(a.l.size).toBe(0);
    // Stopping twice does nothing.
    stopTwo();
    a.set(5);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('computes get from the sources without subscribers, and does not keep them', () => {
    const a = store(1);
    const fn = vi.fn<(value: number) => number>((value) => value + 1);
    const plus = derived(a, fn);
    expect(plus.get()).toBe(2);
    a.set(2);
    expect(plus.get()).toBe(3);
    expect(a.l.size).toBe(0);
  });

  it('runs the async form once for get without subscribers and cleans up', () => {
    const a = store(1);
    const log: string[] = [];
    const slow = derived(
      a,
      (value, set) => {
        log.push(`run ${value}`);
        set(value * 2);
        return () => log.push('cleanup');
      },
      0,
    );
    expect(slow.get()).toBe(2);
    expect(log).toEqual(['run 1', 'cleanup']);
    expect(a.l.size).toBe(0);
  });

  it('reads the current value with subscribers', () => {
    const a = store(1);
    const plus = derived(a, (value) => value + 1);
    plus.subscribe(() => {});
    a.set(4);
    expect(plus.get()).toBe(5);
  });

  it('starts again with the current sources after the last subscriber left', () => {
    const a = store(1);
    const plus = derived(a, (value) => value + 1);
    plus.subscribe(() => {})();
    a.set(7);
    const seen: number[] = [];
    plus.subscribe((value) => seen.push(value));
    expect(plus.get()).toBe(8);
    a.set(8);
    expect(seen).toEqual([9]);
  });
});

describe('derived: updates', () => {
  it('does not notify for an unchanged result (Object.is)', () => {
    const a = store(1);
    const parity = derived(a, (value) => value % 2);
    const seen: number[] = [];
    parity.subscribe((value) => seen.push(value));
    a.set(3);
    a.set(4);
    expect(seen).toEqual([0]);
    // Equal objects by content still notify, since Object.is compares identity.
    const box = derived(a, (value) => ({ value }));
    const boxes: unknown[] = [];
    box.subscribe((value) => boxes.push(value));
    a.set(5);
    expect(boxes).toHaveLength(1);
  });

  it('runs a diamond once per change, with consistent values', () => {
    const a = store(1);
    const double = derived(a, (value) => value * 2);
    const calls: [number, number][] = [];
    const both = derived([a, double], ([plain, doubled]) => {
      calls.push([plain, doubled]);
      return plain + doubled;
    });
    const seen: number[] = [];
    both.subscribe((value) => seen.push(value));
    expect(calls).toEqual([[1, 2]]);
    a.set(2);
    a.set(3);
    expect(calls).toEqual([
      [1, 2],
      [2, 4],
      [3, 6],
    ]);
    expect(seen).toEqual([6, 9]);
  });

  it('runs a diamond once when the derived source is listed first', () => {
    const a = store(1);
    const double = derived(a, (value) => value * 2);
    const calls: [number, number][] = [];
    const both = derived([double, a], ([doubled, plain]) => {
      calls.push([doubled, plain]);
      return doubled + plain;
    });
    both.subscribe(() => {});
    a.set(2);
    expect(calls).toEqual([
      [2, 1],
      [4, 2],
    ]);
  });

  it('runs a deep diamond once', () => {
    const a = store(1);
    const b = derived(a, (value) => value + 1);
    const c = derived(b, (value) => value + 1);
    const calls: number[][] = [];
    const d = derived([a, b, c], (values) => {
      calls.push([...values]);
      return values.length;
    });
    d.subscribe(() => {});
    a.set(10);
    expect(calls).toEqual([
      [1, 2, 3],
      [10, 11, 12],
    ]);
  });

  it('computes after a pass of the page when one is set', () => {
    const pass = vi.fn<(run: () => void) => void>((send) => send());
    (globalThis as { [key: symbol]: unknown })[Symbol.for('brumate.pass')] = pass;
    try {
      const a = store(1);
      const plus = derived(a, (value) => value + 1);
      const seen: number[] = [];
      plus.subscribe((value) => seen.push(value));
      a.set(2);
      expect(seen).toEqual([3]);
      expect(pass).toHaveBeenCalled();
    } finally {
      delete (globalThis as { [key: symbol]: unknown })[Symbol.for('brumate.pass')];
    }
  });

  it('chains derived stores', () => {
    const a = store(1);
    const b = derived(a, (value) => value + 1);
    const c = derived(b, (value) => value * 10);
    const seen: number[] = [];
    c.subscribe((value) => seen.push(value));
    a.set(2);
    expect(seen).toEqual([30]);
    expect(c.get()).toBe(30);
  });

  it('works after a function throws', () => {
    const a = store(1);
    const risky = derived(a, (value) => {
      if (value === 2) {
        throw new Error('two');
      }
      return value;
    });
    const seen: number[] = [];
    risky.subscribe((value) => seen.push(value));
    expect(() => a.set(2)).toThrow('two');
    a.set(3);
    expect(seen).toEqual([3]);
  });
});

describe('derived: errors and late writes', () => {
  it('starts again after fn threw on the first subscribe', () => {
    const a = store(1);
    let fail = true;
    const risky = derived(a, (value) => {
      if (fail) {
        throw new Error('first');
      }
      return value * 2;
    });
    expect(() => risky.subscribe(() => {})).toThrow('first');
    expect(a.l.size).toBe(0);
    fail = false;
    const seen: number[] = [];
    risky.subscribe((value) => seen.push(value));
    a.set(2);
    expect(seen).toEqual([4]);
    expect(risky.get()).toBe(4);
  });

  it('lets the other stores hear again after one threw in a flush', () => {
    const a = store(1);
    const bad = derived(a, (value) => {
      if (value === 2) {
        throw new Error('two');
      }
      return value;
    });
    const good = derived(a, (value) => value * 10);
    const seen: number[] = [];
    bad.subscribe(() => {});
    good.subscribe((value) => seen.push(value));
    expect(() => a.set(2)).toThrow('two');
    a.set(3);
    expect(seen.at(-1)).toBe(30);
    expect(good.get()).toBe(30);
  });

  it('keeps the value of a set that comes after the last unsubscribe', () => {
    const a = store(1);
    let later: ((value: number) => void) | undefined;
    const slow = derived(
      a,
      (_value, set) => {
        later = set;
      },
      0,
    );
    slow.subscribe(() => {})();
    later!(7);
    expect(slow.get()).toBe(7);
  });
});

describe('derived: foreign stores', () => {
  it('reads a foreign StoreLike', () => {
    const outside = foreign(2);
    const square = derived(outside, (value) => value * value);
    const seen: number[] = [];
    const stop = square.subscribe((value) => seen.push(value));
    expect(outside.size()).toBe(1);
    outside.set(3);
    expect(seen).toEqual([9]);
    stop();
    expect(outside.size()).toBe(0);
  });

  it('mixes a Store and a foreign store', () => {
    const a = store(1);
    const outside = foreign(10);
    const sum = derived([a, outside], ([x, y]) => x + y);
    const seen: number[] = [];
    sum.subscribe((value) => seen.push(value));
    a.set(2);
    outside.set(20);
    expect(seen).toEqual([12, 22]);
  });
});

// The render test: a module-level derived read with $store.
const input = resolve(import.meta.dirname, 'derived');
const output = resolve(import.meta.dirname, '../.output/derived');
const file = (name: string): string => pathToFileURL(join(output, name)).href;
const modules = new Map<string, string>();

function toRender(code: string): string {
  return code
    .replace(/\.brm\?brumate-render"/g, '.brm.render.ts"')
    .replace(/\.brm\?brumate-client&part=(\w+)"/g, '.brm.client.$1.ts"')
    .replace(/\.brm\?brumate-client"/g, '.brm.client.ts"');
}

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
  document.body.innerHTML = '';
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

describe('derived: a page', () => {
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

  it('renders on the server, leaves no listener, resumes and updates', async () => {
    const onServer = (await import(file('sources.ts'))) as { cart: Store<number[]> };
    const server = await import(file('derivedReader.brm.ts'));
    const { html, state } = await renderParts(server.default, {});
    expect(html).toContain('>3</p>');
    expect(html).toContain('>2 items, 3</p>');
    // The server render leaves no subscription on the source.
    expect(onServer.cart.l.size).toBe(0);

    document.body.innerHTML = html + state;
    document.body.querySelectorAll('script[b-state]').forEach(run);
    vi.resetModules();
    const { start } = await import('../../src/runtime/loader.ts');
    stop = start({ load: async (id) => import(modules.get(id)!) });
    // The module registry was reset, so the browser's cart is a new module instance.
    const { cart } = (await import(file('sources.ts'))) as { cart: Store<number[]> };
    await vi.waitFor(() => expect(cart.l.size).toBeGreaterThan(0), { timeout: 2000 });

    cart.set([1, 2, 10]);
    await vi.waitFor(() => expect(text('.sum')).toBe('13'), { timeout: 2000 });
    expect(text('.label')).toBe('3 items, 13');
    document.querySelector('.add')!.dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => expect(text('.sum')).toBe('23'), { timeout: 2000 });
    expect(text('.label')).toBe('4 items, 23');
  });
});
