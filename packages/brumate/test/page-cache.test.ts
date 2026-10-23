import { describe, expect, it, vi } from 'vitest';
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

describe('cache of pages', () => {
  it('sends public cache-control for a page that exports cache', async () => {
    const response = await answer(tree({ cache: { maxAge: 60, staleWhileRevalidate: 600 } }));
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=60, stale-while-revalidate=600',
    );
    expect(await response.text()).toContain('<h1>Hi</h1>');
  });

  it('takes the cache of the nearest layout, and the page wins over it', async () => {
    expect((await answer(tree({}, { maxAge: 30 }))).headers.get('cache-control')).toBe(
      'public, max-age=30',
    );
    expect(
      (await answer(tree({ cache: { maxAge: 5 } }, { maxAge: 30 }))).headers.get('cache-control'),
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
