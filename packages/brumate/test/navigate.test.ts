// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigate, prefetch } from '../src/runtime/navigate.ts';

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
    pageState(next, layout)
  );
}

/** A `<main>` with one route in the children slot of a layout. */
function region(layout: number, route: string, content: string): string {
  return `<main><!--R${layout}:children:${layout + 1}:${encodeURIComponent(route)}-->${content}<!--/R--></main>`;
}

/** The first state record of a page with a root route. `base` is where its IDs start. */
function pageState(next: number, base = 0, nonce = ''): string {
  const root = base > 0 ? ` data-root="${base}"` : '';
  const attribute = nonce ? ` nonce="${nonce}"` : '';
  return `<script${attribute} data-state data-scopes data-next="${next}" data-route="root"${root}>$bR(($R,$b)=>({}))</script>`;
}

/** Navigates to a page whose body is its URL. */
async function visit(url: string, push: boolean, transition: boolean): Promise<void> {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(`<!doctype html><html><body><p>${url}</p></body></html>`, {
          headers: { 'content-type': 'text/html' },
        }),
    ),
  );
  await navigate({ url, push, transition, leave: async () => {}, enter: () => {} });
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

  it('gives the swap scripts of a later page the nonce of the loaded page', async () => {
    vi.resetModules();
    const fresh = await import('../src/runtime/navigate.ts');
    document.head.innerHTML = '<script nonce="loaded-nonce">/* the loaded page */</script>';
    document.body.innerHTML = '<p>old page</p>';
    const { response, next } = respond([
      '<!doctype html><html><head></head><body><p>Loading</p></body></html>',
      '<template data-l="0"><p>Ready</p></template><script nonce="new-nonce">swap(0)</script>',
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response),
    );
    const done = fresh.navigate({
      url: '/next',
      push: true,
      leave: async () => {},
      enter: () => {},
    });
    next();
    await tick();
    next();
    next();
    await done;
    const script = document.body.querySelector('script')!;
    expect(script.textContent).toBe('swap(0)');
    // The policy of the loaded page allows its own nonce only.
    expect(script.nonce).toBe('loaded-nonce');
  });

  it('runs the state records of a later page with the nonce of the loaded page', async () => {
    vi.resetModules();
    const fresh = await import('../src/runtime/navigate.ts');
    document.head.innerHTML = '<script nonce="loaded-nonce">/* the loaded page */</script>';
    document.body.innerHTML = '<p>old page</p>';
    const { response, next } = respond([
      `<!doctype html><html><head></head><body><p>New</p>${pageState(3, 0, 'new-nonce')}</body></html>`,
      '<script nonce="new-nonce" data-state>$bR(($R,$b)=>(1))</script>',
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response),
    );
    const done = fresh.navigate({
      url: '/next',
      push: true,
      leave: async () => {},
      enter: () => {},
    });
    next();
    await tick();
    next();
    next();
    await done;
    // Both records are scripts that this document made, so the browser runs them, in order.
    const scripts = [...document.body.querySelectorAll<HTMLScriptElement>('script[data-state]')];
    expect(scripts.map((script) => script.nonce)).toEqual(['loaded-nonce', 'loaded-nonce']);
    expect(scripts[0]!.getAttribute('data-next')).toBe('3');
    expect(scripts[1]!.textContent).toBe('$bR(($R,$b)=>(1))');
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
    const state = document.querySelectorAll('script[data-state]')[1]!;
    expect(state.getAttribute('data-drop')).toBe('1');
    expect(state.getAttribute('data-roots')).toBe('3');
    expect(state.getAttribute('data-alias')).toBe('2:0');
    // A copy, which the browser runs, so the core reads it.
    expect(state.ownerDocument).toBe(document);
    expect(state.textContent).toBe('$bR(($R,$b)=>({}))');
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
          `<!doctype html><html><head><title>B</title></head><body>${region(2, '/b', '<p>b</p>')}<aside><b s-b1>Badge</b></aside>${pageState(4, 2)}</body></html>`,
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

  it('keeps the layouts of a page that starts its IDs at 0, by moving its IDs', async () => {
    document.head.innerHTML = '<title>A</title>';
    document.body.innerHTML = page(0, '/a', 2);
    const nav = document.querySelector('nav');
    // A static file renders its IDs from 0, whatever the request asks for.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const { response, next } = respond([
          `<!doctype html><html><head><title>B</title></head><body>${page(0, '/b', 2)}</body></html>`,
          '<template data-l="1"><p data-b="1:0">later</p></template><script>$bS(1)</script>',
        ]);
        next();
        next();
        next();
        return response;
      }),
    );
    let partial: boolean | undefined;
    await navigate({
      url: '/b',
      push: true,
      leave: async (value) => {
        partial = value;
      },
      enter: () => {},
    });
    expect(partial).toBe(true);
    expect(document.querySelector('nav')).toBe(nav);
    // The IDs of the new route start above the IDs of the page: 2.
    expect(document.querySelector('main')!.innerHTML).toBe(
      `<!--R2:children:3:${encodeURIComponent('/b')}--><p>/b</p><!--/R-->`,
    );
    const state = document.querySelectorAll('script[data-state]')[1]!;
    expect(state.getAttribute('data-offset')).toBe('2');
    expect(state.getAttribute('data-root')).toBe('2');
    expect(state.getAttribute('data-next')).toBe('4');
    // Markup that streams in later moves too.
    expect(document.querySelector('template')?.getAttribute('data-l')).toBe('3');
    expect(
      document.querySelector('template')!.content.querySelector('p')?.getAttribute('data-b'),
    ).toBe('3:0');
    expect(document.body.querySelector('script:not([data-state])')?.textContent).toBe('$bS(3)');
  });

  it('uses a page that its link started to load', async () => {
    document.head.innerHTML = '<title>A</title>';
    document.body.innerHTML = '<p>a</p>';
    const fetch = vi.fn<() => Promise<Response>>(async () => {
      const { response, next } = respond([
        '<!doctype html><html><head><title>Early</title></head><body><p>early</p></body></html>',
      ]);
      next();
      next();
      return response;
    });
    vi.stubGlobal('fetch', fetch);
    prefetch('http://localhost:3000/early#top');
    await navigate({
      url: 'http://localhost:3000/early',
      push: true,
      leave: async () => {},
      enter: () => {},
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(document.title).toBe('Early');
    // The page was used, so the next visit loads it again.
    await navigate({
      url: 'http://localhost:3000/early',
      push: true,
      leave: async () => {},
      enter: () => {},
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('settles without an error when a later navigation stops it', async () => {
    document.head.innerHTML = '<title>A</title>';
    document.body.innerHTML = '<p>a</p>';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (url: string, init: RequestInit) =>
          new Promise<Response>((resolve, reject) => {
            if (url.endsWith('/slow')) {
              init.signal!.addEventListener('abort', () =>
                reject(new DOMException('Aborted', 'AbortError')),
              );
              return;
            }
            resolve(
              new Response('<!doctype html><html><body><p>fast</p></body></html>', {
                headers: { 'content-type': 'text/html' },
              }),
            );
          }),
      ),
    );
    const slow = navigate({ url: '/slow', push: true, leave: async () => {}, enter: () => {} });
    await navigate({ url: '/fast', push: true, leave: async () => {}, enter: () => {} });
    await expect(slow).resolves.toBeUndefined();
    expect(document.body.textContent).toBe('fast');
  });

  it('stops pages that loaded early when a navigation does not use them', async () => {
    document.head.innerHTML = '<title>A</title>';
    document.body.innerHTML = '<p>a</p>';
    const signals = new Map<string, AbortSignal>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        signals.set(url, init.signal!);
        return new Response('<!doctype html><html><body><p>page</p></body></html>', {
          headers: { 'content-type': 'text/html' },
        });
      }),
    );
    prefetch('http://localhost:3000/unused');
    await navigate({
      url: 'http://localhost:3000/other',
      push: true,
      leave: async () => {},
      enter: () => {},
    });
    expect(signals.get('http://localhost:3000/unused')!.aborted).toBe(true);
    expect(signals.get('http://localhost:3000/other')!.aborted).toBe(false);
  });

  it('swaps the page inside a view transition, with the type of the visit', async () => {
    document.head.innerHTML = '<title>A</title>';
    document.body.innerHTML = '<p>old</p>';
    const seen: { types?: string[]; before: string; after: string }[] = [];
    // A browser with types of view transitions has them on the prototype.
    vi.stubGlobal(
      'ViewTransition',
      class {
        get types(): Set<string> {
          return new Set();
        }
      },
    );
    document.startViewTransition = ((options: { update: () => void; types: string[] }) => {
      const entry = { types: options.types, before: document.body.textContent!, after: '' };
      options.update();
      entry.after = document.body.textContent!;
      seen.push(entry);
      return { updateCallbackDone: Promise.resolve() };
    }) as never;
    await visit('/b', true, true);
    await visit('/a', false, true);
    // Without the option, the page swaps at once.
    await visit('/c', true, false);
    expect(seen).toEqual([
      { types: ['push'], before: 'old', after: '/b' },
      { types: ['traverse'], before: '/b', after: '/a' },
    ]);
    expect(document.body.textContent).toBe('/c');
    delete (document as { startViewTransition?: unknown }).startViewTransition;
  });
});
