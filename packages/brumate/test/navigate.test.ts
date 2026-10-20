// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigate } from '../src/runtime/navigate.ts';

/** A response that sends its body in the given pieces, one at a time. */
function respond(
  pieces: string[],
  init: ResponseInit = {},
): { response: Response; next: () => void } {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
    },
  });
  const encoder = new TextEncoder();
  let index = 0;
  const next = (): void => {
    if (index < pieces.length) {
      controller.enqueue(encoder.encode(pieces[index++]));
    } else {
      controller.close();
    }
  };
  const response = new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    ...init,
  });
  return { response, next };
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('navigate', () => {
  it('swaps in the first render, then streams later markup into the body', async () => {
    document.head.innerHTML = '<title>Old</title><style data-brm="Old">a{}</style>';
    document.body.innerHTML = '<p>old page</p>';
    const { response, next } = respond([
      '<!doctype html><html lang="en"><head><title>New</title><style data-brm="New">b{}</style>',
      '</head><body><p class="fallback">Loading</p></body></ht',
      'ml><template data-l="0"><p class="later">Ready</p></templ',
      'ate><script>window.swapped = (window.swapped ?? 0) + 1</script>',
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response),
    );
    const calls: string[] = [];
    const done = navigate({
      url: '/next',
      push: true,
      leave: async () => {
        calls.push(`leave:${document.body.textContent}`);
      },
      enter: () => {
        calls.push(`enter:${document.body.textContent}`);
      },
    });
    next();
    await tick();
    next();
    await tick();
    // Nothing changes before the whole first render has arrived, up to </html>.
    expect(document.body.textContent).toBe('old page');
    next();
    await tick();
    expect(calls).toEqual(['leave:old page', 'enter:Loading']);
    expect(document.title).toBe('New');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.head.innerHTML).toBe('<title>New</title><style data-brm="New">b{}</style>');
    expect(location.pathname).toBe('/next');
    // Later markup arrives in pieces, and a node moves in once it is complete.
    expect(document.body.querySelector('template')).toBeNull();
    next();
    await tick();
    expect(document.body.querySelector('template[data-l="0"]')).not.toBeNull();
    next();
    await done;
    // Inline scripts are made again, so the browser runs them. The DOM environment of the tests does not run them.
    const script = document.body.querySelector('script');
    expect(script?.textContent).toBe('window.swapped = (window.swapped ?? 0) + 1');
    expect(script?.ownerDocument).toBe(document);
  });

  it('shows the error of a form post as text', async () => {
    const response = new Response('Enter a <name>', {
      status: 422,
      headers: { 'content-type': 'text/plain' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response),
    );
    await navigate({
      url: '/_brumate/x',
      init: { method: 'POST', body: new FormData() },
      push: true,
      leave: async () => {},
      enter: () => {},
    });
    expect(document.body.innerHTML).toBe('<pre>Enter a &lt;name&gt;</pre>');
  });
});
