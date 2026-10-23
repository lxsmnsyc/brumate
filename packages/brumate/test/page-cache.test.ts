import { afterEach, describe, expect, it, vi } from 'vitest';
import { cached, memoryStore, revalidate, setCacheStore } from '../src/runtime/cache.ts';
import { getEvent } from '../src/runtime/request.ts';
import { handleRoute, insert } from '../src/runtime/server.ts';
import type { PageCache, RouteOptions } from '../src/runtime/server.ts';

/** A component that renders `html`, after `run` for the request. */
function component(html: string, run?: () => void) {
  return Object.assign(
    async () => {
      run?.();
      return html;
    },
    { brumateId: `Page_${html.length}` },
  );
}

/** A route tree with a page, and a layout around it when it has a `cache` of its own. */
function tree(page: { run?: () => void; cache?: PageCache }, layoutCache?: PageCache) {
  const layout = Object.assign(
    async (props: { children: unknown }, ctx: never) =>
      `<main>${await insert(props.children, ctx)}</main>`,
    { brumateId: 'Layout_1' },
  );
  return {
    ...(layoutCache ? { layout: async () => ({ default: layout, cache: layoutCache }) } : {}),
    page: async () => ({ default: component('<h1>Hi</h1>', page.run), cache: page.cache }),
  };
}

async function answer(
  routes: ReturnType<typeof tree>,
  init: RequestInit = {},
  options: RouteOptions = {},
): Promise<Response> {
  return (await handleRoute(routes as never, new Request('https://example.com/', init), options))!;
}

// Each test starts with an empty store, so no page that another test kept answers it.
afterEach(() => {
  setCacheStore(memoryStore());
});

describe('cache of pages', () => {
  it('sends public cache-control for a page that exports cache', async () => {
    const response = await answer(tree({ cache: { maxAge: 60, staleWhileRevalidate: 600 } }));
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=60, stale-while-revalidate=600',
    );
    expect(await response.text()).toContain('<h1>Hi</h1>');
  });

  it('takes the cache of the nearest layout, and the page wins over it', async () => {
    expect(
      (await answer(tree({}, { maxAge: 30 }), {}, { pageCache: false })).headers.get(
        'cache-control',
      ),
    ).toBe('public, max-age=30');
    expect(
      (
        await answer(tree({ cache: { maxAge: 5 } }, { maxAge: 30 }), {}, { pageCache: false })
      ).headers.get('cache-control'),
    ).toBe('public, max-age=5');
  });

  it('leaves a page without cache as it is', async () => {
    expect((await answer(tree({}))).headers.get('cache-control')).toBeNull();
  });

  it('makes a page private when the request reads cookies or authorization', async () => {
    const cookies = tree({ cache: { maxAge: 60 }, run: () => getEvent().getCookies() });
    expect(
      (await answer(cookies, { headers: { cookie: 'a=1' } })).headers.get('cache-control'),
    ).toBe('private, no-cache');
    const authorization = tree({
      cache: { maxAge: 60 },
      run: () => getEvent().request.headers.get('Authorization'),
    });
    expect((await answer(authorization)).headers.get('cache-control')).toBe('private, no-cache');
    const all = tree({ cache: { maxAge: 60 }, run: () => [...getEvent().request.headers] });
    expect((await answer(all)).headers.get('cache-control')).toBe('private, no-cache');
    // Other headers do not tell who the user is.
    const language = tree({
      cache: { maxAge: 60 },
      run: () => getEvent().request.headers.get('accept-language'),
    });
    expect((await answer(language)).headers.get('cache-control')).toBe('public, max-age=60');
  });

  it('makes a page private when it sets a cookie, or middleware reads the user', async () => {
    const setting = tree({ cache: { maxAge: 60 }, run: () => getEvent().setCookie('seen', '1') });
    const response = await answer(setting);
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
    expect(response.headers.getSetCookie()).toHaveLength(1);
    const middleware = {
      ...tree({ cache: { maxAge: 60 } }),
      middleware: async () => ({
        middleware: async (_request: Request, next: () => Promise<Response>) => {
          getEvent().getCookie('session');
          return next();
        },
      }),
    };
    expect((await answer(middleware as never)).headers.get('cache-control')).toBe(
      'private, no-cache',
    );
  });

  it('caches only GET and HEAD', async () => {
    const response = await answer(tree({ cache: { maxAge: 60 } }), { method: 'POST' });
    expect(response.headers.get('cache-control') ?? '').not.toMatch(/public/);
  });

  it('only says what a page would get in development, and warns about a private one', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await answer(
      tree({ cache: { maxAge: 60 }, run: () => getEvent().getCookies() }),
      {},
      { dev: true },
    );
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('x-brumate-cache')).toBe('private, no-cache');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Move what reads the user into #defer'),
    );
    warn.mockRestore();
  });
});

describe('pages that the server keeps', () => {
  /** A page that counts its renders, and loads a cached list with the tag `issues`. */
  function counted(run?: () => void) {
    const renders = { count: 0 };
    const list = cached(async () => ['a'], { maxAge: 300, tags: ['issues'] });
    const routes = {
      page: async () => ({
        default: Object.assign(
          async () => {
            renders.count++;
            run?.();
            return `<ul>${(await list()).join('')}</ul>`;
          },
          { brumateId: 'Kept_1' },
        ),
        cache: { maxAge: 60 },
      }),
    };
    return { renders, routes };
  }

  it('answers the next request for the URL from the store, until revalidate drops a tag', async () => {
    const { renders, routes } = counted();
    const first = await answer(routes as never);
    const second = await answer(routes as never);
    expect(renders.count).toBe(1);
    expect(second.headers.get('x-brumate-cache')).toBe('hit');
    expect(second.headers.get('cache-control')).toBe('public, max-age=60');
    expect(await second.text()).toBe(await first.text());
    await revalidate('issues');
    await answer(routes as never);
    expect(renders.count).toBe(2);
  });

  it('renders again after max-age', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(0);
    const { renders, routes } = counted();
    await answer(routes as never);
    now.mockReturnValue(61_000);
    await answer(routes as never);
    expect(renders.count).toBe(2);
    now.mockRestore();
  });

  it('keeps no private page, and serves none to a request that read the user', async () => {
    const reads = counted(() => getEvent().getCookies());
    await answer(reads.routes as never);
    await answer(reads.routes as never);
    expect(reads.renders.count).toBe(2);
    const { renders, routes } = counted();
    await answer(routes as never);
    const withMiddleware = {
      ...routes,
      middleware: async () => ({
        middleware: async (_request: Request, next: () => Promise<Response>) => {
          getEvent().getCookie('session');
          return next();
        },
      }),
    };
    await answer(withMiddleware as never);
    expect(renders.count).toBe(2);
  });

  it('keeps nothing with pageCache false or in development', async () => {
    const { renders, routes } = counted();
    await answer(routes as never, {}, { pageCache: false });
    await answer(routes as never, {}, { pageCache: false });
    await answer(routes as never, {}, { dev: true });
    await answer(routes as never, {}, { dev: true });
    expect(renders.count).toBe(4);
  });
});
