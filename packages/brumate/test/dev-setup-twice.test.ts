// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { installDevtools } from '../src/runtime/devtools.ts';
import { hotLoad } from '../src/runtime/hot.ts';

describe('an entry that sets up hot updates and the devtools itself', () => {
  it('listens once and installs one set of devtools, after the plugin did too', () => {
    const on = vi.fn<(event: string, listener: () => void) => void>();
    const load = vi.fn<(id: string) => Promise<never>>(() => Promise.resolve({}) as never);
    // The entry wraps its load, and the plugin wraps it again.
    const once = hotLoad({ on } as never, load);
    const twice = hotLoad({ on } as never, once);
    expect(twice).toBe(once);
    expect(on).toHaveBeenCalledTimes(1);

    const first = installDevtools('/inspect');
    const fetchAfterFirst = globalThis.fetch;
    const second = installDevtools('/inspect');
    expect(second).toBe(first);
    expect(globalThis.fetch).toBe(fetchAfterFirst);
    expect(document.querySelectorAll('brumate-devtools')).toHaveLength(1);
  });

  it('wraps fetch once when an install replaces one whose host was removed', async () => {
    const original = globalThis.fetch;
    const response = new Response('{}');
    // Each wrapper reads a clone of the response, so the clones count the wrappers.
    const clone = vi.spyOn(response, 'clone');
    const calls = vi.fn<() => Promise<Response>>(() => Promise.resolve(response));
    globalThis.fetch = calls as never;
    try {
      // Another test may have installed already; start from a removed host.
      for (const host of document.querySelectorAll('brumate-devtools')) {
        host.remove();
      }
      const first = installDevtools('/inspect', '/_rpc');
      document.querySelector('brumate-devtools')!.remove();
      const second = installDevtools('/inspect', '/_rpc');
      expect(second).not.toBe(first);
      expect(document.querySelectorAll('brumate-devtools')).toHaveLength(1);
      await fetch('/_rpc/save', { method: 'POST' });
      // One wrapper over the stub, not a wrapper over the first install's wrapper.
      expect(calls).toHaveBeenCalledTimes(1);
      expect(clone).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
