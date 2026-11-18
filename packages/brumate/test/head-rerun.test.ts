// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigate } from '../src/runtime/navigate.ts';

const RERUN = '<script data-rerun>window.count++</script>';
const PLAIN = '<script>window.plain++</script>';

function html(body: string, head: string): Response {
  return new Response(`<!doctype html><html><head>${head}</head><body>${body}</body></html>`, {
    headers: { 'content-type': 'text/html' },
  });
}

/** Goes to a page, and returns what the body held each time a head script was added. */
const paths: string[] = [];

async function go(url: string, body: string, head: string, push = true): Promise<string[]> {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => html(body, head)),
  );
  const seen: string[] = [];
  const append = document.head.append.bind(document.head);
  vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
    for (const node of nodes) {
      if (typeof node !== 'string' && (node as Element).matches('script[data-rerun]')) {
        seen.push(document.body.textContent ?? '');
        paths.push(location.pathname);
      }
    }
    append(...nodes);
  });
  await navigate({ url, push, transition: false, leave: async () => {}, enter: () => {} });
  vi.restoreAllMocks();
  return seen;
}

afterEach(() => {
  paths.length = 0;
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('head scripts that ask to run again', () => {
  it('adds a fresh copy after the new body is in place, once', async () => {
    document.head.innerHTML = RERUN + PLAIN;
    const old = document.head.querySelector('script[data-rerun]')!;
    const plain = document.head.querySelector('script:not([data-rerun])')!;
    const seen = await go('/a', '<p>New body</p>', RERUN + PLAIN);
    const copies = document.head.querySelectorAll('script[data-rerun]');
    expect(copies).toHaveLength(1);
    expect(copies[0]).not.toBe(old);
    expect(copies[0].textContent).toBe('window.count++');
    expect(seen).toEqual(['New body']);
    // A script without the attribute stays as it is.
    expect(document.head.querySelector('script:not([data-rerun])')).toBe(plain);
    expect(document.head.querySelectorAll('script')).toHaveLength(2);
  });

  it('runs on every navigation between pages that have it', async () => {
    document.head.innerHTML = RERUN;
    expect(await go('/a', '<p>A</p>', RERUN)).toEqual(['A']);
    expect(await go('/b', '<p>B</p>', RERUN)).toEqual(['B']);
    expect(document.head.querySelectorAll('script[data-rerun]')).toHaveLength(1);
  });

  it('runs a script that is new to the page, and removes it on a page without it', async () => {
    expect(await go('/a', '<p>A</p>', RERUN)).toEqual(['A']);
    expect(document.head.querySelectorAll('script[data-rerun]')).toHaveLength(1);
    expect(await go('/b', '<p>B</p>', '')).toEqual([]);
    expect(document.head.querySelectorAll('script[data-rerun]')).toHaveLength(0);
  });

  it('runs a script that another root layout sent, as one that is new', async () => {
    document.head.innerHTML = '<script data-rerun>window.a++</script>';
    const seen = await go('/other', '<p>Other</p>', '<script data-rerun>window.b++</script>');
    const scripts = [...document.head.querySelectorAll('script')];
    expect(scripts.map((script) => script.textContent)).toEqual(['window.b++']);
    expect(seen).toEqual(['Other']);
  });

  it('gives the copy the nonce of the loaded page', async () => {
    document.head.innerHTML = '<script nonce="loaded">0</script>';
    await go('/a', '<p>A</p>', '<script data-rerun nonce="next">window.count++</script>');
    const copy = document.head.querySelector<HTMLScriptElement>('script[data-rerun]')!;
    expect(copy.nonce).toBe('loaded');
  });

  it('sees the new URL, also on a back or forward navigation', async () => {
    document.head.innerHTML = RERUN;
    await go('/pushed', '<p>A</p>', RERUN);
    expect(paths).toEqual(['/pushed']);
    await go('/popped', '<p>B</p>', RERUN, false);
    expect(paths).toEqual(['/pushed', '/popped']);
    expect(document.head.querySelectorAll('script[data-rerun]')).toHaveLength(1);
  });

  it('copies a script with src, removes the old copy and keeps the nonce', async () => {
    document.head.innerHTML =
      '<script nonce="loaded">0</script><script data-rerun src="/a.js"></script>';
    const head = '<script data-rerun src="/a.js" nonce="next"></script>';
    const seen = await go('/a', '<p>A</p>', head);
    const copies = document.head.querySelectorAll<HTMLScriptElement>('script[data-rerun]');
    expect(copies).toHaveLength(1);
    expect(copies[0].getAttribute('src')).toBe('/a.js');
    expect(copies[0].nonce).toBe('loaded');
    expect(seen).toEqual(['A']);
  });
});
