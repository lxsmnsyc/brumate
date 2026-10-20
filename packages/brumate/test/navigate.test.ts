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

/** A page with a layout scope, one route in its children slot, and its state. */
function page(layout: number, route: string, next: number): string {
  return (
    `<nav data-b="${layout}:0">Menu</nav>` +
    `<main><!--R${layout}:children:${layout + 1}:${encodeURIComponent(route)}--><p>${route}</p><!--/R--></main>` +
    `<script type="brumate/state" data-scopes data-next="${next}" data-route="root">{}</script>`
  );
}

/** A `<main>` with one route in the children slot of a layout. */
function region(layout: number, route: string, content: string): string {
  return `<main><!--R${layout}:children:${layout + 1}:${encodeURIComponent(route)}-->${content}<!--/R--></main>`;
}

/** The first state record of a page with a root route. */
function pageState(next: number): string {
  return `<script type="brumate/state" data-scopes data-next="${next}" data-route="root">{}</script>`;
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

  it('keeps the layouts that stay, and replaces only the routes that change', async () => {
    document.head.innerHTML = '<title>A</title>';
    document.body.innerHTML = page(0, '/a', 2);
    const nav = document.querySelector('nav');
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => {
      const { response, next } = respond([
        `<!doctype html><html><head><title>B</title></head><body>${page(2, '/b', 4)}</body></html>`,
      ]);
      next();
      next();
      return response;
    });
    vi.stubGlobal('fetch', fetch);
    let partial: boolean | undefined;
    await navigate({
      url: '/b',
      push: true,
      leave: async (value) => {
        partial = value;
      },
      enter: () => {},
    });
    // The server starts the new page above the IDs of this one.
    expect(new Headers(fetch.mock.calls[0]![1].headers).get('x-brumate-base')).toBe('2');
    expect(partial).toBe(true);
    expect(document.querySelector('nav')).toBe(nav);
    expect(document.querySelector('main')!.innerHTML).toBe(
      `<!--R2:children:3:${encodeURIComponent('/b')}--><p>/b</p><!--/R-->`,
    );
    // The core drops the old route, adds the new one, and reads the new layout scope as the old one.
    const state = document.querySelectorAll('script[type="brumate/state"]')[1]!;
    expect(state.getAttribute('data-drop')).toBe('1');
    expect(state.getAttribute('data-roots')).toBe('3');
    expect(state.getAttribute('data-alias')).toBe('2:0');
    expect(document.title).toBe('B');
  });

  it('keeps the stylesheets of components that kept layouts still show', async () => {
    document.head.innerHTML = '<title>A</title>';
    // The old route holds the stylesheets of Badge, which the layout also shows, and of Card.
    document.body.innerHTML =
      region(
        0,
        '/a',
        '<style data-brm="Badge_b1">b{}</style><style data-brm="Card_c1">c{}</style><p>a</p>',
      ) + `<aside><b s-b1>Badge</b></aside>${pageState(2)}`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const { response, next } = respond([
          `<!doctype html><html><head><title>B</title></head><body>${region(2, '/b', '<p>b</p>')}<aside><b s-b1>Badge</b></aside>${pageState(4)}</body></html>`,
        ]);
        next();
        next();
        return response;
      }),
    );
    await navigate({ url: '/b', push: true, leave: async () => {}, enter: () => {} });
    expect(document.head.querySelector('style[data-brm="Badge_b1"]')).not.toBeNull();
    expect(document.querySelector('style[data-brm="Card_c1"]')).toBeNull();
  });
});
