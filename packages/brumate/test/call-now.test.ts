// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { call, callNow, track, whenSettled } from '../src/runtime/client/references.ts';
import { configure, modules } from '../src/runtime/client/state.ts';
import type { ClientModule } from '../src/runtime/client/state.ts';

// A setter of a bound prop runs at once when its code is loaded and no call waits before it.

it('runs a loaded setter again after a call whose code failed to load', async () => {
  const ran: unknown[] = [];
  const loaded = {
    id: 'Loaded',
    props: {},
    g: {},
    setter: (_scope: unknown, value: unknown) => ran.push(value),
  };
  modules.set('Loaded', loaded as unknown as ClientModule);
  configure({
    listen: () => {},
    load: (id) =>
      id === 'Loaded'
        ? Promise.resolve(loaded as unknown as ClientModule)
        : Promise.reject(new Error('chunk failed')),
  });
  expect(callNow('Loaded#setter', undefined, [1])).toBe(true);
  // A call waits for its code, so a setter does not jump ahead of it.
  const failing = call('Broken#fn', undefined, []);
  expect(callNow('Loaded#setter', undefined, [2])).toBe(false);
  await expect(failing).rejects.toThrow('chunk failed');
  // The failed call stopped waiting, so the next setter runs at once.
  expect(callNow('Loaded#setter', undefined, [3])).toBe(true);
  expect(ran).toEqual([1, 3]);
});

it('tells when the setters called so far have settled', async () => {
  // Nothing runs, so a caller acts at once.
  expect(whenSettled()).toBeUndefined();
  // A result that is not a promise is done already.
  track(1);
  expect(whenSettled()).toBeUndefined();
  let finish!: () => void;
  track(
    new Promise<void>((done) => {
      finish = done;
    }),
  );
  const waiting = whenSettled();
  expect(waiting).toBeInstanceOf(Promise);
  let settled = false;
  void waiting!.then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  finish();
  await waiting;
  expect(whenSettled()).toBeUndefined();
});
