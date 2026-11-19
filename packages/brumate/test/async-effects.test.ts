// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compile } from '../src/index.ts';
import { asyncEffect } from '../src/runtime/client/async-effect.ts';
import { configure, scopes } from '../src/runtime/client/state.ts';
import type { Scope } from '../src/runtime/client/state.ts';
import { NotReady, effect } from '../src/runtime/client/updates.ts';

/** A promise that the test settles. */
function defer<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** Lets the microtasks that a settled promise started run. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 10; turn++) {
    // oxlint-disable-next-line no-await-in-loop -- Each turn lets the next microtask run.
    await Promise.resolve();
  }
}

let scope: Scope;
let errors: unknown[];
let log: string[];

beforeEach(() => {
  errors = [];
  log = [];
  configure({ listen: () => {}, load: () => undefined, onError: (error) => errors.push(error) });
  scope = { id: 1, k: 0, s: [] };
  scopes.set(1, scope);
  // Without a `#try`, a failure is logged.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  scopes.clear();
  vi.restoreAllMocks();
});

/** What the page does when a scope goes, a body hides or a page is left. */
function cleanUp(): void {
  for (const cleanup of scope.cleanups?.values() ?? []) {
    cleanup();
  }
}

describe('the compiler', () => {
  const header = `<script>\n  import { $client, $effect, $signal } from 'brumate/signals';\n  let n = $signal(0);\n`;
  const markup = '</script>\n<button onClick=(() => (n = n + 1))>{n}</button>';

  it('calls asyncEffect for an async $effect and $client callback', () => {
    const { clientCode, parts } = compile(
      `${header}  $effect(async () => { await Promise.resolve(); console.log(n); });\n  $client(async () => { await Promise.resolve(); });\n${markup}`,
      { filename: 'T.brm' },
    );
    const code = clientCode + Object.values(parts).join('\n');
    expect(code).toMatch(/\$\$b\.asyncEffect\(\$\$s, "e\d+"/);
    expect(code).toMatch(/\$\$b\.asyncEffect\(\$\$s, "c\d+"[^]*, 1\)/);
    expect(code).not.toContain('$$b.effect(');
  });

  it('calls effect for sync callbacks, so a page without an async effect has no asyncEffect', () => {
    const { clientCode, parts } = compile(
      `${header}  $effect(() => { console.log(n); });\n  $client(() => {});\n${markup}`,
      { filename: 'T.brm' },
    );
    const code = clientCode + Object.values(parts).join('\n');
    expect(code).toContain('$$b.effect(');
    expect(code).not.toContain('asyncEffect');
  });

  it('takes a read after an await as a dependency of the effect', () => {
    const { clientCode, parts } = compile(
      `${header}  $effect(async () => { await Promise.resolve(); console.log(n); });\n${markup}`,
      { filename: 'T.brm' },
    );
    const code = clientCode + Object.values(parts).join('\n');
    // The write of the handler runs the effect.
    expect(code).toMatch(/asyncEffect\(\$\$s, "e\d+"/);
    expect(code).toMatch(/\$\$b\.set\(/);
  });
});

describe('asyncEffect', () => {
  it('cleans a run that goes stale as soon as it settles', async () => {
    const first = defer<() => void>();
    asyncEffect(scope, 'e', () => first.promise);
    // A change while it is pending makes it stale.
    asyncEffect(scope, 'e', async () => () => log.push('second cleanup'));
    first.resolve(() => log.push('first cleanup'));
    await settle();
    // The first cleans before the second starts, and the second has not been cleaned.
    expect(log).toEqual(['first cleanup']);
  });

  it('cleans a pending run when the scope goes, and does not wait for it', async () => {
    const run = defer<() => void>();
    asyncEffect(scope, 'e', () => run.promise);
    cleanUp();
    scopes.delete(1);
    // Nothing waited: the cleanup of the scope returned with the run still pending.
    expect(log).toEqual([]);
    run.resolve(() => log.push('cleanup'));
    await settle();
    expect(log).toEqual(['cleanup']);
  });

  it('does not start the run that waited when the scope went', async () => {
    const run = defer();
    asyncEffect(scope, 'e', async () => {
      log.push('run');
      await run.promise;
    });
    asyncEffect(scope, 'e', async () => {
      log.push('again');
    });
    cleanUp();
    scopes.delete(1);
    run.resolve();
    await settle();
    expect(log).toEqual(['run']);
  });

  it('makes one run of the changes while a cleanup is pending', async () => {
    const cleanup = defer();
    asyncEffect(scope, 'e', async () => async () => {
      log.push('cleanup start');
      await cleanup.promise;
      log.push('cleanup end');
    });
    await settle();
    const callback = async (): Promise<void> => {
      log.push('run');
    };
    asyncEffect(scope, 'e', callback);
    asyncEffect(scope, 'e', callback);
    asyncEffect(scope, 'e', callback);
    await settle();
    expect(log).toEqual(['cleanup start']);
    cleanup.resolve();
    await settle();
    expect(log).toEqual(['cleanup start', 'cleanup end', 'run']);
  });

  it('starts the run after the run before it settles, with the values of that moment', async () => {
    let value = 'a';
    const run = defer();
    asyncEffect(scope, 'e', async () => {
      log.push(`read ${value}`);
      await run.promise;
    });
    value = 'b';
    asyncEffect(scope, 'e', async () => {
      log.push(`read ${value}`);
    });
    value = 'c';
    asyncEffect(scope, 'e', async () => {
      log.push(`read ${value}`);
    });
    run.resolve();
    await settle();
    expect(log).toEqual(['read a', 'read c']);
  });

  it('sends a rejection of the run to the scope', async () => {
    const reason = new Error('Run failed');
    asyncEffect(scope, 'e', async () => {
      await Promise.resolve();
      throw reason;
    });
    await settle();
    expect(errors).toEqual([reason]);
    // The effect runs again on the next change.
    asyncEffect(scope, 'e', async () => {
      log.push('run');
    });
    await settle();
    expect(log).toEqual(['run']);
  });

  it('sends a rejection of the cleanup to the scope', async () => {
    const reason = new Error('Cleanup failed');
    asyncEffect(scope, 'e', async () => async () => {
      throw reason;
    });
    await settle();
    asyncEffect(scope, 'e', async () => {
      log.push('run');
    });
    await settle();
    expect(errors).toEqual([reason]);
    // The failed cleanup does not stop the next run.
    expect(log).toEqual(['run']);
  });

  it('sends a rejection of the cleanup of a scope that goes to the scope', async () => {
    const reason = new Error('Cleanup failed');
    asyncEffect(scope, 'e', async () => () => Promise.reject(reason));
    await settle();
    cleanUp();
    await settle();
    expect(errors).toEqual([reason]);
  });

  describe('cleanup forms', () => {
    const forms: [string, () => unknown][] = [
      ['a function', () => () => log.push('cleanup')],
      [
        'an async function',
        () => async () => {
          await Promise.resolve();
          log.push('cleanup');
        },
      ],
      ['a disposable', () => ({ [Symbol.dispose]: () => log.push('cleanup') })],
      [
        'an async disposable',
        () => ({
          async [Symbol.asyncDispose]() {
            await Promise.resolve();
            log.push('cleanup');
          },
        }),
      ],
      ['no cleanup', () => undefined],
    ];

    it.each(forms)('runs %s from an async effect', async (_, make) => {
      asyncEffect(scope, 'e', async () => make());
      await settle();
      cleanUp();
      await settle();
      expect(log).toEqual(make() === undefined ? [] : ['cleanup']);
    });

    it.each(forms)('runs %s from a sync effect', async (_, make) => {
      effect(scope, 'e', () => make());
      cleanUp();
      await settle();
      expect(log).toEqual(make() === undefined ? [] : ['cleanup']);
    });

    it('sends a rejection of an async cleanup of a sync effect to the scope', async () => {
      const reason = new Error('Cleanup failed');
      effect(scope, 'e', () => async () => {
        throw reason;
      });
      cleanUp();
      await settle();
      expect(errors).toEqual([reason]);
    });
  });

  it('runs the cleanup of a hidden body at once, and waits for it when the body shows', async () => {
    const cleanup = defer();
    const callback = async (): Promise<() => Promise<void>> => {
      log.push('run');
      return async () => {
        log.push('cleanup start');
        await cleanup.promise;
        log.push('cleanup end');
      };
    };
    asyncEffect(scope, 'e', callback);
    await settle();
    // The body hides, which calls the cleanups and forgets them.
    cleanUp();
    scope.cleanups?.clear();
    expect(log).toEqual(['run', 'cleanup start']);
    // The body shows before the cleanup settled.
    asyncEffect(scope, 'e', callback);
    await settle();
    expect(log).toEqual(['run', 'cleanup start']);
    cleanup.resolve();
    await settle();
    expect(log).toEqual(['run', 'cleanup start', 'cleanup end', 'run']);
  });

  it('runs a $client callback once, and again when a body shows', async () => {
    asyncEffect(scope, 'c', async () => () => log.push('cleanup'), true);
    await settle();
    expect(log).toEqual([]);
    cleanUp();
    await settle();
    asyncEffect(scope, 'c', async () => () => log.push('cleanup'), true);
    await settle();
    cleanUp();
    expect(log).toEqual(['cleanup', 'cleanup']);
  });

  describe('a value that is still loading', () => {
    it('skips a run that reads it before the first await, and runs it when it arrives', async () => {
      const load = defer();
      let ready = false;
      asyncEffect(scope, 'e', async () => {
        if (!ready) {
          throw new NotReady(load.promise);
        }
        log.push('run');
      });
      await settle();
      expect(log).toEqual([]);
      expect(errors).toEqual([]);
      ready = true;
      load.resolve();
      await vi.waitFor(() => expect(log).toEqual(['run']));
    });

    it('sends the failure of the value to the scope', async () => {
      const reason = new Error('Load failed');
      const load = Promise.reject(reason);
      asyncEffect(scope, 'e', async () => {
        throw new NotReady(load);
      });
      await settle();
      expect(errors).toEqual([reason]);
    });

    it('sends a read after an await to the scope, as the read of a handler does', async () => {
      const reason = new Error('Read failed after await');
      asyncEffect(scope, 'e', async () => {
        await Promise.resolve();
        // After the first `await`, nothing counts as running, so a read throws its own error.
        throw reason;
      });
      await settle();
      expect(errors).toEqual([reason]);
      expect(log).toEqual([]);
    });
  });
});
