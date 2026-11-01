// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { hotLoad } from '../src/runtime/hot.ts';
import type { HotContext, HotUpdate } from '../src/runtime/hot.ts';

/** A stand-in for `import.meta.hot`, which sends updates when the test asks. */
function hotContext(): HotContext & { send: (updates: HotUpdate[]) => void } {
  let listener: ((data: { updates: HotUpdate[]; timestamp: number }) => void) | undefined;
  return {
    on: (_, callback) => {
      listener = callback;
    },
    send: (updates) => listener?.({ updates, timestamp: 42 }),
  };
}

describe('hot updates', () => {
  it('replaces the styles of a component that changed', () => {
    document.head.innerHTML = '<style b-style="Card_1">p{color:red}</style>';
    const hot = hotContext();
    hotLoad(hot, vi.fn<(id: string) => Promise<never>>());
    hot.send([{ id: 'Card_1', css: 'p{color:blue}' }]);
    expect(document.querySelector('style')!.textContent).toBe('p{color:blue}');
  });

  it('tells the core which components changed, and loads their new entry', async () => {
    const hot = hotContext();
    const load = vi.fn<(id: string) => Promise<never>>(async () => ({ id: 'Card_1' }) as never);
    const wrapped = hotLoad(hot, load);
    const changed = vi.fn<(ids: string[]) => void>();
    document.addEventListener('brumate:hot', (event) => changed((event as CustomEvent).detail));
    hot.send([{ id: 'Card_1', url: '/src/Card.brm?brumate-client' }]);
    expect(changed).toHaveBeenCalledWith(['Card_1']);
    // The new entry has the time of the update in its URL, so the browser does not reuse the old one.
    await expect(wrapped('Card_1')).rejects.toThrow(/Card\.brm\?brumate-client&t=42/);
    await wrapped('Other_2');
    expect(load).toHaveBeenCalledWith('Other_2');
  });

  it('leaves load alone without a dev server', () => {
    const load = vi.fn<(id: string) => Promise<never>>();
    expect(hotLoad(undefined, load)).toBe(load);
  });

  it('makes the core load a changed component again', async () => {
    const client = await import('../src/runtime/client.ts');
    let version = 0;
    const load = vi.fn<(id: string) => Promise<never>>(
      async () => ({ id: 'Card_1', props: {}, g: {}, version: ++version }) as never,
    );
    client.init({ load, listen: () => {} });
    await client.loadModule('Card_1');
    await client.loadModule('Card_1');
    expect(load).toHaveBeenCalledTimes(1);
    client.forget(['Card_1']);
    expect(await client.loadModule('Card_1')).toMatchObject({ version: 2 });
    client.dispose();
  });
});
