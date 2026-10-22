import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../src/index.ts';
import { ServerError, getEvent, redirect } from '../src/runtime/request.ts';
import { actionResult, handleRequest, handleRoute, render } from '../src/runtime/server.ts';
import type { Context, RouteNode } from '../src/runtime/server.ts';

const source = readFileSync(new URL('./forms/guestbook.brm', import.meta.url), 'utf8');
const output = new URL('./.output/forms/', import.meta.url);
// oxlint-disable-next-line typescript/no-explicit-any -- The compiled module is loaded at runtime.
let guestbook: any;
let compiled: ReturnType<typeof compile>;

beforeAll(async () => {
  mkdirSync(output, { recursive: true });
  compiled = compile(source, { filename: 'guestbook.brm' });
  writeFileSync(new URL('guestbook.brm.ts', output), compiled.server);
  guestbook = await import(new URL('guestbook.brm.ts', output).href);
});

const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
afterAll(() => errors.mockRestore());

/** Posts a form to a server function, as a browser without client code does. */
function post(name: string, data: Record<string, string>): Promise<Response | undefined> {
  const fn = Object.keys(guestbook.rpc).find((key) => key.endsWith(`#${name}`))!;
  return handleRequest(
    guestbook.rpc,
    new Request(`http://localhost/_brumate/${encodeURIComponent(fn)}`, {
      method: 'POST',
      headers: { referer: 'http://localhost/guestbook' },
      body: new URLSearchParams(data),
    }),
  );
}

describe('forms', () => {
  it('posts a form to a server function', async () => {
    const { html } = await render(guestbook.default, {});
    const fn = (name: string) =>
      encodeURIComponent(Object.keys(guestbook.rpc).find((key) => key.endsWith(`#${name}`))!);
    expect(html).toContain(`<form class="sign" action="/_brumate/${fn('sign')}" method="post">`);
    // A button can post to another server function.
    expect(html).toContain(
      `<button class="clear" formaction="/_brumate/${fn('clear')}" formmethod="post">`,
    );
    // A method on the element is kept.
    expect(html).toContain(`<form class="get" action="/_brumate/${fn('sign')}" method="get">`);
  });

  it('uses the prefix of the render', async () => {
    const { html } = await render(guestbook.default, {}, { rpc: '/api' });
    expect(html).toMatch(/<form class="sign" action="\/api\//);
  });

  it('names the build of the render in the URL of the form', async () => {
    const { html } = await render(guestbook.default, {}, { build: 'b1' });
    expect(html).toMatch(
      /<form class="sign" action="\/_brumate\/[^"?]+\?__build=b1" method="post">/,
    );
    expect(html).toMatch(/formaction="\/_brumate\/[^"?]+\?__build=b1"/);
  });

  it('renders the action in a form that the client renders', () => {
    expect(compiled.render).toMatch(/\$\$b\.action\("action", "Guestbook_\w+#sign", "method"\)/);
  });

  it('calls the function with the form data and sends the browser back', async () => {
    const response = await post('sign', { name: 'Ada' });
    expect(response?.status).toBe(303);
    expect(response?.headers.get('location')).toBe('http://localhost/guestbook');
    expect(guestbook.entries).toEqual(['Ada']);
  });

  it('follows a redirect in the function', async () => {
    const response = await post('clear', {});
    expect(response?.status).toBe(303);
    expect(response?.headers.get('location')).toBe('/cleared');
    expect(guestbook.entries).toEqual([]);
  });

  it('answers with the message of a ServerError', async () => {
    const response = await post('sign', {});
    expect(response?.status).toBe(422);
    expect(await response?.text()).toBe('A name is needed');
  });

  it('answers 403 to a form that a page of another site posts', async () => {
    const fn = Object.keys(guestbook.rpc).find((key) => key.endsWith('#sign'))!;
    const response = await handleRequest(
      guestbook.rpc,
      new Request(`http://localhost/_brumate/${encodeURIComponent(fn)}`, {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
        body: new URLSearchParams({ name: 'Mallory' }),
      }),
    );
    expect(response?.status).toBe(403);
    expect(guestbook.entries).not.toContain('Mallory');
  });
});

/** Server functions that set a cookie and a header, then end as `outcome` says. */
const effects = {
  run(form: FormData) {
    const event = getEvent();
    event.setCookie('seen', 'yes');
    event.headers.set('x-extra', '1');
    const outcome = String(form.get('outcome'));
    if (outcome === 'redirect') {
      redirect('/next', 307);
    }
    if (outcome === 'fail') {
      throw new ServerError('Not allowed', { status: 409 });
    }
    if (outcome === 'crash') {
      throw new Error('secret');
    }
    return `done ${outcome}`;
  },
};

const COOKIE = 'seen=yes; Path=/; HttpOnly; SameSite=Lax';

/** Posts a form to `effects.run`, as a browser without client code does. */
function postEffects(
  data: Record<string, string>,
  headers: Record<string, string> = {},
  id = 'run',
): Promise<Response | undefined> {
  return handleRequest(
    effects,
    new Request(`http://localhost/_brumate/${id}`, {
      method: 'POST',
      headers,
      body: new URLSearchParams(data),
    }),
  );
}

describe('forms that post to a server function', () => {
  it('sends the browser back with the headers that the function set', async () => {
    const response = await postEffects({ outcome: 'ok' }, { referer: 'http://localhost/from' });
    expect(response?.status).toBe(303);
    expect(response?.headers.get('location')).toBe('http://localhost/from');
    expect(response?.headers.getSetCookie()).toEqual([COOKIE]);
    expect(response?.headers.get('x-extra')).toBe('1');
    expect(await response?.text()).toBe('');
  });

  it('sends the browser to / without a referer', async () => {
    const response = await postEffects({ outcome: 'ok' });
    expect(response?.headers.get('location')).toBe('/');
  });

  it('keeps the location and status of a redirect as they are', async () => {
    const response = await postEffects(
      { outcome: 'redirect' },
      { referer: 'http://localhost/from' },
    );
    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe('/next');
    expect(response?.headers.getSetCookie()).toEqual([COOKIE]);
    expect(response?.headers.get('x-extra')).toBe('1');
  });

  it('answers an error with text and the headers that the function set', async () => {
    const response = await postEffects({ outcome: 'fail' });
    expect(response?.status).toBe(409);
    expect(response?.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(response?.headers.get('location')).toBeNull();
    expect(response?.headers.getSetCookie()).toEqual([COOKIE]);
    expect(response?.headers.get('x-extra')).toBe('1');
    expect(await response?.text()).toBe('Not allowed');
  });

  it('hides the message of other errors', async () => {
    const response = await postEffects({ outcome: 'crash' });
    expect(response?.status).toBe(500);
    expect(await response?.text()).toBe('The server function failed');
  });

  it('answers 403 and 404 with text', async () => {
    const blocked = await postEffects({}, { origin: 'https://evil.example' });
    expect(blocked?.status).toBe(403);
    expect(await blocked?.text()).toBe('Calls from other sites are not allowed');
    const missing = await postEffects({}, {}, 'nope');
    expect(missing?.status).toBe(404);
    expect(await missing?.text()).toBe('Unknown server function "nope"');
  });
});

/** A page that shows the result of `effects.run`. */
const page: RouteNode = {
  page: async () => ({
    default: async (_props: unknown, ctx: Context) =>
      `<p>${String(actionResult(ctx, effects.run))}</p>`,
  }),
};

/** Posts a form to the page with `?__action=<id>`. */
function postPage(
  data: Record<string, string>,
  headers: Record<string, string> = {},
  id = 'run',
): Promise<Response | undefined> {
  return handleRoute(
    page,
    new Request(`http://localhost/?__action=${id}`, {
      method: 'POST',
      headers,
      body: new URLSearchParams(data),
    }),
    { functions: effects },
  );
}

describe('forms that post to a page', () => {
  it('renders the page with the result and the cookies that the function set', async () => {
    const response = await postPage({ outcome: 'ok' }, { referer: 'http://localhost/from' });
    expect(response?.status).toBe(200);
    expect(response?.headers.get('location')).toBeNull();
    expect(response?.headers.getSetCookie()).toEqual([COOKIE]);
    expect(await response?.text()).toContain('<p>done ok</p>');
  });

  it('resolves the location of a redirect against the page, with only the cookies', async () => {
    const response = await postPage({ outcome: 'redirect' });
    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe('http://localhost/next');
    expect(response?.headers.getSetCookie()).toEqual([COOKIE]);
    expect(response?.headers.get('x-extra')).toBeNull();
    expect(await response?.text()).toBe('');
  });

  it('answers an error with text and only the cookies', async () => {
    const response = await postPage({ outcome: 'fail' });
    expect(response?.status).toBe(409);
    expect(response?.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(response?.headers.getSetCookie()).toEqual([COOKIE]);
    expect(response?.headers.get('x-extra')).toBeNull();
    expect(await response?.text()).toBe('Not allowed');
  });

  it('hides the message of other errors', async () => {
    const response = await postPage({ outcome: 'crash' });
    expect(response?.status).toBe(500);
    expect(await response?.text()).toBe('The server function failed');
  });

  it('answers 403 and 404 with text', async () => {
    const blocked = await postPage({}, { origin: 'https://evil.example' });
    expect(blocked?.status).toBe(403);
    expect(await blocked?.text()).toBe('Calls from other sites are not allowed');
    const missing = await postPage({}, {}, 'nope');
    expect(missing?.status).toBe(404);
    expect(await missing?.text()).toBe('Unknown server function "nope"');
  });
});
