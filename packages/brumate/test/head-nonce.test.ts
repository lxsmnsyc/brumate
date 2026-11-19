// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigate } from '../src/runtime/navigate.ts';

// The browser hides the nonce of a loaded element, so the live copy has an empty one.
const LIVE = [
  '<style nonce="">p{color:red}</style>',
  '<link rel="alternate" href="/a.xml" nonce="">',
  '<script nonce="">window.count++</script>',
].join('');
const NEXT = [
  '<style nonce="n2">p{color:red}</style>',
  '<link rel="alternate" href="/a.xml" nonce="n2">',
  '<script nonce="n2">window.count++</script>',
].join('');

async function go(head: string): Promise<void> {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(`<!doctype html><html><head>${head}</head><body><p>B</p></body></html>`, {
          headers: { 'content-type': 'text/html' },
        }),
    ),
  );
  await navigate({
    url: '/a',
    push: true,
    transition: false,
    leave: async () => {},
    enter: () => {},
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('head elements with a CSP nonce', () => {
  it('keeps the elements that only differ in the nonce', async () => {
    document.head.innerHTML = LIVE;
    const before = [...document.head.children];
    await go(NEXT);
    for (const element of before) {
      expect(element.isConnected).toBe(true);
    }
    expect(document.head.querySelectorAll('style, link, script')).toHaveLength(3);
  });

  it('does not run a nonce script again without data-rerun', async () => {
    document.head.innerHTML = LIVE;
    const script = document.head.querySelector('script')!;
    await go(NEXT);
    expect(document.head.querySelectorAll('script')).toHaveLength(1);
    expect(document.head.querySelector('script')).toBe(script);
  });

  it('still replaces an element whose content changed', async () => {
    document.head.innerHTML = LIVE;
    await go(NEXT.replace('color:red', 'color:blue'));
    expect(document.head.querySelector('style')!.textContent).toBe('p{color:blue}');
    expect(document.head.querySelectorAll('style')).toHaveLength(1);
  });
});
